import {
  createSupportKit,
  isSupportKitError,
  type SupportKit,
  type SupportKitConfig,
} from "@crazyglegit/support";
import {
  apiErrorEnvelopeSchema,
  attachmentIdsSchema,
  createUploadIntentSchema,
  chatbotHandoffInputSchema,
  chatbotMessageInputSchema,
  knowledgeArticleInputSchema,
  knowledgeArticlePatchSchema,
  conversationStatusSchema,
  type CustomerConversation,
  type CustomerMessage,
  type FeatureFlags,
  type AttachmentConfig,
  type ChatbotConfig,
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
const sendMessageSchema = z
  .strictObject({
    body: z.string().trim().max(50_000).default(""),
    clientMessageId: z.string().trim().min(1).max(200),
    type: z.enum(["text", "image", "file", "quick_reply"]).optional(),
    attachmentIds: attachmentIdsSchema.optional(),
  })
  .refine(
    (value) => value.body.length > 0 || (value.attachmentIds?.length ?? 0) > 0,
    {
      message: "A message or attachment is required.",
    },
  );
const noteSchema = z
  .strictObject({
    body: z.string().trim().max(50_000).default(""),
    clientMessageId: z.string().trim().min(1).max(200),
    attachmentIds: attachmentIdsSchema.optional(),
  })
  .refine(
    (value) => value.body.length > 0 || (value.attachmentIds?.length ?? 0) > 0,
    { message: "A note or attachment is required." },
  );
const assignSchema = z.strictObject({ agentId: z.string().trim().min(1) });
const statusSchema = z.strictObject({ status: conversationStatusSchema });

function publicKnowledgeArticle(
  article: Awaited<ReturnType<NonNullable<SupportKit["knowledge"]>["create"]>>,
) {
  return {
    id: article.id,
    title: article.title,
    sourceKey: article.sourceKey,
    summary: article.summary,
    body: article.body,
    tags: article.tags,
    status: article.status,
    revisionNumber: article.revisionNumber,
    ...(article.activeRevisionNumber
      ? { activeRevisionNumber: article.activeRevisionNumber }
      : {}),
    ...(article.publishedAt
      ? { publishedAt: article.publishedAt.toISOString() }
      : {}),
    ...(article.archivedAt
      ? { archivedAt: article.archivedAt.toISOString() }
      : {}),
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
  };
}
function publicChatbotSession(
  session: Awaited<ReturnType<NonNullable<SupportKit["chatbot"]>["start"]>>,
) {
  return {
    id: session.id,
    status: session.status,
    ...(session.conversationId
      ? { conversationId: session.conversationId }
      : {}),
    turnCount: session.turnCount,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}
function publicChatbotTurn(
  turn: Awaited<
    ReturnType<NonNullable<SupportKit["chatbot"]>["turns"]>
  >[number],
) {
  return {
    id: turn.id,
    actorType: turn.actorType,
    content: turn.content,
    citations: turn.citations,
    outcome: turn.outcome,
    createdAt: turn.createdAt.toISOString(),
  };
}

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
    attachments: (message.attachments ?? []).map((attachment) => ({
      id: attachment.id,
      fileName: attachment.safeDisplayFilename,
      mediaType: attachment.detectedMimeType ?? attachment.claimedMimeType,
      sizeBytes: attachment.sizeBytes,
      status: "ready" as const,
    })),
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
    attachments: (message.attachments ?? []).map((attachment) => ({
      id: attachment.id,
      fileName: attachment.safeDisplayFilename,
      mediaType: attachment.detectedMimeType ?? attachment.claimedMimeType,
      sizeBytes: attachment.sizeBytes,
      status: "ready" as const,
    })),
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
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json")
    throw new HttpError(
      "VALIDATION_ERROR",
      "The request content type must be application/json.",
      415,
    );
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 65_536)
    throw new HttpError(
      "VALIDATION_ERROR",
      "The request body is too large.",
      413,
    );
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
    ATTACHMENTS_DISABLED: 404,
    FILE_TOO_LARGE: 413,
    FILE_TYPE_NOT_ALLOWED: 415,
    TOO_MANY_ATTACHMENTS: 400,
    ATTACHMENT_NOT_READY: 409,
    ATTACHMENT_REJECTED: 409,
    ATTACHMENT_ALREADY_ATTACHED: 409,
    UPLOAD_EXPIRED: 410,
    UPLOAD_NOT_FOUND: 404,
    UPLOAD_VERIFICATION_FAILED: 422,
    MALWARE_DETECTED: 422,
    SCAN_FAILED: 422,
    STORAGE_UNAVAILABLE: 503,
    CHATBOT_DISABLED: 404,
    CHATBOT_SESSION_NOT_FOUND: 404,
    CHATBOT_SESSION_LIMIT_REACHED: 429,
    KNOWLEDGE_UNAVAILABLE: 404,
    KNOWLEDGE_NOT_FOUND: 404,
    KNOWLEDGE_NOT_PUBLISHED: 409,
    RETRIEVAL_FAILED: 503,
    INSUFFICIENT_KNOWLEDGE: 422,
    AI_PROVIDER_UNAVAILABLE: 503,
    AI_RESPONSE_INVALID: 502,
    CITATION_VALIDATION_FAILED: 502,
    HANDOFF_ALREADY_REQUESTED: 409,
    INDEXING_FAILED: 422,
    EMBEDDING_DIMENSION_MISMATCH: 422,
    RATE_LIMITED: 429,
    FEATURE_UNAVAILABLE: 501,
    CONFIGURATION_ERROR: 500,
    SDK_DISPOSED: 503,
    INTERNAL_ERROR: 500,
  };
  return statuses[code] ?? 500;
}

