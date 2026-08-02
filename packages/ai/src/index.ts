/** Package boundary for provider-independent AI integrations. */
export const SUPPORT_AI_PACKAGE = "@crazyglegit/support-ai" as const;

import {
  chatbotGenerationOutputSchema,
  type ChatbotGenerationInput,
  type ChatbotGenerationResult,
  type ChatbotHandoffSummaryInput,
  type ChatbotHandoffSummaryResult,
  type SupportAIDraftInput,
  type SupportAIDraftResult,
  type SupportAIAdapter,
} from "@crazyglegit/support-contracts";

/** Provider-neutral implementation contract. Providers receive bounded, preselected context only. */
export interface ChatbotProvider {
  generateDraft(input: SupportAIDraftInput): Promise<SupportAIDraftResult>;
  generateAnswer(input: ChatbotGenerationInput): Promise<unknown>;
  generateHandoffSummary?(input: ChatbotHandoffSummaryInput): Promise<unknown>;
}

function handoffOutput(value: unknown): ChatbotHandoffSummaryResult {
  if (typeof value !== "object" || value === null)
    throw new Error("AI handoff response is invalid.");
  const record = value as Readonly<Record<string, unknown>>;
  if (
    typeof record.summary !== "string" ||
    !Array.isArray(record.unresolvedQuestions) ||
    !record.unresolvedQuestions.every((item) => typeof item === "string")
  )
    throw new Error("AI handoff response is invalid.");
  return {
    summary: record.summary.slice(0, 2_000),
    unresolvedQuestions: record.unresolvedQuestions.slice(0, 10),
  };
}

/** Wraps a provider with strict response validation and a deliberately narrow adapter surface. */
export function createChatbotAIAdapter(
  provider: ChatbotProvider,
): SupportAIAdapter {
  const generateHandoffSummary =
    provider.generateHandoffSummary?.bind(provider);
  return {
    generateDraft: (input) => provider.generateDraft(input),
    generateChatbotAnswer: async (input): Promise<ChatbotGenerationResult> => {
      const parsed = chatbotGenerationOutputSchema.safeParse(
        await provider.generateAnswer(input),
      );
      if (!parsed.success) throw new Error("AI chatbot response is invalid.");
      return {
        answer: parsed.data.answer,
        citedSourceKeys: parsed.data.citedSourceKeys,
        shouldEscalate: parsed.data.shouldEscalate,
        ...(parsed.data.escalationReason
          ? { escalationReason: parsed.data.escalationReason }
          : {}),
        ...(parsed.data.modelReference
          ? { modelReference: parsed.data.modelReference }
          : {}),
      };
    },
    ...(generateHandoffSummary
      ? {
          generateHandoffSummary: async (input: ChatbotHandoffSummaryInput) =>
            handoffOutput(await generateHandoffSummary(input)),
        }
      : {}),
  };
}
