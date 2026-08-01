import {
  createSupportKit,
  isSupportKitError,
  type SupportKit,
  type SupportKitConfig,
} from "@crazyglegit/support";
import {
  apiErrorEnvelopeSchema,
  conversationStatusSchema,
  type CustomerConversation,
  type CustomerMessage,
  type FeatureFlags,
  type WidgetConfig,
} from "@crazyglegit/support-contracts";
import { z } from "zod";

const createConversationSchema = z.strictObject({
  subject: z.string().trim().min(1).max(500).optional(),
  initialMessage: z.strictObject({
    body: z.string().trim().min(1).max(50_000),
    clientMessageId: z.string().trim().min(1).max(200),
  }),
});
const sendMessageSchema = z.strictObject({
  body: z.string().trim().min(1).max(50_000),
  clientMessageId: z.string().trim().min(1).max(200),
  type: z.enum(["text", "image", "file", "quick_reply"]).optional(),
});
const noteSchema = sendMessageSchema.pick({
  body: true,
  clientMessageId: true,
});
const assignSchema = z.strictObject({ agentId: z.string().trim().min(1) });
const statusSchema = z.strictObject({ status: conversationStatusSchema });

type RouteMethod = "GET" | "POST" | "PATCH" | "DELETE";
type CustomerActor =
  | Awaited<ReturnType<SupportKit["auth"]["resolveCustomer"]>>
  | Awaited<ReturnType<SupportKit["auth"]["resolveVisitor"]>>;

/** Next.js-compatible catch-all route context. */
export interface SupportHandlerContext {
  readonly params?:
    | Readonly<Record<string, string | readonly string[] | undefined>>
    | Promise<Readonly<Record<string, string | readonly string[] | undefined>>>;
}

/** A Web Request handler compatible with a Next.js App Router route export. */
export type SupportHandler = (
  request: Request,
  context?: SupportHandlerContext,
) => Promise<Response>;

/** Methods exposed by the support catch-all route factory. */
export interface SupportRouteHandlers {
  readonly GET: SupportHandler;
  readonly POST: SupportHandler;
  readonly PATCH: SupportHandler;
  readonly DELETE: SupportHandler;
}

function json(data: unknown, status = 200, requestId?: string): Response {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      ...(requestId ? { "x-request-id": requestId } : {}),
    },
  });
}

function success(data: unknown, status = 200, requestId?: string): Response {
  return json({ success: true, data }, status, requestId);
}

