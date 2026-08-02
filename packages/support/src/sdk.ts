import {
  AddConversationTag,
  CompleteAttachmentUpload,
  CreateAttachmentUploadIntent,
  DeletePendingAttachment,
  GetAttachmentDownload,
  AddInternalNote,
  AssignConversation,
  ChangeConversationStatus,
  CreateConversation,
  ListAgentInbox,
  ListConversationMessages,
  ListCustomerConversations,
  MarkConversationAsSpam,
  RecordMessageRead,
  RemoveConversationTag,
  ReopenConversation,
  SendMessage,
  UpsertAgent,
  UpsertCustomer,
  UpsertVisitor,
  ArchiveKnowledgeArticle,
  CreateKnowledgeArticle,
  GetChatbotSession,
  ListChatbotTurns,
  ListKnowledgeArticles,
  PublishKnowledgeArticle,
  RequestChatbotHandoff,
  RestoreKnowledgeArticle,
  SendChatbotMessage,
  StartChatbotSession,
  UpdateKnowledgeArticle,
  type ApplicationDependencies,
  type ApplicationEvent,
} from "@crazyglegit/support-application";
import { DomainError, type Project } from "@crazyglegit/support-core";
import {
  agentIdentitySchema,
  customerIdentitySchema,
  DEFAULT_ATTACHMENT_MIME_TYPES,
  defineSupportConfig,
  visitorIdentitySchema,
  type SupportConfig,
} from "@crazyglegit/support-contracts";
import {
  configurationError,
  SupportKitError,
  toSupportKitError,
  unauthenticated,
} from "./errors.js";
import type {
  SupportCommittedEvent,
  HealthCheckResult,
  HealthStatus,
  SupportKit,
  SupportKitHealth,
} from "./types.js";

function randomId(): string {
  return globalThis.crypto.randomUUID();
}

async function within<TResult>(
  operation: Promise<TResult>,
  milliseconds: number,
): Promise<TResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("AI provider timeout."));
        }, milliseconds);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

type EventListener = (event: SupportCommittedEvent) => void | Promise<void>;

function publisher(config: SupportConfig, listeners: Set<EventListener>) {
  const realtime = config.realtime;
  return {
    publish: async (event: ApplicationEvent) => {
      const committed: SupportCommittedEvent = {
        eventId: event.id,
        eventType: event.type,
        ...(event.conversationId
          ? { conversationId: event.conversationId }
          : {}),
        occurredAt: event.occurredAt.toISOString(),
        data: event.data,
      };
      if (realtime)
        await realtime.publish(
          event.conversationId
            ? `conversation:${event.conversationId}`
            : `project:${event.projectId}`,
          {
            eventId: event.id,
            eventType: event.type,
            eventVersion: 1,
            projectId: event.projectId,
            ...(event.conversationId
              ? { conversationId: event.conversationId }
              : {}),
            occurredAt: committed.occurredAt,
            data: event.data,
          },
        );
      await Promise.all(
        [...listeners].map((listener) => Promise.resolve(listener(committed))),
      );
    },
  };
}

async function resolveProject(
  config: ReturnType<typeof defineSupportConfig>,
): Promise<Project> {
  const existing = await config.database.projects.findByKey(config.projectKey);
  if (existing) return existing;
  if (config.projectInitialization.mode === "require-existing")
    throw new DomainError("NOT_FOUND", "Support project was not found.");
  const now = new Date();
  const project: Project = {
    id: randomId(),
    projectKey: config.projectKey,
    name: config.projectInitialization.name,
    metadata: config.projectInitialization.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };
  try {
    return await config.database.projects.create(project);
  } catch (error) {
    if (error instanceof DomainError && error.code === "CONFLICT") {
      const concurrent = await config.database.projects.findByKey(
        config.projectKey,
      );
      if (concurrent) return concurrent;
    }
    throw error;
  }
}

interface HealthCapable {
  healthCheck?(): Promise<unknown>;
}
interface Disposable {
  dispose?(): Promise<void>;
}

