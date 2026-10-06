import { generateText, stepCountIs, tool, type ModelMessage } from "ai";
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
import type { CaptainAction, CaptainCockpitContext, NearbyChartPoint } from "@/lib/ai-captain-types";
import { answerFromTraining, retrieveMarineNotes } from "@/lib/thalvo-ai/domain";
import { fetchMarineWeather } from "@/lib/thalvo-ai/marine-weather";
import { loadMemoryBlock, rememberFact, saveChatLine } from "@/lib/thalvo-ai/memory-store";
import { platformRouteCatalog, resolvePlatformRoute, type AppPath } from "@/lib/thalvo-ai/platform-routes";
import { buildChiefEngineerPrompt } from "@/lib/thalvo-ai/system-prompt";

type Client = SupabaseClient<Database>;

const LAYERS = new Set(["seamarks", "hazards", "moorings", "reports", "fleet"]);
const AI_WINDOW_MS = 10 * 60 * 1000;
const AI_MAX_IN_WINDOW = 8;
const recentCalls = new Map<string, number[]>();

export interface EmbeddedChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface EmbeddedChatImage {
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  dataUrl: string;
}

export interface EmbeddedWeather {
  alert: string;
  summaryTr: string;
  summaryEn: string;
}

export interface EmbeddedTurnResult {
  text: string;
  route: AppPath | null;
  actions: CaptainAction[];
  weather: EmbeddedWeather | null;
  emergency: boolean;
}

