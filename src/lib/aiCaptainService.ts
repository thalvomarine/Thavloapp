import { generateText, stepCountIs, streamText, tool, type LanguageModel } from "ai";
import { z } from "zod";
import { haversineNm } from "@/lib/geo-eta";
import {
  resolveCaptainLayer,
  type CaptainAction,
  type CaptainCockpitContext,
  type NearbyChartPoint,
} from "@/lib/ai-captain-types";

export const CAPTAIN_MODEL_DEFAULT = "google/gemini-3-flash-preview";

const SYSTEM_TR = `Sen Thalvo MarineOS'un Baş Seyir Asistanı ve Başmühendisisin (Kıdemli Türk Kaptanı). ColReg (Denizde Çatışmayı Önleme Tüzüğü), Ege/Akdeniz batimetrisi, demirleme protokolleri (tonoz, alarga, koltuk alma) ve marin motor mekaniği (Volvo Penta, Yanmar, Mercury, Caterpillar) konularında üst düzey uzmansın.

Üslup: Kısa, net, güven veren, denizci diline uygun. Rüzgâr knot, yönler kerte/yön adları (N, NE, meltem, poyraz), derinlik metre, mesafe deniz mili. Gereksiz laf kalabalığı yapma. Emniyeti birinci planda tut.

Kurallar:
- Verilen KOKPİT BAĞLAMI gerçeğidir. "Bu havada buraya demirlenir mi?" sorusunda seçili koy + rüzgâr yönü + tekne su çekimi / boyu ile hesapla.
- Rüzgâr koyun açık ağzına 60° içinde esiyorsa alargayı riskli say; sığlık + draft için 1.5 m dip payı bırak.
- ColReg özetle: dar kanalda sancak, sınırlı görüşte sis sinyali, çatışma riskinde erken ve belirgin manevra.
- Acil arıza (hararet, yağ basıncı, yangın, su alma, pervane halatı) için önce insan/tekne emniyeti, sonra createSosOrMission.
- En yakın korunaklı alarga istendiğinde focusBay çağır. Fener/sığlık katmanı istendiğinde filterLayers çağır.
- Uydurma koordinat veya uydurma derinlik yazma. Bağlamda yoksa "kayıtta yok" de.
- Kullanıcı acil durum tarif ederse yanıtın sonuna [EMERGENCY] ekle.`;

const SYSTEM_EN = `You are Thalvo MarineOS Chief Navigation Assistant and Chief Engineer (senior Turkish master mariner). Expert in ColRegs, Aegean/Mediterranean bathymetry, Aegean mooring practice (tonoz / lazy-line, alarga / swinging, koltuk), and marine engines (Volvo Penta, Yanmar, Mercury, Caterpillar).

Style: short, calm, seamanlike. Wind in knots, directions as compass points, depth in metres, distance in nautical miles. No filler. Safety first.

Rules:
- The injected COCKPIT CONTEXT is ground truth. For "can I anchor here in this wind?" use the selected bay + wind + vessel draft/LOA.
- If wind is within 60° of the bay's open mouth, treat the anchorage as exposed. Keep 1.5 m under-keel clearance vs charted depth.
- ColRegs: starboard in a narrow channel, fog signals in restricted visibility, early and obvious action if risk of collision.
- For heat / oil pressure / fire / flooding / rope in prop: safety first, then createSosOrMission.
- When asked for the nearest sheltered alarga, call focusBay. For lights or shoals, call filterLayers.
- Never invent coordinates or depths. If the context lacks a fact, say it is not on file.
- If the captain describes an emergency, append [EMERGENCY].`;

export function captainSystemPrompt(lang: "tr" | "en"): string {
  return lang === "en" ? SYSTEM_EN : SYSTEM_TR;
}

