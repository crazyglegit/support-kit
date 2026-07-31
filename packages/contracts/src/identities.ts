import { z } from "zod";
import { metadataSchema, identifierSchema } from "./shared.js";
import { permissionSchema } from "./enums.js";
const agentRoleSchema = z.enum([
  "support_admin",
  "support_supervisor",
  "support_agent",
  "support_viewer",
]);

const optionalEmailSchema = z.email().max(320).optional();
const optionalNameSchema = z.string().trim().min(1).max(200).optional();

/** Runtime schema for an authenticated host customer identity. */
export const customerIdentitySchema = z.strictObject({
  id: identifierSchema,
  name: optionalNameSchema,
  email: optionalEmailSchema,
  metadata: metadataSchema.optional(),
});

/** Runtime schema for an anonymous visitor identity from a verified session. */
export const visitorIdentitySchema = z.strictObject({
  id: identifierSchema,
  sessionId: identifierSchema,
  name: optionalNameSchema,
  email: optionalEmailSchema,
  metadata: metadataSchema.optional(),
});

/** Runtime schema for an authenticated support agent identity. */
export const agentIdentitySchema = z.strictObject({
  id: identifierSchema,
  name: z.string().trim().min(1).max(200),
  email: optionalEmailSchema,
  role: agentRoleSchema,
  permissions: z.array(permissionSchema).readonly(),
});

/** Validated customer identity supplied by a host auth adapter. */
export type CustomerIdentity = z.infer<typeof customerIdentitySchema>;
/** Validated anonymous visitor identity supplied by a host auth adapter. */
export type VisitorIdentity = z.infer<typeof visitorIdentitySchema>;
/** Validated support agent identity supplied by a host auth adapter. */
export type AgentIdentity = z.infer<typeof agentIdentitySchema>;
/** Public support customer identity name used by adapter APIs. */
export type SupportCustomerIdentity = CustomerIdentity;
/** Public support visitor identity name used by adapter APIs. */
export type SupportVisitorIdentity = VisitorIdentity;
/** Public support agent identity name used by adapter APIs. */
export type SupportAgentIdentity = AgentIdentity;
