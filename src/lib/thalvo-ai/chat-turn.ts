import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  tool,
  type FileUIPart,
  type TextUIPart,
  type UIMessage,
} from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { createThalvoAiProvider } from "@/lib/ai-gateway.server";
import {
  CAPTAIN_MODEL_DEFAULT,
  createCaptainTools,
  formatCockpitBlock,
  rankNearbyPoints,
} from "@/lib/aiCaptainService";
import type { CaptainCockpitContext, NearbyChartPoint } from "@/lib/ai-captain-types";
import { fetchMarineWeather } from "@/lib/thalvo-ai/marine-weather";
import { listSessionLines, loadMemoryBlock, rememberFact, saveChatLine } from "@/lib/thalvo-ai/memory-store";
import { platformRouteCatalog, resolvePlatformRoute } from "@/lib/thalvo-ai/platform-routes";
import { authenticateRequest, isAuthed, jsonError } from "@/lib/thalvo-ai/request-auth";
import { buildChiefEngineerPrompt } from "@/lib/thalvo-ai/system-prompt";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_CHARS = 7_000_000;
const AI_WINDOW_MS = 10 * 60 * 1000;
const AI_MAX_IN_WINDOW = 8;
const recentCalls = new Map<string, number[]>();

const BodySchema = z.object({
  messages: z.array(z.unknown()).min(1).max(24),
  sessionId: z.string().regex(UUID_RE),
  lang: z.enum(["tr", "en"]).optional(),
  position: z
    .object({
      lat: z.number().finite(),
      lng: z.number().finite(),
    })
    .nullable()
    .optional(),
});

/**
 * HTTP entry for THALVO AI. Wired from the TanStack server at POST/GET /api/chat.
 * This project is TanStack Start, so the handler lives here rather than in a
 * Next.js app/api route.
 */
export async function handleChatRequest(request: Request): Promise<Response> {
  if (request.method === "GET") return handleGet(request);
  if (request.method === "POST") return handlePost(request);
  return jsonError(405, "method_not_allowed");
}