export function formatCockpitBlock(
  ctx: CaptainCockpitContext,
  nearby: NearbyChartPoint[],
  lang: "tr" | "en",
): string {
  const pos = ctx.position
    ? `${ctx.position.lat.toFixed(5)}, ${ctx.position.lng.toFixed(5)} (${ctx.position.source})`
    : lang === "en"
      ? "unknown"
      : "bilinmiyor";
  const bay = ctx.selectedBay
    ? [
        ctx.selectedBay.name,
        ctx.selectedBay.kind,
        ctx.selectedBay.depthM != null ? `${ctx.selectedBay.depthM} m` : null,
        ctx.selectedBay.seabed,
        ctx.selectedBay.protection,
      ]
        .filter(Boolean)
        .join(" · ")
    : lang === "en"
      ? "none selected"
      : "seçili değil";
  const wx = ctx.weather
    ? `${ctx.weather.windKts.toFixed(0)} kn from ${ctx.weather.windFrom} (${Math.round(ctx.weather.windDeg)}°) · wave ${ctx.weather.waveM ?? "—"} m · ${Math.round(ctx.weather.pressureHpa)} hPa`
    : lang === "en"
      ? "no live metocean"
      : "canlı metocean yok";
  const vessel = ctx.vessel
    ? [
        ctx.vessel.name,
        ctx.vessel.type,
        ctx.vessel.lengthM != null ? `LOA ${ctx.vessel.lengthM} m` : null,
        ctx.vessel.draftM != null ? `draft ${ctx.vessel.draftM} m` : null,
        ctx.vessel.engine,
      ]
        .filter(Boolean)
        .join(" · ")
    : lang === "en"
      ? "not on file"
      : "kayıtta yok";

  const nearbyLines =
    nearby.length === 0
      ? lang === "en"
        ? "(none in range)"
        : "(menzilde yok)"
      : nearby
          .slice(0, 12)
          .map((p) => {
            const nm = p.rangeNm != null ? `${p.rangeNm.toFixed(1)} NM` : "?";
            const depth = p.depthM != null ? `${p.depthM} m` : "—";
            return `- ${p.name} [${p.kind}] ${nm} · ${depth} · ${p.seabed ?? "—"} · ${p.protection ?? "—"}`;
          })
          .join("\n");

  return [
    "=== KOKPİT BAĞLAMI / COCKPIT CONTEXT ===",
    `Position: ${pos}`,
    `Selected bay/marina: ${bay}`,
    `Weather: ${wx}`,
    `Vessel: ${vessel}`,
    "Nearby chart points (RAG):",
    nearbyLines,
    "=== END CONTEXT ===",
  ].join("\n");
}

export function rankNearbyPoints(
  points: NearbyChartPoint[],
  origin: { lat: number; lng: number } | null,
): NearbyChartPoint[] {
  const scored = points.map((p) => ({
    ...p,
    rangeNm: origin ? haversineNm(origin.lat, origin.lng, p.lat, p.lng) : p.rangeNm,
  }));
  scored.sort((a, b) => (a.rangeNm ?? 99) - (b.rangeNm ?? 99));
  return scored;
}

function matchBay(name: string, nearby: NearbyChartPoint[]): NearbyChartPoint | null {
  const q = name.trim().toLocaleLowerCase("tr");
  if (!q) return null;
  const exact = nearby.find((p) => p.name.toLocaleLowerCase("tr") === q);
  if (exact) return exact;
  const partial = nearby.find(
    (p) => p.name.toLocaleLowerCase("tr").includes(q) || q.includes(p.name.toLocaleLowerCase("tr")),
  );
  if (partial) return partial;
  const sheltered = /alarga|anchorage|korunak|shelter|mooring|tonoz/.test(q);
  if (sheltered) {
    const alarga = nearby.find((p) => /anchorage|alarga|mooring|tonoz/i.test(`${p.kind} ${p.name}`));
    if (alarga) return alarga;
    return nearby[0] ?? null;
  }
  return nearby[0] ?? null;
}

function extractActions(outputs: unknown[]): CaptainAction[] {
  const actions: CaptainAction[] = [];
  for (const out of outputs) {
    if (!out || typeof out !== "object") continue;
    const action = (out as { action?: CaptainAction }).action;
    if (action && typeof action.tool === "string") actions.push(action);
  }
  return actions;
}

