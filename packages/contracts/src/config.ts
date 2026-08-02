import { z } from "zod";
import type {
  AttachmentScannerAdapter,
  SupportAIAdapter,
  SupportAuthAdapter,
  SupportDatabaseAdapter,
  SupportNotificationAdapter,
  SupportRealtimeAdapter,
  SupportStorageAdapter,
  EmbeddingAdapter,
} from "./adapters.js";
import { DEFAULT_ATTACHMENT_MIME_TYPES } from "./attachments.js";
import { identifierSchema, metadataSchema } from "./shared.js";

/** Runtime schema for customer widget configuration. */
export const widgetConfigSchema = z.strictObject({
  title: z.string().trim().min(1).max(100).optional(),
  position: z.enum(["bottom-left", "bottom-right"]).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  greeting: z.string().trim().min(1).max(500).optional(),
  launcherLabel: z.string().trim().min(1).max(100).optional(),
  locale: z.string().trim().min(2).max(35).optional(),
  allowAttachments: z.boolean().optional(),
  allowAnonymousVisitors: z.boolean().optional(),
  showKnowledgeSearch: z.boolean().optional(),
});

/** Runtime schema for stable optional feature switches. */
export const featureFlagsSchema = z.strictObject({
  attachments: z.boolean().optional(),
  chatbot: z.boolean().optional(),
  aiWriting: z.boolean().optional(),
});

export const attachmentConfigSchema = z.strictObject({
  enabled: z.boolean().default(false),
  maxFileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(104_857_600)
    .default(26_214_400),
  maxFilesPerMessage: z.number().int().min(1).max(10).default(5),
  allowedMimeTypes: z
    .array(z.string().min(1).max(127))
    .min(1)
    .max(32)
    .default([...DEFAULT_ATTACHMENT_MIME_TYPES]),
  uploadUrlTtlSeconds: z.number().int().min(30).max(900).default(300),
  downloadUrlTtlSeconds: z.number().int().min(30).max(900).default(120),
  scanPolicy: z.enum(["required", "optional", "disabled"]).default("required"),
});

export const chatbotConfigSchema = z.strictObject({
  enabled: z.boolean().default(false),
  retrieval: z
    .strictObject({
      mode: z.enum(["lexical", "semantic", "hybrid"]).default("lexical"),
      maximumChunks: z.number().int().min(1).max(20).default(8),
      minimumScore: z.number().min(0).max(1).default(0.68),
      maximumChunkCharacters: z.number().int().min(200).max(8000).default(1600),
      overlapCharacters: z.number().int().min(0).max(1000).default(200),
    })
    .default({
      mode: "lexical",
      maximumChunks: 8,
      minimumScore: 0.68,
      maximumChunkCharacters: 1600,
      overlapCharacters: 200,
    }),
  behavior: z
    .strictObject({
      allowHumanHandoff: z.boolean().default(true),
      maximumConversationTurns: z.number().int().min(1).max(100).default(30),
      showSources: z.boolean().default(true),
    })
    .default({
      allowHumanHandoff: true,
      maximumConversationTurns: 30,
      showSources: true,
    }),
  limits: z
    .strictObject({
      messagesPerMinute: z.number().int().min(1).max(120).default(10),
      messagesPerSession: z.number().int().min(1).max(1000).default(100),
      maximumInputCharacters: z.number().int().min(1).max(20_000).default(4000),
      maximumContextCharacters: z
        .number()
        .int()
        .min(1000)
        .max(100_000)
        .default(24_000),
      maximumOutputCharacters: z
        .number()
        .int()
        .min(200)
        .max(20_000)
        .default(6000),
      providerTimeoutMs: z
        .number()
        .int()
        .min(1000)
        .max(120_000)
        .default(20_000),
    })
    .default({
      messagesPerMinute: 10,
      messagesPerSession: 100,
      maximumInputCharacters: 4000,
      maximumContextCharacters: 24_000,
      maximumOutputCharacters: 6000,
      providerTimeoutMs: 20_000,
    }),
});

const originSchema = z
  .url()
  .refine((value) => new URL(value).origin === value, {
    message: "Allowed origins must contain only a URL origin.",
  });

/** Runtime schema for declarative security limits. */
export const securityConfigSchema = z.strictObject({
  allowedOrigins: z.array(originSchema).min(1).readonly(),
  maxUploadBytes: z.number().int().positive().max(104_857_600).optional(),
});

