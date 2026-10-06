import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runEmbeddedTurn } from "@/lib/thalvo-ai/embedded-turn";
import { listSessionLines } from "@/lib/thalvo-ai/memory-store";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const AskSchema = z.object({
  sessionId: z.string().regex(UUID_RE),
  lang: z.enum(["tr", "en"]).default("tr"),
  position: z
    .object({
      lat: z.number().finite(),
      lng: z.number().finite(),
    })
    .nullable()
    .optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().max(4000),
      }),
    )
    .min(1)
    .max(16),
  image: z
    .object({
      mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
      dataUrl: z.string().max(6_000_000),
    })
    .optional(),
});

const HistorySchema = z.object({
  sessionId: z.string().regex(UUID_RE),
});

/** In-app chief engineer. Same auth channel as the rest of THALVO AI. */
export const askThalvoChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AskSchema.parse(data))
  .handler(async ({ data, context }) => {
    const messages = data.messages.filter((message) => message.content.length > 0 || message.role === "user");
    return runEmbeddedTurn({
      supabase: context.supabase,
      userId: context.userId,
      sessionId: data.sessionId,
      lang: data.lang,
      position: data.position ?? null,
      messages,
      image: data.image,
    });
  });

export const loadThalvoChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => HistorySchema.parse(data))
  .handler(async ({ data, context }) => {
    const messages = await listSessionLines(context.supabase, context.userId, data.sessionId);
    return { messages };
  });
