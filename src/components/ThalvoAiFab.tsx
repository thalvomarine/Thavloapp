import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { askThalvoAi } from "@/lib/thalvo-ai.functions";
import { X, Send, Loader2, AlertOctagon } from "lucide-react";
import { CompassMark } from "@/components/brand/CompassMark";
import { THALVO_AI_OPEN_EVENT } from "@/lib/thalvo-ai-bus";
import { getCockpitContext, publishCockpitContext } from "@/lib/ai-captain-context-bus";
import { requestMapFocus } from "@/lib/map-focus-bus";
import { requestLayerFilter } from "@/lib/map-layers-bus";
import { openThalvoSos } from "@/lib/sos-bus";
import { setMapChromeOverlay } from "@/lib/map-chrome";
import { fetchMetocean, compassLabel } from "@/lib/metocean";
import { supabase } from "@/integrations/supabase/client";
import type { CaptainAction, CaptainCockpitContext } from "@/lib/ai-captain-types";

interface Msg {
  role: "user" | "assistant";
  content: string;
  emergency?: boolean;
}

const PILLS_TR = [
  "Bu koy bu rüzgarda güvenli mi?",
  "En yakın korunaklı alargayı göster",
  "Motor hararet yaptı, ne yapmalıyım?",
];
const PILLS_EN = [
  "Is this bay safe in this wind?",
  "Show the nearest sheltered anchorage",
  "Engine is overheating — what now?",
];

function timeGreeting(lang: "en" | "tr") {
  const h = new Date().getHours();
  if (lang === "tr") {
    if (h < 6) return "İyi geceler Kaptan.";
    if (h < 12) return "Günaydın Kaptan.";
    if (h < 18) return "İyi günler Kaptan.";
    return "İyi akşamlar Kaptan.";
  }
  if (h < 6) return "Good night, Captain.";
  if (h < 12) return "Good morning, Captain.";
  if (h < 18) return "Good afternoon, Captain.";
  return "Good evening, Captain.";
}

async function hydrateCockpit(): Promise<CaptainCockpitContext> {
  const ctx = { ...getCockpitContext() };
  if (!ctx.vessel) {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (uid) {
      const { data: vessel } = await supabase
        .from("vessels")
        .select("name, vessel_type, length_m, engine_model")
        .eq("owner_id", uid)
        .limit(1)
        .maybeSingle();
      if (vessel) {
        ctx.vessel = {
          name: vessel.name ?? null,
          type: vessel.vessel_type ?? null,
          lengthM: vessel.length_m == null ? null : Number(vessel.length_m),
          draftM: null,
          engine: vessel.engine_model ?? null,
        };
        publishCockpitContext({ vessel: ctx.vessel });
      }
    }
  }
  if (!ctx.weather && ctx.position) {
    try {
      const snap = await fetchMetocean(ctx.position.lat, ctx.position.lng);
      ctx.weather = {
        windKts: snap.windSpeedKts,
        windDeg: snap.windDirectionDeg,
        windFrom: compassLabel(snap.windDirectionDeg),
        waveM: snap.waveHeightM,
        pressureHpa: snap.pressureHpa,
      };
      publishCockpitContext({ weather: ctx.weather });
    } catch {
      /* live weather is best-effort */
    }
  }
  return ctx;
}

