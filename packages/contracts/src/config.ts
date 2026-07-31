import { z } from "zod";
import type {
  SupportAIAdapter,
  SupportAuthAdapter,
  SupportDatabaseAdapter,
  SupportNotificationAdapter,
  SupportRealtimeAdapter,
  SupportStorageAdapter,
} from "./adapters.js";
import { identifierSchema } from "./shared.js";

/** Runtime schema for customer widget configuration. */
export const widgetConfigSchema = z.strictObject({
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

/** Runtime schema for the serializable portion of support configuration. */
export const supportDeclarativeConfigSchema = z.strictObject({
  projectId: identifierSchema,
  widget: widgetConfigSchema.optional(),
  features: featureFlagsSchema.optional(),
  security: securityConfigSchema,
});

/** Runtime schema for the serializable portion of support configuration. */
export const supportConfigSchema = supportDeclarativeConfigSchema;

/** Customer widget configuration. */
export type WidgetConfig = z.infer<typeof widgetConfigSchema>;
/** Customer widget configuration using the blueprint's public name. */
export type SupportWidgetConfig = WidgetConfig;
/** Stable optional feature switches. */
export type FeatureFlags = z.infer<typeof featureFlagsSchema>;
/** Declarative security configuration. */
export type SecurityConfig = z.infer<typeof securityConfigSchema>;
/** Serializable support configuration validated by Zod. */
export type SupportDeclarativeConfig = z.infer<
  typeof supportDeclarativeConfigSchema
>;

/** Complete provider-independent support configuration. */
export interface SupportConfig extends SupportDeclarativeConfig {
  readonly auth: SupportAuthAdapter;
  readonly database: SupportDatabaseAdapter;
  readonly realtime: SupportRealtimeAdapter;
  readonly storage?: SupportStorageAdapter;
  readonly notifications?: SupportNotificationAdapter;
  readonly ai?: SupportAIAdapter;
}

/** Validates declarative settings while preserving typed adapter instances. */
export function defineSupportConfig(config: SupportConfig): SupportConfig {
  const declarative = supportDeclarativeConfigSchema.parse({
    projectId: config.projectId,
    widget: config.widget,
    features: config.features,
    security: config.security,
  });

  return { ...config, ...declarative };
}