async function adapterHealth(
  adapter: HealthCapable | undefined,
  optional: boolean,
): Promise<HealthCheckResult> {
  if (!adapter) return { status: optional ? "disabled" : "unhealthy" };
  if (!adapter.healthCheck)
    return { status: "unavailable", message: "No health check is exposed." };
  try {
    const result = await adapter.healthCheck();
    return typeof result === "object" &&
      result !== null &&
      "status" in result &&
      result.status === "unhealthy"
      ? {
          status: "unhealthy",
          message: "The adapter reported an unhealthy state.",
        }
      : { status: "healthy" };
  } catch {
    return { status: "unhealthy", message: "The adapter health check failed." };
  }
}

class ComposedSupportKit implements SupportKit {
  #disposed = false;
  readonly #config: ReturnType<typeof defineSupportConfig>;
  readonly #eventListeners = new Set<EventListener>();
  public readonly projectId: string;
  public readonly conversations: SupportKit["conversations"];
  public readonly messages: SupportKit["messages"];
  public readonly customers: SupportKit["customers"];
  public readonly agents: SupportKit["agents"];
  public readonly tags: SupportKit["tags"];
  public readonly knowledge: NonNullable<SupportKit["knowledge"]>;
  public readonly chatbot: NonNullable<SupportKit["chatbot"]>;
  public readonly attachments: SupportKit["attachments"];
  public readonly auth: SupportKit["auth"];
  public readonly events: SupportKit["events"];

