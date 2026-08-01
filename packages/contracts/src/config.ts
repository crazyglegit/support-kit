import { z } from "zod";
import type {
  SupportAIAdapter,
  SupportAuthAdapter,
  SupportDatabaseAdapter,
  SupportNotificationAdapter,
  SupportRealtimeAdapter,
  SupportStorageAdapter,
} from "./adapters.js";
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
  security: securityConfigSchema,
  lifecycle: lifecycleConfigSchema.default({ adapterOwnership: "host" }),
});

/** Runtime schema for the serializable portion of support configuration. */
export const supportConfigSchema = supportDeclarativeConfigSchema;

export type WidgetConfig = z.infer<typeof widgetConfigSchema>;
export type SupportWidgetConfig = WidgetConfig;
export type FeatureFlags = z.infer<typeof featureFlagsSchema>;
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
  readonly notifications?: SupportNotificationAdapter;
  readonly ai?: SupportAIAdapter;
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
    security: config.security,
    lifecycle: config.lifecycle,
  });
  if (declarative.features?.attachments && !config.storage)
    throw new Error("Attachment features require a storage adapter.");
  if (declarative.features?.attachments && !declarative.security.maxUploadBytes)
    throw new Error("Attachment features require security.maxUploadBytes.");
  if (declarative.features?.aiWriting && !config.ai)
    throw new Error("AI writing requires an AI adapter.");
  return { ...config, ...declarative };
}