export async function runEmbeddedTurn(input: {
  supabase: Client;
  userId: string;
  sessionId: string;
  lang: "tr" | "en";
  position: { lat: number; lng: number } | null;
  messages: EmbeddedChatMessage[];
  image?: EmbeddedChatImage;
}): Promise<EmbeddedTurnResult> {
  const messages = input.messages.slice(-12);
  const total = messages.reduce((sum, message) => sum + message.content.length, 0);
  if (total > 12000) throw new Error("ai_too_long");
  const last = messages.at(-1);
  if (!last || last.role !== "user") throw new Error("expected_user_message");
  if (input.image && !isImageDataUrl(input.image.mediaType, input.image.dataUrl)) {
    throw new Error("invalid_image");
  }

  const position = validPosition(input.position);
  const trained = await answerFromTraining({ text: last.content, lang: input.lang, position });
  await saveChatLine(
    input.supabase,
    input.userId,
    input.sessionId,
    "user",
    last.content || (input.image ? "[photo]" : ""),
  );

  const apiKey = (process.env.THALVO_AI_API_KEY ?? process.env.LOVABLE_API_KEY ?? "").trim();
  const needsModel = Boolean(apiKey) && Boolean(input.image || !trained.confident);
  if (!needsModel) {
    const photo =
      input.image && !apiKey
        ? input.lang === "tr"
          ? "\n\nFotoğraftaki yazıyı buradan okuyamıyorum. Plakadaki marka ve modeli yaz."
          : "\n\nI cannot read the photo from here. Type the brand and model from the plate."
        : "";
    const text = `${trained.text}${photo}`.trim();
    await saveChatLine(input.supabase, input.userId, input.sessionId, "assistant", text);
    return {
      text,
      route: null,
      actions: [],
      weather: trained.weather,
      emergency: trained.emergency,
    };
  }
  if (!allowLocalQuota(input.userId)) throw new Error("ai_rate_limited");
  const quota = await input.supabase.rpc("consume_captain_ai_quota");
  if (quota.error && /ai_rate_limited/i.test(quota.error.message)) throw new Error("ai_rate_limited");

  const [memoryBlock, cockpit] = await Promise.all([
    loadMemoryBlock(input.supabase, input.userId, last.content).catch((error: unknown) => {
      console.error("[thalvo-ai] memory", error instanceof Error ? error.name : "error");
      return "=== MEMORIES ===\n(unavailable)\n=== END MEMORY ===";
    }),
    loadCockpit(input.supabase, input.userId, position),
  ]);
  const nearby = await loadNearby(input.supabase, position);
  const notes = retrieveMarineNotes(last.content, input.lang);
  const system = [
    buildChiefEngineerPrompt(input.lang, memoryBlock, formatCockpitBlock(cockpit, nearby, input.lang)),
    notes ? `Verified notes:\n${notes}` : "",
    trained.text ? `Local specialist draft (prefer these facts, do not invent numbers):\n${trained.text}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const tools = createEmbeddedTools(input.supabase, input.userId, nearby);

  let result;
  try {
    result = await generateText({
      model: createThalvoAiProvider(apiKey)(process.env.THALVO_AI_MODEL ?? CAPTAIN_MODEL_DEFAULT),
      system,
      messages: toModelMessages(messages, input.image),
      tools,
      stopWhen: stepCountIs(5),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    console.error("[thalvo-ai] turn", message.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 240));
    await saveChatLine(input.supabase, input.userId, input.sessionId, "assistant", trained.text);
    return {
      text: trained.text,
      route: null,
      actions: [],
      weather: trained.weather,
      emergency: trained.emergency,
    };
  }

  const harvested = harvest([
    ...result.toolResults.map((item) => item.output),
    ...result.steps.flatMap((step) => (step.toolResults ?? []).map((item) => item.output)),
  ]);
  const emergency = /\[EMERGENCY\]/i.test(result.text);
  const text = result.text.replace(/\[EMERGENCY\]/gi, "").trim() || fallback(input.lang);
  await saveChatLine(input.supabase, input.userId, input.sessionId, "assistant", text);
  return { text, emergency, ...harvested };
}

function createEmbeddedTools(supabase: Client, userId: string, nearby: NearbyChartPoint[]) {
  return {
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
      description: `Open a THALVO page for the captain. Allowed routes:\n${platformRouteCatalog()}`,
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
        rememberFact(supabase, userId, memoryText, {
          boatBrand: boatBrand ?? null,
          engineBrand: engineBrand ?? null,
          engineModel: engineModel ?? null,
          serialNumber: serialNumber ?? null,
        }),
    }),
    ...createCaptainTools(nearby),
  };
}

function toModelMessages(messages: EmbeddedChatMessage[], image?: EmbeddedChatImage): ModelMessage[] {
  const modelMessages: ModelMessage[] = messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
  if (!image) return modelMessages;
  const last = modelMessages.at(-1);
  if (!last || last.role !== "user") return modelMessages;
  const text = typeof last.content === "string" ? last.content : "";
  modelMessages[modelMessages.length - 1] = {
    role: "user",
    content: [
      { type: "text", text: text || "Inspect this photo." },
      { type: "image", image: image.dataUrl, mediaType: image.mediaType },
    ],
  };
  return modelMessages;
}

function harvest(outputs: unknown[]): Pick<EmbeddedTurnResult, "actions" | "route" | "weather"> {
  const actions: CaptainAction[] = [];
  let route: AppPath | null = null;
  let weather: EmbeddedWeather | null = null;
  for (const output of outputs) {
    if (!output || typeof output !== "object") continue;
    const record = output as Record<string, unknown>;
    const action = asAction(record.action);
    if (action) actions.push(action);
    if (record.ok === true && typeof record.route === "string") {
      route = resolvePlatformRoute(record.route) ?? route;
    }
    if (
      record.ok === true &&
      typeof record.alert === "string" &&
      typeof record.summaryTr === "string" &&
      typeof record.summaryEn === "string"
    ) {
      weather = { alert: record.alert, summaryTr: record.summaryTr, summaryEn: record.summaryEn };
    }
  }
  return { actions, route, weather };
}

function asAction(value: unknown): CaptainAction | null {
  if (!value || typeof value !== "object") return null;
  const action = value as CaptainAction;
  if (action.tool === "focusBay") {
    if (typeof action.bayName !== "string") return null;
    if (!Number.isFinite(action.lat) || !Number.isFinite(action.lng)) return null;
    if (Math.abs(action.lat) > 90 || Math.abs(action.lng) > 180) return null;
    return action;
  }
  if (action.tool === "filterLayers") {
    if (!LAYERS.has(action.layerType)) return null;
    return { tool: "filterLayers", layerType: action.layerType, enabled: action.enabled !== false };
  }
  if (action.tool === "createSosOrMission") {
    if (action.type !== "mechanic" && action.type !== "diver") return null;
    if (typeof action.details !== "string") return null;
    return { tool: "createSosOrMission", type: action.type, details: action.details.slice(0, 500) };
  }
  return null;
}

async function loadCockpit(
  supabase: Client,
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

async function loadNearby(supabase: Client, position: { lat: number; lng: number } | null): Promise<NearbyChartPoint[]> {
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

function validPosition(position: { lat: number; lng: number } | null): { lat: number; lng: number } | null {
  if (!position) return null;
  if (position.lat < -90 || position.lat > 90 || position.lng < -180 || position.lng > 180) return null;
  return position;
}

function isImageDataUrl(mediaType: string, url: string): boolean {
  if (url.length > 6_000_000) return false;
  const pattern = new RegExp(`^data:${mediaType.replace("/", "\\/")};base64,[a-z0-9+/=\\r\\n]+$`, "i");
  return pattern.test(url);
}

function fallback(lang: "tr" | "en"): string {
  return lang === "tr"
    ? "Bunu net cevaplayamadım. Bir cümleyle tekrar söyler misin?"
    : "I could not answer that clearly. Can you say it again in one sentence?";
}
