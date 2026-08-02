import { z } from "zod";
import { identifierSchema, isoTimestampSchema } from "./shared.js";

export const knowledgeArticleStatusSchema = z.enum([
  "draft",
  "published",
  "archived",
]);
export const knowledgeArticleInputSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  sourceKey: z
    .string()
    .trim()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,126}[a-z0-9])?$/u),
  summary: z.string().trim().max(1000).default(""),
  body: z.string().trim().min(1).max(200_000),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
});
export const knowledgeArticlePatchSchema = knowledgeArticleInputSchema
  .partial()
  .strict();
export const publicKnowledgeArticleSchema = knowledgeArticleInputSchema.extend({
  id: identifierSchema,
  status: knowledgeArticleStatusSchema,
  revisionNumber: z.number().int().nonnegative(),
  activeRevisionNumber: z.number().int().positive().optional(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
  publishedAt: isoTimestampSchema.optional(),
  archivedAt: isoTimestampSchema.optional(),
});
export const chatbotCitationSchema = z.strictObject({
  sourceKey: identifierSchema,
  articleTitle: z.string().min(1).max(200),
  section: z.string().max(200).optional(),
  excerpt: z.string().max(400).optional(),
  publicUrl: z.url().optional(),
});
export const chatbotTurnSchema = z.strictObject({
  id: identifierSchema,
  actorType: z.enum(["customer", "visitor", "bot"]),
  content: z.string().max(20_000),
  citations: z.array(chatbotCitationSchema).max(12),
  outcome: z.enum(["answered", "insufficient_knowledge", "ai_failed"]),
  createdAt: isoTimestampSchema,
});
export const chatbotSessionSchema = z.strictObject({
  id: identifierSchema,
  status: z.enum(["active", "handed_off"]),
  conversationId: identifierSchema.optional(),
  turnCount: z.number().int().nonnegative(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});
export const chatbotMessageInputSchema = z.strictObject({
  message: z.string().trim().min(1).max(4000),
  clientMessageId: identifierSchema,
});
export const chatbotHandoffInputSchema = z.strictObject({
  reason: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .default("Customer requested human support."),
});
export const chatbotGenerationOutputSchema = z.strictObject({
  answer: z.string().trim().min(1).max(20_000),
  citedSourceKeys: z.array(identifierSchema).max(12),
  shouldEscalate: z.boolean(),
  escalationReason: z.string().trim().max(500).optional(),
  modelReference: z.string().trim().max(200).optional(),
});

export type KnowledgeArticleStatus = z.infer<
  typeof knowledgeArticleStatusSchema
>;
export type KnowledgeArticleInput = z.infer<typeof knowledgeArticleInputSchema>;
export type PublicKnowledgeArticle = z.infer<
  typeof publicKnowledgeArticleSchema
>;
export type ChatbotCitation = z.infer<typeof chatbotCitationSchema>;
export type PublicChatbotTurn = z.infer<typeof chatbotTurnSchema>;
export type PublicChatbotSession = z.infer<typeof chatbotSessionSchema>;
export type ChatbotGenerationOutput = z.infer<
  typeof chatbotGenerationOutputSchema
>;