export function createCaptainTools(nearby: NearbyChartPoint[]) {
  return {
    focusBay: tool({
      description:
        "Pan and zoom the chart to a recommended bay, marina or alarga. Use when the captain should look at a place.",
      inputSchema: z.object({
        bayName: z.string().describe("Bay / marina / alarga name from the nearby chart list"),
      }),
      execute: async ({ bayName }) => {
        const hit = matchBay(bayName, nearby);
        if (!hit) {
          return { ok: false as const, message: `No chart pin matches "${bayName}".` };
        }
        const action: CaptainAction = {
          tool: "focusBay",
          bayName: hit.name,
          lat: hit.lat,
          lng: hit.lng,
          zoom: 15,
        };
        return { ok: true as const, name: hit.name, depthM: hit.depthM, rangeNm: hit.rangeNm, action };
      },
    }),
    createSosOrMission: tool({
      description:
        "Prepare a THALVO SOS / live-ops mission card for engine, electrical or underwater emergency. Does not dispatch until the captain confirms.",
      inputSchema: z.object({
        type: z.enum(["mechanic", "diver"]).describe("mechanic for engine/electrical, diver for underwater"),
        details: z.string().describe("Short operational brief for the responder"),
      }),
      execute: async ({ type, details }) => {
        const action: CaptainAction = { tool: "createSosOrMission", type, details };
        return { ok: true as const, action };
      },
    }),
    filterLayers: tool({
      description:
        "Toggle a chart layer. Use seamarks/lights for beacons, hazards/shoals for reefs, moorings for tonoz/alarga.",
      inputSchema: z.object({
        layerType: z
          .string()
          .describe("seamarks | hazards | moorings | reports | fleet (or lights / shoals / alarga)"),
        enabled: z.boolean().optional().describe("Defaults to true (show the layer)"),
      }),
      execute: async ({ layerType, enabled }) => {
        const layer = resolveCaptainLayer(layerType);
        if (!layer) {
          return { ok: false as const, message: `Unknown layer "${layerType}".` };
        }
        const action: CaptainAction = {
          tool: "filterLayers",
          layerType: layer,
          enabled: enabled ?? true,
        };
        return { ok: true as const, action };
      },
    }),
  };
}

interface CaptainRunInput {
  model: LanguageModel;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  context: CaptainCockpitContext;
  nearby: NearbyChartPoint[];
  lang: "tr" | "en";
}

export interface CaptainReply {
  text: string;
  emergency: boolean;
  actions: CaptainAction[];
}

function stripEmergency(text: string): { text: string; emergency: boolean } {
  const emergency = /\[EMERGENCY\]/i.test(text);
  return { text: text.replace(/\[EMERGENCY\]/gi, "").trim(), emergency };
}

function collectToolOutputs(steps: Array<{ toolResults?: Array<{ output?: unknown }> }>): unknown[] {
  const outs: unknown[] = [];
  for (const step of steps) {
    for (const tr of step.toolResults ?? []) {
      if (tr.output !== undefined) outs.push(tr.output);
    }
  }
  return outs;
}

/** Non-stream tool loop — used by the authenticated server function. */
export async function runCaptainConsultation(input: CaptainRunInput): Promise<CaptainReply> {
  const system = `${captainSystemPrompt(input.lang)}\n\n${formatCockpitBlock(input.context, input.nearby, input.lang)}`;
  const tools = createCaptainTools(input.nearby);
  const result = await generateText({
    model: input.model,
    system,
    messages: input.messages,
    tools,
    stopWhen: stepCountIs(5),
  });
  const cleaned = stripEmergency(result.text);
  const fromSteps = collectToolOutputs(result.steps);
  const fromTop = result.toolResults.map((tr) => tr.output);
  return {
    ...cleaned,
    actions: extractActions([...fromSteps, ...fromTop]),
  };
}

/**
 * OpenAI / Anthropic / Gemini compatible streaming turn (same tools + context).
 * Caller iterates `textStream` or awaits `text`.
 */
export function streamCaptainConsultation(input: CaptainRunInput) {
  const system = `${captainSystemPrompt(input.lang)}\n\n${formatCockpitBlock(input.context, input.nearby, input.lang)}`;
  return streamText({
    model: input.model,
    system,
    messages: input.messages,
    tools: createCaptainTools(input.nearby),
    stopWhen: stepCountIs(5),
  });
}
