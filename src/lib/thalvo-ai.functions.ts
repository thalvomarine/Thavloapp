import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createThalvoAiProvider } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CAPTAIN_MODEL_DEFAULT,
  rankNearbyPoints,
  runCaptainConsultation,
} from "@/lib/aiCaptainService";
import { answerFromTraining } from "@/lib/thalvo-ai/domain";
import type { CaptainCockpitContext, NearbyChartPoint } from "@/lib/ai-captain-types";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

const ContextSchema = z.object({
  position: z
    .object({
      lat: z.number(),
      lng: z.number(),
      source: z.enum(["gps", "chart"]),
    })
    .nullable(),
  selectedBay: z
    .object({
      name: z.string(),
      kind: z.string(),
      depthM: z.number().nullable(),
      seabed: z.string().nullable(),
      protection: z.string().nullable(),
      lat: z.number(),
      lng: z.number(),
    })
    .nullable(),
  weather: z
    .object({
      windKts: z.number(),
      windDeg: z.number(),
      windFrom: z.string(),
      waveM: z.number().nullable(),
      pressureHpa: z.number(),
    })
    .nullable(),
  vessel: z
    .object({
      name: z.string().nullable(),
      type: z.string().nullable(),
      lengthM: z.number().nullable(),
      draftM: z.number().nullable(),
      engine: z.string().nullable(),
    })
    .nullable(),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(16),
  lang: z.enum(["tr", "en"]).default("tr"),
  context: ContextSchema.optional(),
});

const AI_WINDOW_MS = 10 * 60 * 1000;
const AI_MAX_IN_WINDOW = 8;
const recentAiCalls = new Map<string, number[]>();

function allowLocalAiQuota(userId: string): boolean {
  const now = Date.now();
  const stamps = (recentAiCalls.get(userId) ?? []).filter((t) => now - t < AI_WINDOW_MS);
  if (stamps.length >= AI_MAX_IN_WINDOW) {
    recentAiCalls.set(userId, stamps);
    return false;
  }
  stamps.push(now);
  recentAiCalls.set(userId, stamps);
  return true;
}

function emptyContext(): CaptainCockpitContext {
  return { position: null, selectedBay: null, weather: null, vessel: null };
}

export const askThalvoAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const messages = data.messages.slice(-12);
    const totalChars = messages.reduce((sum, message) => sum + message.content.length, 0);
    if (totalChars > 12000) throw new Error("ai_too_long");
    const key = (process.env.THALVO_AI_API_KEY ?? process.env.LOVABLE_API_KEY ?? "").trim();
    const lastUser = [...messages].reverse().find((message) => message.role === "user");
    if (!key) {
      const trained = await answerFromTraining({
        text: lastUser?.content ?? "",
        lang: data.lang,
        position: data.context?.position ?? null,
      });
      return { text: trained.text, emergency: trained.emergency, actions: [] };
    }
    if (!allowLocalAiQuota(context.userId)) throw new Error("ai_rate_limited");
    const quota = await context.supabase.rpc("consume_captain_ai_quota");
    if (quota.error && /ai_rate_limited/i.test(quota.error.message)) {
      throw new Error("ai_rate_limited");
    }
    const gateway = createThalvoAiProvider(key);
    const modelId = process.env.THALVO_AI_MODEL ?? CAPTAIN_MODEL_DEFAULT;
    const model = gateway(modelId);

    const cockpit = data.context ?? emptyContext();
    if (!cockpit.vessel) {
      const { data: vessel } = await context.supabase
        .from("vessels")
        .select("name, vessel_type, length_m, engine_model")
        .eq("owner_id", context.userId)
        .limit(1)
        .maybeSingle();
      if (vessel) {
        cockpit.vessel = {
          name: vessel.name ?? null,
          type: vessel.vessel_type ?? null,
          lengthM: vessel.length_m == null ? null : Number(vessel.length_m),
          draftM: null,
          engine: vessel.engine_model ?? null,
        };
      }
    }

    let nearby: NearbyChartPoint[] = [];
    const { data: zones } = await context.supabase
      .from("marine_zones")
      .select("name, kind, lat, lng, depth_m, metadata")
      .eq("active", true)
      .limit(80);
    nearby = rankNearbyPoints(
      (zones ?? []).map((z) => {
        const meta = (z.metadata ?? {}) as { bottom?: string; protection?: string };
        return {
          name: z.name,
          kind: z.kind,
          lat: Number(z.lat),
          lng: Number(z.lng),
          depthM: z.depth_m == null ? null : Number(z.depth_m),
          seabed: typeof meta.bottom === "string" ? meta.bottom : null,
          protection: typeof meta.protection === "string" ? meta.protection : null,
          rangeNm: null,
        };
      }),
      cockpit.position,
    );

    return runCaptainConsultation({
      model,
      messages,
      context: cockpit,
      nearby,
      lang: data.lang,
    });
  });