async function handleGet(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (!isAuthed(auth)) return auth;
  const sessionId = new URL(request.url).searchParams.get("sessionId") ?? "";
  if (!UUID_RE.test(sessionId)) return jsonError(400, "invalid_session");
  const lines = await listSessionLines(auth.supabase, auth.userId, sessionId);
  const messages: UIMessage[] = lines.map((line) => ({
    id: line.id,
    role: line.role,
    parts: [{ type: "text", text: line.content }],
  }));
  return new Response(JSON.stringify({ messages }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function handlePost(request: Request): Promise<Response> {
  const auth = await authenticateRequest(request);
  if (!isAuthed(auth)) return auth;

  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return jsonError(400, "invalid_body");
  }
  if (raw.length > MAX_BODY_CHARS) return jsonError(413, "payload_too_large");

  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(JSON.parse(raw));
  } catch {
    return jsonError(400, "invalid_body");
  }

  const lang = parsed.lang ?? "tr";
  const uiMessages = sanitizeMessages(parsed.messages);
  if (uiMessages.length === 0 || uiMessages.at(-1)?.role !== "user") {
    return jsonError(400, "expected_user_message");
  }
  const totalChars = uiMessages.reduce((sum, message) => sum + textOf(message).length, 0);
  if (totalChars > 12000) return jsonError(400, "ai_too_long");

  const apiKey = (process.env.THALVO_AI_API_KEY ?? process.env.LOVABLE_API_KEY ?? "").trim();
  if (!apiKey) {
    console.error("[thalvo-ai] missing THALVO_AI_API_KEY");
    return jsonError(503, "ai_not_configured");
  }
  if (!allowLocalQuota(auth.userId)) return jsonError(429, "ai_rate_limited");
  const quota = await auth.supabase.rpc("consume_captain_ai_quota");
  if (quota.error && /ai_rate_limited/i.test(quota.error.message)) {
    return jsonError(429, "ai_rate_limited");
  }

  const position = validPosition(parsed.position ?? null);
  const userText = textOf(uiMessages.at(-1)!);
  const storedUser = userText || (hasImage(uiMessages.at(-1)!) ? "[photo]" : "");
  await saveChatLine(auth.supabase, auth.userId, parsed.sessionId, "user", storedUser);

  const [memoryBlock, cockpit] = await Promise.all([
    loadMemoryBlock(auth.supabase, auth.userId, userText).catch((error: unknown) => {
      console.error("[thalvo-ai] memory", error instanceof Error ? error.name : "error");
      return "=== MEMORIES ===\n(unavailable)\n=== END MEMORY ===";
    }),
    loadCockpit(auth.supabase, auth.userId, position),
  ]);
  const nearby = await loadNearby(auth.supabase, position);
  const system = buildChiefEngineerPrompt(
    lang,
    memoryBlock,
    formatCockpitBlock(cockpit, nearby, lang),
  );

  const tools = {
    getMarineWeather: tool({
      description:
        "Live marine weather and sea state for one position. Returns wind knots, gusts, wave height, swell, and a storm band. Quote these numbers. Do not invent weather.",
      inputSchema: z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      }),
      execute: async ({ lat, lng }) => {
        try {
          return await fetchMarineWeather(lat, lng);
        } catch (error) {
          console.error("[thalvo-ai] weather", error instanceof Error ? error.name : "error");
          return { ok: false as const, error: "weather_unavailable" };
        }
      },
    }),
    navigateToPage: tool({
      description: `Open a THALVO page for the captain when they are lost in the product. Allowed routes:\n${platformRouteCatalog()}`,
      inputSchema: z.object({
        targetRoute: z.string().max(120),
      }),
      execute: async ({ targetRoute }) => {
        const route = resolvePlatformRoute(targetRoute);
        if (!route) return { ok: false as const, error: "unknown_route" };
        return { ok: true as const, route, redirect: true as const };
      },
    }),
    rememberFact: tool({
      description:
        "Save a durable boat, engine, serial, or preference for this captain. Do not save passwords, card numbers, or one-off questions.",
      inputSchema: z.object({
        memoryText: z.string().min(1).max(500),
        boatBrand: z.string().max(80).optional(),
        engineBrand: z.string().max(80).optional(),
        engineModel: z.string().max(80).optional(),
        serialNumber: z.string().max(64).optional(),
      }),
      execute: async ({ memoryText, boatBrand, engineBrand, engineModel, serialNumber }) =>
        rememberFact(auth.supabase, auth.userId, memoryText, {
          boatBrand: boatBrand ?? null,
          engineBrand: engineBrand ?? null,
          engineModel: engineModel ?? null,
          serialNumber: serialNumber ?? null,
        }),
    }),
    ...createCaptainTools(nearby),
  };

  let modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>;
  try {
    modelMessages = await convertToModelMessages(uiMessages, { tools });
  } catch (error) {
    console.error("[thalvo-ai] messages", error instanceof Error ? error.name : "error");
    return jsonError(400, "invalid_messages");
  }

  const modelId = process.env.THALVO_AI_MODEL ?? CAPTAIN_MODEL_DEFAULT;
  const result = streamText({
    model: createThalvoAiProvider(apiKey)(modelId),
    system,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(5),
    abortSignal: request.signal,
    onError: ({ error }) => {
      const message = error instanceof Error ? error.message : "error";
      console.error("[thalvo-ai] stream", message.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 240));
    },
  });

  return createUIMessageStreamResponse({
    headers: { "cache-control": "no-store" },
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      originalMessages: uiMessages,
      onError: () => "chat_interrupted",
      onEnd: ({ messages, isAborted }) => {
        if (isAborted) return;
        const last = [...messages].reverse().find((message) => message.role === "assistant");
        if (!last) return;
        void saveChatLine(auth.supabase, auth.userId, parsed.sessionId, "assistant", textOf(last));
      },
    }),
  });
}

function allowLocalQuota(userId: string): boolean {
  const now = Date.now();
  const stamps = (recentCalls.get(userId) ?? []).filter((stamp) => now - stamp < AI_WINDOW_MS);
  if (stamps.length >= AI_MAX_IN_WINDOW) {
    recentCalls.set(userId, stamps);
    return false;
  }
  stamps.push(now);
  recentCalls.set(userId, stamps);
  return true;
}

function sanitizeMessages(raw: unknown[]): UIMessage[] {
  const cleaned: UIMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as { id?: unknown; role?: unknown; parts?: unknown; content?: unknown };
    if (record.role !== "user" && record.role !== "assistant") continue;
    const parts = collectParts(record);
    if (parts.length === 0) continue;
    cleaned.push({
      id: typeof record.id === "string" && record.id.length > 0 && record.id.length < 80 ? record.id : crypto.randomUUID(),
      role: record.role,
      parts,
    });
  }
  const sliced = cleaned.slice(-12);
  return sliced.map((message, index) => {
    const isLast = index === sliced.length - 1;
    const parts = message.parts.filter((part) => {
      if (part.type === "text") return true;
      return isLast && message.role === "user" && part.type === "file";
    });
    const images = parts.filter((part) => part.type === "file").slice(0, 2);
    const texts = parts.filter((part) => part.type === "text");
    return { ...message, parts: [...texts, ...images] };
  }).filter((message) => message.parts.length > 0);
}