function customerConversation(
  conversation: Awaited<
    ReturnType<SupportKit["conversations"]["listForCustomer"]>
  >[number],
): CustomerConversation {
  return {
    id: conversation.id,
    status: conversation.status,
    ...(conversation.subject ? { subject: conversation.subject } : {}),
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

function customerMessage(
  message: Awaited<ReturnType<SupportKit["messages"]["list"]>>[number],
): CustomerMessage | undefined {
  if (message.type === "internal_note") return undefined;
  return {
    id: message.id,
    conversationId: message.conversationId,
    ...(message.clientMessageId
      ? { clientMessageId: message.clientMessageId }
      : {}),
    type: message.type,
    senderType: message.senderType,
    body: message.body,
    deliveryStatus: message.deliveryStatus,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}

function customerMessages(
  messages: Awaited<ReturnType<SupportKit["messages"]["list"]>>,
): readonly CustomerMessage[] {
  return messages.flatMap((message) => {
    const serialized = customerMessage(message);
    return serialized ? [serialized] : [];
  });
}

function agentConversation(
  conversation: Awaited<
    ReturnType<SupportKit["conversations"]["listInbox"]>
  >[number],
) {
  return {
    id: conversation.id,
    status: conversation.status,
    ...(conversation.subject ? { subject: conversation.subject } : {}),
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

function agentMessage(
  message: Awaited<ReturnType<SupportKit["messages"]["list"]>>[number],
) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    ...(message.clientMessageId
      ? { clientMessageId: message.clientMessageId }
      : {}),
    type: message.type,
    senderType: message.senderType,
    body: message.body,
    deliveryStatus: message.deliveryStatus,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}

function errorResponse(
  code: z.infer<typeof apiErrorEnvelopeSchema>["error"]["code"],
  message: string,
  status: number,
  requestId: string,
  details?: Readonly<Record<string, unknown>>,
): Response {
  return json(
    {
      success: false,
      error: { code, message, ...(details ? { details } : {}), requestId },
    },
    status,
    requestId,
  );
}

function authContext(request: Request) {
  return {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
  };
}

async function customerActor(
  support: SupportKit,
  request: Request,
): Promise<CustomerActor> {
  try {
    return await support.auth.resolveCustomer(authContext(request));
  } catch (error) {
    if (!isSupportKitError(error) || error.code !== "UNAUTHENTICATED")
      throw error;
    return support.auth.resolveVisitor(authContext(request));
  }
}

async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new HttpError(
      "VALIDATION_ERROR",
      "The request body must be valid JSON.",
      400,
    );
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new HttpError(
      "VALIDATION_ERROR",
      "The request body is invalid.",
      400,
      {
        issues: parsed.error.issues.map(({ code, message, path }) => ({
          code,
          message,
          path,
        })),
      },
    );
  }
  return parsed.data;
}

class HttpError extends Error {
  public constructor(
    public readonly code: z.infer<
      typeof apiErrorEnvelopeSchema
    >["error"]["code"],
    message: string,
    public readonly status: number,
    public readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
  }
}

function pathParts(request: Request): readonly string[] {
  const pathname = new URL(request.url).pathname;
  const marker = "/api/support";
  const markerIndex = pathname.indexOf(marker);
  const route =
    markerIndex >= 0 ? pathname.slice(markerIndex + marker.length) : pathname;
  return route.split("/").filter(Boolean).map(decodeURIComponent);
}

function enforceOrigin(
  request: Request,
  allowedOrigins: readonly string[],
): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (origin !== null && !allowedOrigins.includes(origin))
    throw new HttpError("FORBIDDEN", "The request origin is not allowed.", 403);
}

function statusFor(code: string): number {
  const statuses: Readonly<Record<string, number>> = {
    VALIDATION_ERROR: 400,
    INVALID_CLIENT_MESSAGE_ID: 400,
    UNAUTHENTICATED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INVALID_STATE_TRANSITION: 409,
    FEATURE_UNAVAILABLE: 501,
    CONFIGURATION_ERROR: 500,
    SDK_DISPOSED: 503,
    INTERNAL_ERROR: 500,
  };
  return statuses[code] ?? 500;
}

async function dispatch(
  support: SupportKit,
  request: Request,
  publicConfiguration: {
    readonly widget?: WidgetConfig;
    readonly features?: FeatureFlags;
  },
): Promise<Response> {
  const parts = pathParts(request);
  const method = request.method as RouteMethod;

  if (
    method === "GET" &&
    parts.length === 2 &&
    parts[0] === "widget" &&
    parts[1] === "config"
  ) {
    return success({
      ...(publicConfiguration.widget?.title
        ? { title: publicConfiguration.widget.title }
        : {}),
      ...(publicConfiguration.widget?.greeting
        ? { greeting: publicConfiguration.widget.greeting }
        : {}),
      ...(publicConfiguration.widget?.launcherLabel
        ? { launcherLabel: publicConfiguration.widget.launcherLabel }
        : {}),
      ...(publicConfiguration.widget?.position
        ? { position: publicConfiguration.widget.position }
        : {}),
      ...(publicConfiguration.widget?.theme
        ? { theme: publicConfiguration.widget.theme }
        : {}),
      ...(publicConfiguration.widget?.accentColor
        ? { accentColor: publicConfiguration.widget.accentColor }
        : {}),
      ...(publicConfiguration.widget?.locale
        ? { locale: publicConfiguration.widget.locale }
        : {}),
      features: {
        attachments: publicConfiguration.features?.attachments === true,
        chatbot: publicConfiguration.features?.chatbot === true,
      },
    });
  }

  if (method === "POST" && parts.length === 1 && parts[0] === "session") {
    const actor = await customerActor(support, request);
    return success({ actor });
  }
  if (
    method === "POST" &&
    parts.length === 2 &&
    parts[0] === "agent" &&
    parts[1] === "session"
  ) {
    const actor = await support.auth.resolveAgent(authContext(request));
    return success({ actor });
  }
  if (parts[0] === "conversations") {
    const actor = await customerActor(support, request);
    if (method === "GET" && parts.length === 1)
      return success(
        (await support.conversations.listForCustomer({ actor })).map(
          customerConversation,
        ),
      );
    if (method === "POST" && parts.length === 1) {
      const input = await body(request, createConversationSchema);
      const created = await support.conversations.create({
        actor,
        initialMessage: input.initialMessage,
        ...(input.subject ? { subject: input.subject } : {}),
      });
      return success(
        {
          conversation: customerConversation(created.conversation),
          initialMessage: customerMessage(created.message),
        },
        201,
      );
    }
    const conversationId = parts[1];
    if (conversationId && method === "GET" && parts.length === 2) {
      const conversations = await support.conversations.listForCustomer({
        actor,
      });
      const conversation = conversations.find(
        (item) => item.id === conversationId,
      );
      if (!conversation)
        throw new HttpError(
          "NOT_FOUND",
          "The conversation was not found.",
          404,
        );
      return success({ conversation: customerConversation(conversation) });
    }
    if (conversationId && parts[2] === "messages" && parts.length === 3) {
      if (method === "GET")
        return success(
          customerMessages(
            await support.messages.list({ conversationId, actor }),
          ),
        );
      if (method === "POST") {
        const input = await body(request, sendMessageSchema);
        const sent = await support.conversations.sendMessage({
          body: input.body,
          clientMessageId: input.clientMessageId,
          conversationId,
          actor,
          ...(input.type ? { type: input.type } : {}),
        });
        return success(customerMessage(sent), 201);
      }
    }
  }
  if (method === "POST" && parts[0] === "messages" && parts[2] === "read") {
    const messageId = parts[1];
    if (messageId) {
      const actor = await customerActor(support, request);
      return success(await support.messages.recordRead({ messageId, actor }));
    }
  }
  if (parts[0] === "agent" && parts[1] === "conversations") {
    const actor = await support.auth.resolveAgent(authContext(request));
    if (method === "GET" && parts.length === 2) {
      const assignment = new URL(request.url).searchParams.get("assignment");
      if (assignment !== null && assignment !== "mine")
        throw new HttpError(
          "VALIDATION_ERROR",
          "The assignment filter is invalid.",
          400,
        );
      return success(
        (
          await support.conversations.listInbox({
            actor,
            ...(assignment === "mine" ? { assignedToAgentId: actor.id } : {}),
          })
        ).map(agentConversation),
      );
    }
    const conversationId = parts[2];
    if (conversationId && method === "GET" && parts.length === 3) {
      const conversations = await support.conversations.listInbox({ actor });
      const conversation = conversations.find(
        (item) => item.id === conversationId,
      );
      if (!conversation)
        throw new HttpError(
          "NOT_FOUND",
          "The conversation was not found.",
          404,
        );
      return success({
        conversation: agentConversation(conversation),
        messages: (await support.messages.list({ conversationId, actor })).map(
          agentMessage,
        ),
      });
    }
    if (conversationId && method === "POST" && parts.length === 4) {
      switch (parts[3]) {
        case "messages": {
          const input = await body(request, sendMessageSchema);
          return success(
            agentMessage(
              await support.conversations.sendMessage({
                body: input.body,
                clientMessageId: input.clientMessageId,
                conversationId,
                actor,
                ...(input.type ? { type: input.type } : {}),
              }),
            ),
            201,
          );
        }
        case "notes": {
          const input = await body(request, noteSchema);
          return success(
            agentMessage(
              await support.conversations.addInternalNote({
                ...input,
                conversationId,
                actor,
              }),
            ),
            201,
          );
        }
        case "assign": {
          const input = await body(request, assignSchema);
          return success(
            await support.conversations.assign({
              ...input,
              conversationId,
              actor,
            }),
          );
        }
        case "assign-self":
          return success(
            await support.conversations.assign({
              agentId: actor.id,
              conversationId,
              actor,
            }),
          );
        case "resolve":
          return success(
            await support.conversations.changeStatus({
              conversationId,
              actor,
              status: "resolved",
            }),
          );
        case "reopen":
          return success(
            await support.conversations.reopen({ conversationId, actor }),
          );
        case "spam":
          return success(
            await support.conversations.markSpam({ conversationId, actor }),
          );
      }
    }
    if (
      conversationId &&
      method === "POST" &&
      parts.length === 5 &&
      parts[3] === "tags"
    ) {
      const tagId = parts[4];
      if (!tagId)
        throw new HttpError("VALIDATION_ERROR", "A tag is required.", 400);
      await support.tags.add({ conversationId, tagId, actor });
      return success({ conversationId, tagId });
    }
    if (
      conversationId &&
      method === "DELETE" &&
      parts.length === 5 &&
      parts[3] === "tags"
    ) {
      const tagId = parts[4];
      if (!tagId)
        throw new HttpError("VALIDATION_ERROR", "A tag is required.", 400);
      await support.tags.remove({ conversationId, tagId, actor });
      return success({ conversationId, tagId });
    }
    if (conversationId && method === "PATCH" && parts.length === 3) {
      const input = await body(request, statusSchema);
      return success(
        await support.conversations.changeStatus({
          ...input,
          conversationId,
          actor,
        }),
      );
    }
  }
  if (
    method === "POST" &&
    parts[0] === "agent" &&
    parts[1] === "messages" &&
    parts[3] === "read"
  ) {
    const messageId = parts[2];
    if (messageId) {
      const actor = await support.auth.resolveAgent(authContext(request));
      return success(await support.messages.recordRead({ messageId, actor }));
    }
  }
  throw new HttpError("NOT_FOUND", "The support route was not found.", 404);
}

/** Creates handlers around an already composed SDK instance. */
export function createSupportServer(
  support: SupportKit | Promise<SupportKit> | (() => Promise<SupportKit>),
  options: {
    readonly allowedOrigins: readonly string[];
    readonly widget?: WidgetConfig;
    readonly features?: FeatureFlags;
  },
): SupportRouteHandlers {
  let resolved: Promise<SupportKit> | undefined;
  const resolveSupport = (): Promise<SupportKit> => {
    resolved ??=
      typeof support === "function" ? support() : Promise.resolve(support);
    return resolved;
  };
  const handler: SupportHandler = async (request) => {
    const requestId =
      request.headers.get("x-request-id") ?? globalThis.crypto.randomUUID();
    try {
      enforceOrigin(request, options.allowedOrigins);
      const response = await dispatch(await resolveSupport(), request, options);
      response.headers.set("x-request-id", requestId);
      return response;
    } catch (error) {
      if (error instanceof HttpError)
        return errorResponse(
          error.code,
          error.message,
          error.status,
          requestId,
          error.details,
        );
      if (isSupportKitError(error)) {
        const code =
          error.code === "INVALID_CLIENT_MESSAGE_ID"
            ? "VALIDATION_ERROR"
            : error.code === "FEATURE_UNAVAILABLE" ||
                error.code === "CONFIGURATION_ERROR" ||
                error.code === "SDK_DISPOSED"
              ? "INTERNAL_ERROR"
              : error.code;
        return errorResponse(
          code,
          error.message,
          statusFor(error.code),
          requestId,
          error.details,
        );
      }
      return errorResponse(
        "INTERNAL_ERROR",
        "The support request failed.",
        500,
        requestId,
      );
    }
  };
  return { GET: handler, POST: handler, PATCH: handler, DELETE: handler };
}

/** Creates lazy, reusable Next.js App Router handlers from Support Kit configuration. */
export function createSupportHandler(
  config: SupportKitConfig,
): SupportRouteHandlers {
  return createSupportServer(() => createSupportKit(config), {
    allowedOrigins: config.security.allowedOrigins,
    ...(config.widget ? { widget: config.widget } : {}),
    ...(config.features ? { features: config.features } : {}),
  });
}