/** Runtime schema for explicit project provisioning behavior. */
export const projectInitializationPolicySchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("require-existing") }),
  z.strictObject({
    mode: z.literal("create-if-missing"),
    name: z.string().trim().min(1).max(200),
    metadata: metadataSchema.optional(),
  }),
]);

/** Runtime schema controlling ownership of configured adapter lifecycles. */
export const lifecycleConfigSchema = z.strictObject({
  adapterOwnership: z.enum(["host", "sdk"]).default("host"),
});

/** Runtime schema for the serializable portion of support configuration. */
export const supportDeclarativeConfigSchema = z.strictObject({
  projectKey: identifierSchema.regex(
    /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,126}[A-Za-z0-9])?$/,
    "Project key must contain only letters, numbers, dots, underscores, or hyphens.",
  ),
  projectInitialization: projectInitializationPolicySchema.default({
    mode: "require-existing",
  }),
  widget: widgetConfigSchema.optional(),
  features: featureFlagsSchema.optional(),
  attachments: attachmentConfigSchema.optional(),
  chatbot: chatbotConfigSchema.optional(),
  security: securityConfigSchema,
  lifecycle: lifecycleConfigSchema.default({ adapterOwnership: "host" }),
});

/** Runtime schema for the serializable portion of support configuration. */
export const supportConfigSchema = supportDeclarativeConfigSchema;

export type WidgetConfig = z.infer<typeof widgetConfigSchema>;
export type SupportWidgetConfig = WidgetConfig;
export type FeatureFlags = z.infer<typeof featureFlagsSchema>;
export type AttachmentConfig = z.infer<typeof attachmentConfigSchema>;
export type ChatbotConfig = z.infer<typeof chatbotConfigSchema>;
export type SecurityConfig = z.infer<typeof securityConfigSchema>;
export type ProjectInitializationPolicy = z.infer<
  typeof projectInitializationPolicySchema
>;
export type LifecycleConfig = z.infer<typeof lifecycleConfigSchema>;
export type SupportDeclarativeConfig = z.infer<
  typeof supportDeclarativeConfigSchema
>;

/** Complete provider-independent support configuration. */
export interface SupportConfig extends Omit<
  SupportDeclarativeConfig,
  "projectInitialization" | "lifecycle"
> {
  readonly projectInitialization?: ProjectInitializationPolicy;
  readonly lifecycle?: Partial<LifecycleConfig>;
  readonly auth: SupportAuthAdapter;
  readonly database: SupportDatabaseAdapter;
  readonly realtime?: SupportRealtimeAdapter;
  readonly storage?: SupportStorageAdapter;
  readonly attachmentScanner?: AttachmentScannerAdapter;
  readonly notifications?: SupportNotificationAdapter;
  readonly ai?: SupportAIAdapter;
  readonly embeddings?: EmbeddingAdapter;
}

/** Validates declarative settings while preserving typed adapter instances. */
export function defineSupportConfig<TConfig extends SupportConfig>(
  config: TConfig,
): TConfig & SupportDeclarativeConfig {
  const declarative = supportDeclarativeConfigSchema.parse({
    projectKey: config.projectKey,
    projectInitialization: config.projectInitialization,
    widget: config.widget,
    features: config.features,
    attachments: config.attachments,
    chatbot: config.chatbot,
    security: config.security,
    lifecycle: config.lifecycle,
  });
  const attachmentsEnabled =
    declarative.attachments?.enabled === true ||
    declarative.features?.attachments === true;
  if (attachmentsEnabled && !config.storage)
    throw new Error("Attachment features require a storage adapter.");
  if (
    attachmentsEnabled &&
    declarative.attachments?.scanPolicy !== "disabled" &&
    !config.attachmentScanner
  )
    throw new Error(
      "Attachment scan policy requires an attachment scanner adapter.",
    );
  if (declarative.features?.aiWriting && !config.ai)
    throw new Error("AI writing requires an AI adapter.");
  const chatbotEnabled =
    declarative.chatbot?.enabled === true ||
    declarative.features?.chatbot === true;
  if (chatbotEnabled && !config.ai?.generateChatbotAnswer)
    throw new Error("Chatbot requires a chatbot generation adapter.");
  if (
    chatbotEnabled &&
    declarative.chatbot?.retrieval.mode !== "lexical" &&
    !config.embeddings
  )
    throw new Error(
      "Semantic chatbot retrieval requires an embeddings adapter.",
    );
  return { ...config, ...declarative };
}
