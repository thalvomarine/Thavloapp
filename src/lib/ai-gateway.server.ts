import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * OpenAI-compatible chat provider. Endpoint and key come from env so the
 * client never embeds a vendor SDK or editor badge.
 */
export function createThalvoAiProvider(apiKey: string) {
  const baseURL = process.env.THALVO_AI_BASE_URL ?? "https://ai.gateway.lovable.dev/v1";
  return createOpenAICompatible({
    name: "thalvo-ai",
    baseURL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Lovable-API-Key": apiKey,
    },
  });
}