function collectParts(record: { parts?: unknown; content?: unknown }): Array<TextUIPart | FileUIPart> {
  const parts: Array<TextUIPart | FileUIPart> = [];
  if (Array.isArray(record.parts)) {
    for (const part of record.parts) {
      if (!part || typeof part !== "object") continue;
      const candidate = part as { type?: unknown; text?: unknown; mediaType?: unknown; url?: unknown };
      if (candidate.type === "text" && typeof candidate.text === "string") {
        const text = candidate.text.replace(/\u0000/g, "").trim().slice(0, 4000);
        if (text) parts.push({ type: "text", text });
        continue;
      }
      if (candidate.type === "file") {
        const image = acceptImage(candidate.mediaType, candidate.url);
        if (image) parts.push(image);
      }
    }
  }
  if (parts.length === 0 && typeof record.content === "string") {
    const text = record.content.replace(/\u0000/g, "").trim().slice(0, 4000);
    if (text) parts.push({ type: "text", text });
  }
  return parts;
}

function acceptImage(mediaType: unknown, url: unknown): FileUIPart | null {
  if (typeof mediaType !== "string" || typeof url !== "string") return null;
  const type = mediaType.toLowerCase();
  if (type !== "image/jpeg" && type !== "image/png" && type !== "image/webp" && type !== "image/gif") {
    return null;
  }
  if (url.length > 5_500_000) return null;
  const pattern = new RegExp(`^data:${type.replace("/", "\\/")};base64,[a-z0-9+/=\\r\\n]+$`, "i");
  if (!pattern.test(url)) return null;
  return { type: "file", mediaType: type, url };
}

function textOf(message: UIMessage): string {
  return message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n")
    .trim()
    .slice(0, 4000);
}

function hasImage(message: UIMessage): boolean {
  return message.parts.some((part) => part.type === "file");
}

function validPosition(position: { lat: number; lng: number } | null): { lat: number; lng: number } | null {
  if (!position) return null;
  if (position.lat < -90 || position.lat > 90 || position.lng < -180 || position.lng > 180) return null;
  return position;
}

async function loadCockpit(
  supabase: SupabaseClient<Database>,
  userId: string,
  position: { lat: number; lng: number } | null,
): Promise<CaptainCockpitContext> {
  const cockpit: CaptainCockpitContext = {
    position: position ? { lat: position.lat, lng: position.lng, source: "gps" } : null,
    selectedBay: null,
    weather: null,
    vessel: null,
  };
  const { data: boat } = await supabase
    .from("user_boats")
    .select("boat_brand, engine_brand, engine_model")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (boat && (boat.boat_brand || boat.engine_brand || boat.engine_model)) {
    const engine = [boat.engine_brand, boat.engine_model].filter(Boolean).join(" ");
    cockpit.vessel = {
      name: boat.boat_brand,
      type: null,
      lengthM: null,
      draftM: null,
      engine: engine || null,
    };
    return cockpit;
  }
  const { data: vessel } = await supabase
    .from("vessels")
    .select("name, vessel_type, length_m, engine_model")
    .eq("owner_id", userId)
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
  return cockpit;
}

async function loadNearby(
  supabase: SupabaseClient<Database>,
  position: { lat: number; lng: number } | null,
): Promise<NearbyChartPoint[]> {
  const { data, error } = await supabase
    .from("marine_zones")
    .select("name, kind, lat, lng, depth_m, metadata")
    .eq("active", true)
    .limit(80);
  if (error || !data) return [];
  return rankNearbyPoints(
    data.map((zone) => {
      const meta = (zone.metadata ?? {}) as { bottom?: string; protection?: string };
      return {
        name: zone.name,
        kind: zone.kind,
        lat: Number(zone.lat),
        lng: Number(zone.lng),
        depthM: zone.depth_m == null ? null : Number(zone.depth_m),
        seabed: typeof meta.bottom === "string" ? meta.bottom : null,
        protection: typeof meta.protection === "string" ? meta.protection : null,
        rangeNm: null,
      };
    }),
    position,
  );
}