export function ThalvoAiFab({ hideLauncher = false }: { hideLauncher?: boolean } = {}) {
  const { t, i18n } = useTranslation();
  const lang: "en" | "tr" = i18n.language === "en" ? "en" : "tr";
  const navigate = useNavigate();
  const ask = useServerFn(askThalvoAi);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(THALVO_AI_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(THALVO_AI_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    setMapChromeOverlay("ai", open);
    return () => setMapChromeOverlay("ai", false);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setKeyboardInset(0);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(inset);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, [open]);

  const pills = lang === "en" ? PILLS_EN : PILLS_TR;
  const greeting = timeGreeting(lang);
  const prompt =
    lang === "en" ? "Where would you like to navigate today?" : "Bugün nereye yönelmek istersiniz?";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  const lastEmergency = msgs
    .slice()
    .reverse()
    .find((m) => m.role === "assistant")?.emergency;

  const runActions = (actions: CaptainAction[]) => {
    for (const action of actions) {
      if (action.tool === "focusBay") {
        requestMapFocus({
          lat: action.lat,
          lng: action.lng,
          zoom: action.zoom,
          label: action.bayName,
        });
        void navigate({ to: "/app" });
      } else if (action.tool === "filterLayers") {
        requestLayerFilter(action.layerType, action.enabled);
      } else if (action.tool === "createSosOrMission") {
        setOpen(false);
        openThalvoSos(action.type, action.details);
      }
    }
  };

  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || busy) return;
    if (!override) setInput("");
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setBusy(true);
    try {
      const context = await hydrateCockpit();
      const res = await ask({
        data: {
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          lang,
          context,
        },
      });
      setMsgs((prev) => [
        ...prev,
        { role: "assistant", content: res.text, emergency: res.emergency },
      ]);
      runActions(res.actions ?? []);
    } catch {
      setMsgs((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            lang === "en"
              ? "Compass is momentarily out of range. Please try again."
              : "Pusula geçici olarak menzil dışında. Lütfen tekrar deneyin.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {!hideLauncher && (
        <button
          onClick={() => setOpen(true)}
          aria-label="THALVO Compass — Marine Intelligence"
          className="thalvo-compass-fab group fixed right-4 z-40 size-14 rounded-full grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:oklch(0.72_0.13_210)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A192F]"
          style={{
            bottom: "max(1rem, env(safe-area-inset-bottom))",
            background:
              "radial-gradient(120% 120% at 30% 20%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 45%), linear-gradient(160deg, #0F2440 0%, #0A192F 60%, #081428 100%)",
            border: "1px solid rgba(255,176,32,0.55)",
            boxShadow:
              "0 10px 28px -10px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 24px -6px rgba(0,180,216,0.35)",
            backdropFilter: "blur(10px)",
          }}
        >
          <span className="thalvo-compass-breathe grid place-items-center">
            <CompassMark size={26} />
          </span>
        </button>
      )}

      <style>{`
        @keyframes thalvo-compass-breathe {
          0%,100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(0,180,216,0)); }
          50%     { transform: scale(1.035); filter: drop-shadow(0 0 6px rgba(0,180,216,0.35)); }
        }
        .thalvo-compass-breathe { animation: thalvo-compass-breathe 7s ease-in-out infinite; }
        @keyframes thalvo-compass-align {
          0%   { transform: rotate(-8deg) scale(0.94); opacity: 0; }
          60%  { transform: rotate(2deg)  scale(1.02); opacity: 1; }
          100% { transform: rotate(0deg)  scale(1);    opacity: 1; }
        }
        .thalvo-compass-align { animation: thalvo-compass-align 260ms cubic-bezier(.2,.7,.2,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .thalvo-compass-breathe, .thalvo-compass-align { animation: none !important; }
        }
      `}</style>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end justify-center"
            onClick={() => setOpen(false)}
          >
            <div className="absolute inset-0 bg-[#020814]/45 backdrop-blur-[2px]" />
            <div
              className="thalvo-compass-align relative flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl shadow-2xl"
              style={{
                maxHeight: "70dvh",
                marginBottom: keyboardInset,
                background:
                  "radial-gradient(120% 60% at 50% -10%, rgba(0,180,216,0.10) 0%, transparent 60%), linear-gradient(180deg, #0B1B33 0%, #081426 100%)",
                borderTop: "1px solid rgba(0,240,255,0.18)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className="grid size-10 place-items-center rounded-xl"
                    style={{
                      background: "linear-gradient(160deg,#0F2440 0%, #0A192F 100%)",
                      border: "1px solid rgba(255,176,32,0.4)",
                    }}
                  >
                    <CompassMark size={22} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold leading-tight tracking-wide text-white">
                      THALVO Compass
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase leading-tight tracking-[0.18em] text-white/50">
                      {t("ai.role_line")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t("common.close")}
                  className="grid size-9 place-items-center rounded-full text-white/70 hover:bg-white/5 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {msgs.length === 0 && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-lg font-medium leading-snug text-white">{greeting}</p>
                      <p className="mt-1 text-sm text-white/60">{prompt}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {pills.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => void send(s)}
                          className="rounded-xl border border-cyan-400/20 bg-white/[0.03] px-3 py-2.5 text-left text-[12.5px] leading-snug text-white/85 transition-colors hover:bg-white/[0.06]"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {msgs.map((m, i) => (
                  <div
                    key={i}
                    className={"flex " + (m.role === "user" ? "justify-end" : "justify-start")}
                  >
                    {m.role === "assistant" && (
                      <div className="mr-2 mt-0.5 shrink-0">
                        <CompassMark size={18} />
                      </div>
                    )}
                    <div
                      className={
                        "max-w-[82%] whitespace-pre-wrap text-sm leading-relaxed " +
                        (m.role === "user"
                          ? "rounded-2xl rounded-br-sm px-3.5 py-2.5 text-white"
                          : "text-white/90")
                      }
                      style={
                        m.role === "user"
                          ? {
                              background:
                                "linear-gradient(160deg, rgba(0,180,216,0.22) 0%, rgba(0,180,216,0.12) 100%)",
                              border: "1px solid rgba(0,180,216,0.35)",
                            }
                          : undefined
                      }
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {busy && (
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <Loader2 className="size-3.5 animate-spin" />
                    {t("ai.thinking")}
                  </div>
                )}
                {lastEmergency && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      openThalvoSos("mechanic");
                    }}
                    className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-semibold text-white"
                    style={{
                      background: "linear-gradient(135deg, oklch(0.68 0.24 25), oklch(0.6 0.24 18))",
                      boxShadow: "0 14px 40px -10px rgba(244,63,94,0.55)",
                    }}
                  >
                    <AlertOctagon className="size-5" />
                    {t("ai.autofill_sos")}
                  </button>
                )}
              </div>

              <div
                className="flex gap-2 border-t border-white/5 p-3"
                style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void send();
                  }}
                  placeholder={t("ai.placeholder")}
                  className="h-11 flex-1 rounded-xl px-3.5 text-sm text-white placeholder:text-white/40 focus:outline-none"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={busy || !input.trim()}
                  aria-label={t("common.send", { defaultValue: "Send" })}
                  className="grid size-11 place-items-center rounded-xl text-white transition-opacity disabled:opacity-40"
                  style={{
                    background:
                      "linear-gradient(160deg, rgba(0,180,216,0.35) 0%, rgba(0,180,216,0.18) 100%)",
                    border: "1px solid rgba(0,180,216,0.5)",
                  }}
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