  public constructor(
    config: ReturnType<typeof defineSupportConfig>,
    projectId: string,
  ) {
    this.#config = config;
    this.projectId = projectId;
    const eventPublisher = publisher(config, this.#eventListeners);
    const dependencies: ApplicationDependencies = {
      database: config.database,
      clock: { now: () => new Date() },
      ids: { generate: randomId },
      events: eventPublisher,
    };
    const useCases = {
      create: new CreateConversation(dependencies),
      send: new SendMessage(dependencies),
      note: new AddInternalNote(dependencies),
      assign: new AssignConversation(dependencies),
      status: new ChangeConversationStatus(dependencies),
      reopen: new ReopenConversation(dependencies),
      spam: new MarkConversationAsSpam(dependencies),
      customerList: new ListCustomerConversations(dependencies),
      inbox: new ListAgentInbox(dependencies),
      messageList: new ListConversationMessages(dependencies),
      read: new RecordMessageRead(dependencies),
      customer: new UpsertCustomer(dependencies),
      agent: new UpsertAgent(dependencies),
      visitor: new UpsertVisitor(dependencies),
      addTag: new AddConversationTag(dependencies),
      removeTag: new RemoveConversationTag(dependencies),
      knowledgeCreate: new CreateKnowledgeArticle(dependencies),
      knowledgeUpdate: new UpdateKnowledgeArticle(dependencies),
      knowledgeList: new ListKnowledgeArticles(dependencies),
    };
    const chatbotPolicy = {
      maximumChunks: config.chatbot?.retrieval.maximumChunks ?? 6,
      minimumScore: config.chatbot?.retrieval.minimumScore ?? 0.15,
      maximumChunkCharacters:
        config.chatbot?.retrieval.maximumChunkCharacters ?? 1200,
      overlapCharacters: config.chatbot?.retrieval.overlapCharacters ?? 120,
      maximumTurns: config.chatbot?.limits.messagesPerSession ?? 50,
      messagesPerMinute: config.chatbot?.limits.messagesPerMinute ?? 10,
      maximumInputCharacters:
        config.chatbot?.limits.maximumInputCharacters ?? 4000,
      maximumContextCharacters:
        config.chatbot?.limits.maximumContextCharacters ?? 12000,
      maximumOutputCharacters:
        config.chatbot?.limits.maximumOutputCharacters ?? 4000,
      allowHumanHandoff: config.chatbot?.behavior.allowHumanHandoff ?? true,
      showSources: config.chatbot?.behavior.showSources ?? true,
    };
    const chatbotEnabled =
      config.chatbot?.enabled === true || config.features?.chatbot === true;
    const chatbotAI = config.ai;
    const generateChatbotAnswer =
      chatbotAI?.generateChatbotAnswer?.bind(chatbotAI);
    const generateHandoffSummary =
      chatbotAI?.generateHandoffSummary?.bind(chatbotAI);
    const providerTimeoutMs =
      config.chatbot?.limits.providerTimeoutMs ?? 20_000;
    const chatbotDependencies =
      chatbotEnabled && generateChatbotAnswer
        ? {
            ...dependencies,
            chatbotPolicy,
            ai: {
              generateChatbotAnswer: (
                input: Parameters<NonNullable<typeof generateChatbotAnswer>>[0],
              ) => within(generateChatbotAnswer(input), providerTimeoutMs),
              ...(generateHandoffSummary
                ? {
                    generateHandoffSummary: (
                      input: Parameters<
                        NonNullable<typeof generateHandoffSummary>
                      >[0],
                    ) =>
                      within(generateHandoffSummary(input), providerTimeoutMs),
                  }
                : {}),
            },
          }
        : undefined;
    const knowledgePublish = config.database.knowledge
      ? new PublishKnowledgeArticle({ ...dependencies, chatbotPolicy })
      : undefined;
    const chatbotUseCases = chatbotDependencies
      ? {
          start: new StartChatbotSession(chatbotDependencies),
          get: new GetChatbotSession(dependencies),
          turns: new ListChatbotTurns(dependencies),
          send: new SendChatbotMessage(chatbotDependencies),
          handoff: new RequestChatbotHandoff(chatbotDependencies),
        }
      : undefined;
    const attachmentPolicy = config.attachments ?? {
      enabled: config.features?.attachments === true,
      maxFileSizeBytes: 26_214_400,
      maxFilesPerMessage: 5,
      allowedMimeTypes: [...DEFAULT_ATTACHMENT_MIME_TYPES],
      uploadUrlTtlSeconds: 300,
      downloadUrlTtlSeconds: 120,
      scanPolicy: "required" as const,
    };
    const attachmentDependencies = config.storage
      ? {
          ...dependencies,
          storage: config.storage,
          ...(config.attachmentScanner
            ? { scanner: config.attachmentScanner }
            : {}),
          policy: attachmentPolicy,
        }
      : undefined;
    const attachmentUseCases = attachmentDependencies
      ? {
          intent: new CreateAttachmentUploadIntent(attachmentDependencies),
          complete: new CompleteAttachmentUpload(attachmentDependencies),
          delete: new DeletePendingAttachment(attachmentDependencies),
          download: new GetAttachmentDownload(attachmentDependencies),
        }
      : undefined;
    this.conversations = {
      create: (input) =>
        this.run(() => useCases.create.execute({ ...input, projectId })),
      sendMessage: (input) =>
        this.run(() => useCases.send.execute({ ...input, projectId })),
      addInternalNote: (input) =>
        this.run(() => useCases.note.execute({ ...input, projectId })),
      assign: (input) =>
        this.run(() => useCases.assign.execute({ ...input, projectId })),
      changeStatus: (input) =>
        this.run(() => useCases.status.execute({ ...input, projectId })),
      reopen: (input) =>
        this.run(() => useCases.reopen.execute({ ...input, projectId })),
      markSpam: (input) =>
        this.run(() => useCases.spam.execute({ ...input, projectId })),
      listForCustomer: (input) =>
        this.run(() => useCases.customerList.execute({ ...input, projectId })),
      listInbox: (input) =>
        this.run(() => useCases.inbox.execute({ ...input, projectId })),
    };
    this.messages = {
      list: (input) =>
        this.run(() => useCases.messageList.execute({ ...input, projectId })),
      recordRead: (input) =>
        this.run(() => useCases.read.execute({ ...input, projectId })),
    };
    this.customers = {
      upsert: (input) =>
        this.run(() => useCases.customer.execute({ ...input, projectId })),
    };
    this.agents = {
      upsert: (input) =>
        this.run(() => useCases.agent.execute({ ...input, projectId })),
    };
    this.tags = {
      add: (input) =>
        this.run(() => useCases.addTag.execute({ ...input, projectId })),
      remove: (input) =>
        this.run(() => useCases.removeTag.execute({ ...input, projectId })),
    };
    const requireKnowledgePublish = () => {
      if (!knowledgePublish)
        throw new SupportKitError(
          "CHATBOT_DISABLED",
          "Knowledge publication is unavailable.",
        );
      return knowledgePublish;
    };
    this.knowledge = {
      create: (input) =>
        this.run(() =>
          useCases.knowledgeCreate.execute({
            ...input,
            tags: input.tags ?? [],
            projectId,
          }),
        ),
      update: (input) =>
        this.run(() =>
          useCases.knowledgeUpdate.execute({ ...input, projectId }),
        ),
      publish: (input) =>
        this.run(() =>
          requireKnowledgePublish().execute({ ...input, projectId }),
        ),
      archive: (input) =>
        this.run(() =>
          new ArchiveKnowledgeArticle(dependencies).execute({
            ...input,
            projectId,
          }),
        ),
      restore: (input) =>
        this.run(() =>
          new RestoreKnowledgeArticle(dependencies).execute({
            ...input,
            projectId,
          }),
        ),
      list: (input) =>
        this.run(() => useCases.knowledgeList.execute({ ...input, projectId })),
      revisions: (input) =>
        this.run(async () => {
          if (!config.database.knowledge)
            throw new SupportKitError(
              "KNOWLEDGE_UNAVAILABLE",
              "Knowledge is unavailable.",
            );
          return config.database.knowledge.listRevisions(
            projectId,
            input.articleId,
          );
        }),
    };
    const requireChatbot = () => {
      if (!chatbotUseCases)
        throw new SupportKitError(
          "CHATBOT_DISABLED",
          "The automated assistant is unavailable.",
        );
      return chatbotUseCases;
    };
    this.chatbot = {
      start: (input) =>
        this.run(() => requireChatbot().start.execute({ ...input, projectId })),
      get: (input) =>
        this.run(() => requireChatbot().get.execute({ ...input, projectId })),
      turns: (input) =>
        this.run(() => requireChatbot().turns.execute({ ...input, projectId })),
      send: (input) =>
        this.run(() => requireChatbot().send.execute({ ...input, projectId })),
      handoff: (input) =>
        this.run(() =>
          requireChatbot().handoff.execute({ ...input, projectId }),
        ),
    };
    const requireAttachmentUseCases = () => {
      if (!attachmentUseCases)
        throw new SupportKitError(
          "ATTACHMENTS_DISABLED",
          "Attachments are not available.",
        );
      return attachmentUseCases;
    };
    this.attachments = {
      createUploadIntent: (input) =>
        this.run(() =>
          requireAttachmentUseCases().intent.execute({ ...input, projectId }),
        ),
      completeUpload: (input) =>
        this.run(() =>
          requireAttachmentUseCases().complete.execute({ ...input, projectId }),
        ),
      deletePending: (input) =>
        this.run(() =>
          requireAttachmentUseCases().delete.execute({ ...input, projectId }),
        ),
      getDownload: (input) =>
        this.run(() =>
          requireAttachmentUseCases().download.execute({ ...input, projectId }),
        ),
    };
    this.auth = {
      resolveCustomer: (context) =>
        this.run(async () => {
          const raw = await config.auth.getCustomer(context);
          if (raw === null) throw unauthenticated("customer");
          const identity = customerIdentitySchema.safeParse(raw);
          if (!identity.success) {
            throw new SupportKitError(
              "VALIDATION_ERROR",
              "The customer identity is invalid.",
            );
          }
          const persisted = await useCases.customer.execute({
            projectId,
            externalCustomerId: identity.data.id,
            ...(identity.data.name ? { name: identity.data.name } : {}),
            ...(identity.data.email ? { email: identity.data.email } : {}),
            ...(identity.data.metadata
              ? { metadata: identity.data.metadata }
              : {}),
          });
          return { type: "customer" as const, id: persisted.id };
        }),
      resolveVisitor: (context) =>
        this.run(async () => {
          const raw = await config.auth.getVisitor(context);
          if (raw === null) throw unauthenticated("visitor");
          const identity = visitorIdentitySchema.safeParse(raw);
          if (!identity.success)
            throw new SupportKitError(
              "VALIDATION_ERROR",
              "The visitor identity is invalid.",
            );
          const persisted = await useCases.visitor.execute({
            projectId,
            externalVisitorId: identity.data.id,
            sessionId: identity.data.sessionId,
            ...(identity.data.name ? { name: identity.data.name } : {}),
            ...(identity.data.email ? { email: identity.data.email } : {}),
            ...(identity.data.metadata
              ? { metadata: identity.data.metadata }
              : {}),
          });
          return { type: "visitor" as const, id: persisted.id };
        }),
      resolveAgent: (context) =>
        this.run(async () => {
          const raw = await config.auth.getAgent(context);
          if (raw === null) throw unauthenticated("agent");
          const identity = agentIdentitySchema.safeParse(raw);
          if (!identity.success)
            throw new SupportKitError(
              "VALIDATION_ERROR",
              "The agent identity is invalid.",
            );
          const persisted = await useCases.agent.execute({
            projectId,
            externalAgentId: identity.data.id,
            name: identity.data.name,
            ...(identity.data.email ? { email: identity.data.email } : {}),
            role: identity.data.role,
            permissions: identity.data.permissions,
          });
          return {
            type: "agent" as const,
            id: persisted.id,
            role: persisted.role,
            permissions: persisted.permissions,
          };
        }),
    };
    this.events = {
      subscribe: (listener) => {
        if (this.#disposed)
          throw new SupportKitError(
            "SDK_DISPOSED",
            "The support SDK has been disposed.",
          );
        this.#eventListeners.add(listener);
        return () => this.#eventListeners.delete(listener);
      },
    };
  }

  private async run<TResult>(
    operation: () => Promise<TResult>,
  ): Promise<TResult> {
    if (this.#disposed)
      throw new SupportKitError(
        "SDK_DISPOSED",
        "The support SDK has been disposed.",
      );
    try {
      return await operation();
    } catch (error) {
      throw toSupportKitError(error);
    }
  }

  public healthCheck(): Promise<SupportKitHealth> {
    return this.run(async () => {
      const checks = {
        initialization: { status: "healthy" as const },
        project: (await this.#config.database.projects.findById(this.projectId))
          ? { status: "healthy" as const }
          : {
              status: "unhealthy" as const,
              message: "The resolved project no longer exists.",
            },
        database: await adapterHealth(this.#config.database, false),
        auth: await adapterHealth(this.#config.auth, false),
        realtime: await adapterHealth(this.#config.realtime, true),
        storage: await adapterHealth(this.#config.storage, true),
        notifications: await adapterHealth(this.#config.notifications, true),
        ai: await adapterHealth(this.#config.ai, true),
      };
      const values = Object.values(checks);
      const status: HealthStatus = values.some(
        (check) => check.status === "unhealthy",
      )
        ? "unhealthy"
        : values.some((check) => check.status === "unavailable")
          ? "degraded"
          : "healthy";
      return { status, projectId: this.projectId, checks };
    });
  }

  public async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#eventListeners.clear();
    if (this.#config.lifecycle.adapterOwnership !== "sdk") return;
    const adapters: readonly (Disposable | undefined)[] = [
      this.#config.database,
      this.#config.auth,
      this.#config.realtime,
      this.#config.storage,
      this.#config.attachmentScanner,
      this.#config.notifications,
      this.#config.ai,
    ];
    const unique = [
      ...new Set(
        adapters.filter((adapter): adapter is Disposable => Boolean(adapter)),
      ),
    ];
    const results = await Promise.allSettled(
      unique.map(async (adapter) => adapter.dispose?.()),
    );
    if (results.some((result) => result.status === "rejected"))
      throw new SupportKitError(
        "INTERNAL_ERROR",
        "Support adapter disposal failed.",
      );
  }
}

/** Validates configuration, resolves the project, and composes the public SDK. */
export async function createSupportKit(
  config: SupportConfig,
): Promise<SupportKit> {
  let validated: ReturnType<typeof defineSupportConfig>;
  try {
    validated = defineSupportConfig(config);
  } catch {
    throw configurationError("Support SDK configuration is invalid.");
  }
  try {
    const project = await resolveProject(validated);
    return new ComposedSupportKit(validated, project.id);
  } catch (error) {
    throw toSupportKitError(error);
  }
}