async function enforceAttachmentRateLimit(
  limiter:
    | ((input: {
        readonly request: Request;
        readonly operation: "intent" | "complete";
      }) => Promise<boolean>)
    | undefined,
  request: Request,
  operation: "intent" | "complete",
): Promise<void> {
  if (limiter && !(await limiter({ request, operation })))
    throw new HttpError("RATE_LIMITED", "Too many upload requests.", 429);
}

async function dispatch(
  support: SupportKit,
  request: Request,
  publicConfiguration: {
    readonly widget?: WidgetConfig;
    readonly features?: FeatureFlags;
    readonly attachments?: AttachmentConfig;
    readonly chatbot?: ChatbotConfig;
    readonly attachmentRateLimit?: (input: {
      readonly request: Request;
      readonly operation: "intent" | "complete";
    }) => Promise<boolean>;
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
        attachments:
          publicConfiguration.attachments?.enabled === true ||
          publicConfiguration.features?.attachments === true,
        chatbot:
          publicConfiguration.chatbot?.enabled === true ||
          publicConfiguration.features?.chatbot === true,
      },
      ...(publicConfiguration.attachments?.enabled
        ? {
            attachments: {
              maxFileSizeBytes:
                publicConfiguration.attachments.maxFileSizeBytes,
              maxFilesPerMessage:
                publicConfiguration.attachments.maxFilesPerMessage,
              allowedMimeTypes:
                publicConfiguration.attachments.allowedMimeTypes,
            },
          }
        : {}),
    });
  }

  if (method === "POST" && parts.length === 1 && parts[0] === "session") {
    const actor = await customerActor(support, request);
    return success({ actor });
  }
  if (parts[0] === "chatbot") {
    const chatbotOperations = support.chatbot;
    if (!chatbotOperations)
      throw new HttpError(
        "CHATBOT_DISABLED",
        "The automated assistant is unavailable.",
        404,
      );
    const actor = await customerActor(support, request);
    if (method === "POST" && parts[1] === "sessions" && parts.length === 2)
      return success(
        publicChatbotSession(await chatbotOperations.start({ actor })),
        201,
      );
    const sessionId = parts[2];
    if (parts[1] === "sessions" && sessionId) {
      if (method === "GET" && parts.length === 3)
        return success(
          publicChatbotSession(
            await chatbotOperations.get({ actor, sessionId }),
          ),
        );
      if (parts[3] === "messages") {
        if (method === "GET" && parts.length === 4)
          return success(
            (await chatbotOperations.turns({ actor, sessionId })).map(
              publicChatbotTurn,
            ),
          );
        if (method === "POST" && parts.length === 4) {
          const input = await body(request, chatbotMessageInputSchema);
          const result = await chatbotOperations.send({
            actor,
            sessionId,
            message: input.message,
            clientMessageId: input.clientMessageId,
          });
          return success(
            {
              userTurn: publicChatbotTurn(result.userTurn),
              botTurn: publicChatbotTurn(result.botTurn),
            },
            201,
          );
        }
      }
      if (method === "POST" && parts[3] === "handoff" && parts.length === 4) {
        const input = await body(request, chatbotHandoffInputSchema);
        const handoff = await chatbotOperations.handoff({
          actor,
          sessionId,
          reason: input.reason,
        });
        return success(
          {
            conversationId: handoff.conversationId,
            requestedAt: handoff.requestedAt.toISOString(),
          },
          201,
        );
      }
    }
  }
  if (parts[0] === "agent" && parts[1] === "knowledge") {
    const knowledgeOperations = support.knowledge;
    if (!knowledgeOperations)
      throw new HttpError(
        "KNOWLEDGE_UNAVAILABLE",
        "Knowledge is unavailable.",
        404,
      );
    const actor = await support.auth.resolveAgent(authContext(request));
    if (parts.length === 2) {
      if (method === "GET") {
        const rawStatus = new URL(request.url).searchParams.get("status");
        const parsedStatus =
          rawStatus === null
            ? undefined
            : z.enum(["draft", "published", "archived"]).safeParse(rawStatus);
        if (parsedStatus !== undefined && !parsedStatus.success)
          throw new HttpError(
            "VALIDATION_ERROR",
            "The knowledge status filter is invalid.",
            400,
          );
        return success(
          (
            await knowledgeOperations.list({
              actor,
              ...(parsedStatus?.success ? { status: parsedStatus.data } : {}),
            })
          ).map(publicKnowledgeArticle),
        );
      }
      if (method === "POST") {
        const input = await body(request, knowledgeArticleInputSchema);
        return success(
          publicKnowledgeArticle(
            await knowledgeOperations.create({ actor, ...input }),
          ),
          201,
        );
      }
    }
    const articleId = parts[2];
    if (articleId && method === "PATCH" && parts.length === 3) {
      const patch = await body(request, knowledgeArticlePatchSchema);
      const safePatch = Object.fromEntries(
        Object.entries(patch).filter((entry) => entry[1] !== undefined),
      );
      return success(
        publicKnowledgeArticle(
          await knowledgeOperations.update({
            actor,
            articleId,
            patch: safePatch,
          }),
        ),
      );
    }
    if (
      articleId &&
      method === "POST" &&
      parts.length === 4 &&
      parts[3] === "publish"
    )
      return success(
        publicKnowledgeArticle(
          await knowledgeOperations.publish({ actor, articleId }),
        ),
      );
    if (
      articleId &&
      method === "POST" &&
      parts.length === 4 &&
      parts[3] === "archive"
    )
      return success(
        publicKnowledgeArticle(
          await knowledgeOperations.archive({ actor, articleId }),
        ),
      );
    if (
      articleId &&
      method === "POST" &&
      parts.length === 4 &&
      parts[3] === "restore"
    )
      return success(
        publicKnowledgeArticle(
          await knowledgeOperations.restore({ actor, articleId }),
        ),
      );
    if (
      articleId &&
      method === "GET" &&
      parts.length === 4 &&
      parts[3] === "revisions"
    )
      return success(
        (await knowledgeOperations.revisions({ actor, articleId })).map(
          (revision) => ({
            revisionNumber: revision.revisionNumber,
            title: revision.title,
            summary: revision.summary,
            body: revision.body,
            createdAt: revision.createdAt.toISOString(),
            updatedAt: revision.updatedAt.toISOString(),
          }),
        ),
      );
  }
  if (parts[0] === "attachments") {
    const actor = await customerActor(support, request);
    if (
      method === "POST" &&
      parts[1] === "upload-intents" &&
      parts.length === 2
    ) {
      await enforceAttachmentRateLimit(
        publicConfiguration.attachmentRateLimit,
        request,
        "intent",
      );
      const input = await body(request, createUploadIntentSchema);
      return success(
        await support.attachments.createUploadIntent({
          actor,
          conversationId: input.conversationId,
          fileName: input.fileName,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          ...(input.purpose ? { purpose: input.purpose } : {}),
        }),
        201,
      );
    }
    const attachmentId = parts[1];
    if (attachmentId && (parts.length === 2 || parts.length === 3)) {
      const conversationId = new URL(request.url).searchParams.get(
        "conversationId",
      );
      if (!conversationId)
        throw new HttpError(
          "VALIDATION_ERROR",
          "A conversation is required.",
          400,
        );
      if (method === "POST" && parts[2] === "complete")
        await enforceAttachmentRateLimit(
          publicConfiguration.attachmentRateLimit,
          request,
          "complete",
        );
      if (method === "POST" && parts[2] === "complete")
        return success(
          await support.attachments.completeUpload({
            actor,
            attachmentId,
            conversationId,
          }),
        );
      if (method === "DELETE" && parts.length === 2) {
        await support.attachments.deletePending({
          actor,
          attachmentId,
          conversationId,
        });
        return success({ deleted: true });
      }
      if (method === "GET" && parts[2] === "download")
        return success(
          await support.attachments.getDownload({
            actor,
            attachmentId,
            conversationId,
          }),
        );
    }
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
          ...(input.attachmentIds
            ? { attachmentIds: input.attachmentIds }
            : {}),
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
                ...(input.attachmentIds
                  ? { attachmentIds: input.attachmentIds }
                  : {}),
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
                body: input.body,
                clientMessageId: input.clientMessageId,
                conversationId,
                actor,
                ...(input.attachmentIds
                  ? { attachmentIds: input.attachmentIds }
                  : {}),
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
  if (parts[0] === "agent" && parts[1] === "attachments") {
    const actor = await support.auth.resolveAgent(authContext(request));
    if (
      method === "POST" &&
      parts[2] === "upload-intents" &&
      parts.length === 3
    ) {
      await enforceAttachmentRateLimit(
        publicConfiguration.attachmentRateLimit,
        request,
        "intent",
      );
      const input = await body(request, createUploadIntentSchema);
      return success(
        await support.attachments.createUploadIntent({
          actor,
          conversationId: input.conversationId,
          fileName: input.fileName,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          ...(input.purpose ? { purpose: input.purpose } : {}),
        }),
        201,
      );
    }
    const attachmentId = parts[2];
    if (attachmentId && (parts.length === 3 || parts.length === 4)) {
      const conversationId = new URL(request.url).searchParams.get(
        "conversationId",
      );
      if (!conversationId)
        throw new HttpError(
          "VALIDATION_ERROR",
          "A conversation is required.",
          400,
        );
      if (method === "POST" && parts[3] === "complete")
        await enforceAttachmentRateLimit(
          publicConfiguration.attachmentRateLimit,
          request,
          "complete",
        );
      if (method === "POST" && parts[3] === "complete")
        return success(
          await support.attachments.completeUpload({
            actor,
            attachmentId,
            conversationId,
          }),
        );
      if (method === "DELETE" && parts.length === 3) {
        await support.attachments.deletePending({
          actor,
          attachmentId,
          conversationId,
        });
        return success({ deleted: true });
      }
      if (method === "GET" && parts[3] === "download")
        return success(
          await support.attachments.getDownload({
            actor,
            attachmentId,
            conversationId,
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
    readonly attachments?: AttachmentConfig;
    readonly chatbot?: ChatbotConfig;
    readonly attachmentRateLimit?: (input: {
      readonly request: Request;
      readonly operation: "intent" | "complete";
    }) => Promise<boolean>;
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
    ...(config.attachments ? { attachments: config.attachments } : {}),
    ...(config.chatbot ? { chatbot: config.chatbot } : {}),
  });
}
