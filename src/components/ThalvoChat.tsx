import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { Camera, Loader2, Plus, Send, X } from "lucide-react";
import { CompassMark } from "@/components/brand/CompassMark";
import { getCockpitContext } from "@/lib/ai-captain-context-bus";
import type { CaptainAction } from "@/lib/ai-captain-types";
import { requestMapFocus } from "@/lib/map-focus-bus";
import { requestLayerFilter } from "@/lib/map-layers-bus";
import { setMapChromeOverlay } from "@/lib/map-chrome";
import { resolvePlatformRoute } from "@/lib/thalvo-ai/platform-routes";
import { openThalvoSos } from "@/lib/sos-bus";
import { THALVO_AI_OPEN_EVENT } from "@/lib/thalvo-ai-bus";
import { askThalvoChat, loadThalvoChat } from "@/lib/thalvo-chat.functions";

const SESSION_KEY = "thalvo-ai-session";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const PILLS_TR = [
  "Motor hararet yaptı, sade dil raporu yazar mısın?",
  "Göcek'te deniz durumu nasıl?",
  "Bu rüzgârda alargaya demirlenir mi?",
];
const PILLS_EN = [
  "Engine is overheating — write a plain-language report.",
  "What is the sea state at Göcek?",
  "Can I anchor in this wind?",
];

interface ChatLine {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  weather?: { alert: string; summary: string };
  route?: string;
}

export function ThalvoChat({ showLauncher = true }: { showLauncher?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <ThalvoChatLive showLauncher={showLauncher} />;
}

function ThalvoChatLive({ showLauncher }: { showLauncher: boolean }) {
  const { t, i18n } = useTranslation();
  const lang: "en" | "tr" = i18n.language === "en" ? "en" : "tr";
  const navigate = useNavigate();
  const ask = useServerFn(askThalvoChat);
  const loadHistory = useServerFn(loadThalvoChat);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState(readOrCreateSession);
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadedSession = useRef<string | null>(null);

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
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      setKeyboardInset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
    };
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, busy]);

  useEffect(() => {
    if (!open || loadedSession.current === sessionId) return;
    let cancel = false;
    loadedSession.current = sessionId;
    void (async () => {
      try {
        const body = await loadHistory({ data: { sessionId } });
        if (cancel || body.messages.length === 0) return;
        setMessages((current) =>
          current.length === 0
            ? body.messages.map((line) => ({ id: line.id, role: line.role, content: line.content }))
            : current,
        );
      } catch {
        /* history is optional until the memory tables exist */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [open, sessionId]);

  const pills = lang === "en" ? PILLS_EN : PILLS_TR;

  const applyReply = (replyId: string, route: string | null, actions: CaptainAction[]) => {
    const path = route ? resolvePlatformRoute(route) : null;
    if (path) void navigate({ to: path });
    for (const action of actions) {
      if (action.tool === "focusBay") {
        requestMapFocus({ lat: action.lat, lng: action.lng, zoom: action.zoom, label: action.bayName });
        void navigate({ to: "/app" });
      } else if (action.tool === "filterLayers") {
        requestLayerFilter(action.layerType, action.enabled);
      } else if (action.tool === "createSosOrMission") {
        setOpen(false);
        openThalvoSos(action.type, action.details);
      }
    }
    return replyId;
  };

  const send = async (text: string, image?: { mediaType: ChatImageType; dataUrl: string }) => {
    const value = text.trim();
    if ((!value && !image) || busy) return;
    const caption =
      value ||
      (lang === "en"
        ? "Inspect this photo: plate, serial number, or damage."
        : "Bu fotoğrafı incele: plaka, seri no veya hasar.");
    const next: ChatLine[] = [
      ...messages,
      { id: crypto.randomUUID(), role: "user", content: caption, imageUrl: image?.dataUrl },
    ];
    setMessages(next);
    setInput("");
    setLocalError(null);
    setBusy(true);
    try {
      const position = getCockpitContext().position;
      const reply = await ask({
        data: {
          sessionId,
          lang,
          position: position ? { lat: position.lat, lng: position.lng } : null,
          messages: next.slice(-12).map((line) => ({ role: line.role, content: line.content.slice(0, 4000) })),
          image,
        },
      });
      const id = crypto.randomUUID();
      applyReply(id, reply.route, reply.actions ?? []);
      const summary = reply.weather ? (lang === "en" ? reply.weather.summaryEn : reply.weather.summaryTr) : undefined;
      setMessages((current) => [
        ...current,
        {
          id,
          role: "assistant",
          content: reply.text,
          route: reply.route ?? undefined,
          weather: reply.weather && summary ? { alert: reply.weather.alert, summary } : undefined,
        },
      ]);
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : String(error);
      setLocalError(friendlyError(raw, lang, t("common.ai_rate_limited")));
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file || busy) return;
    if (!IMAGE_TYPES.has(file.type)) {
      setLocalError(lang === "en" ? "Use a JPEG, PNG, or WebP photo." : "JPEG, PNG veya WebP kullan.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setLocalError(lang === "en" ? "Photo must be under 4 MB." : "Fotoğraf 4 MB altında olmalı.");
      return;
    }
    const dataUrl = await readDataUrl(file);
    await send(input, { mediaType: file.type as ChatImageType, dataUrl });
  };

  const startNew = () => {
    const id = crypto.randomUUID();
    try {
      sessionStorage.setItem(SESSION_KEY, id);
    } catch {
      /* private mode keeps the in-memory id */
    }
    loadedSession.current = id;
    setSessionId(id);
    setMessages([]);
    setLocalError(null);
  };

  const launcher = showLauncher && !open && (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="THALVO AI"
      className="fixed right-4 z-[60] grid size-14 place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      style={{
        bottom: "calc(max(1rem, env(safe-area-inset-bottom)) + 4.6rem)",
        background:
          "radial-gradient(120% 120% at 30% 20%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 45%), linear-gradient(160deg, #0F2440 0%, #0A192F 60%, #081428 100%)",
        border: "1px solid rgba(0,180,216,0.65)",
        boxShadow: "0 10px 28px -10px rgba(0,0,0,0.7), 0 0 24px -6px rgba(0,180,216,0.45)",
      }}
    >
      <CompassMark size={26} />
    </button>
  );

  const panel = open && (
    <div className="fixed inset-0 z-[80]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-[#020814]/40" />
      <section
        className="thalvo-ai-panel absolute flex flex-col overflow-hidden rounded-3xl shadow-2xl inset-x-3 sm:inset-x-auto sm:right-4 sm:w-[400px]"
        style={{
          bottom: `calc(max(0.75rem, env(safe-area-inset-bottom)) + ${keyboardInset}px)`,
          height: "min(72dvh, 640px)",
          background:
            "radial-gradient(120% 60% at 50% -10%, rgba(0,180,216,0.16) 0%, transparent 55%), linear-gradient(180deg, #0B1B33 0%, #0A192F 100%)",
          border: "1px solid rgba(0,180,216,0.28)",
        }}
        onClick={(event) => event.stopPropagation()}
        aria-label="THALVO AI"
      >
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-cyan-300/40 bg-[#0F2440]">
              <CompassMark size={22} />
            </div>
            <div>
              <p className="text-[13px] font-semibold tracking-wide text-white">THALVO AI</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/70">
                {lang === "en" ? "Chief engineer" : "Başmühendis"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={startNew}
              aria-label={lang === "en" ? "New conversation" : "Yeni konuşma"}
              className="grid size-9 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Plus className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("common.close")}
              className="grid size-9 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-white/75">
                {lang === "en"
                  ? "Ask about an engine fault, the sea state, or where to go in THALVO. A plate photo can be read from the camera button."
                  : "Motor arızası, deniz durumu veya THALVO'da nereye gideceğini sor. Kamera düğmesiyle plaka fotoğrafı okunur."}
              </p>
              <div className="flex flex-col gap-2">
                {pills.map((pill) => (
                  <button
                    key={pill}
                    type="button"
                    onClick={() => void send(pill)}
                    className="rounded-xl border border-cyan-300/25 bg-white/[0.04] px-3 py-2.5 text-left text-[12.5px] leading-snug text-white/90 hover:bg-white/[0.08]"
                  >
                    {pill}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-cyan-100/70">
              <Loader2 className="size-3.5 animate-spin" />
              {t("ai.thinking")}
            </div>
          )}
          {localError && <p className="text-xs leading-relaxed text-rose-200">{localError}</p>}
        </div>

        <form
          className="flex items-end gap-2 border-t border-white/10 p-3"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              void onFile(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            aria-label={lang === "en" ? "Photograph a plate or part" : "Plaka veya parça fotoğrafı"}
            className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/10 text-cyan-100 hover:bg-white/10 disabled:opacity-40"
          >
            <Camera className="size-4" />
          </button>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
            maxLength={4000}
            placeholder={t("ai.placeholder")}
            className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-300/50"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label={t("common.send", { defaultValue: "Send" })}
            className="grid size-11 place-items-center rounded-xl border border-cyan-300/50 text-white disabled:opacity-40"
            style={{ background: "linear-gradient(160deg, rgba(0,180,216,0.35), rgba(0,180,216,0.12))" }}
          >
            <Send className="size-4" />
          </button>
        </form>
      </section>
      <style>{`
        @keyframes thalvo-ai-rise {
          from { transform: translateY(12px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .thalvo-ai-panel { animation: thalvo-ai-rise 220ms cubic-bezier(.2,.7,.2,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .thalvo-ai-panel { animation: none; }
        }
      `}</style>
    </div>
  );

  return (
    <>
      {launcher}
      {typeof document !== "undefined" && panel ? createPortal(panel, document.body) : null}
    </>
  );
}

type ChatImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

function MessageBubble({ message }: { message: ChatLine }) {
  const mine = message.role === "user";
  return (
    <div className={mine ? "flex justify-end" : "flex justify-start gap-2"}>
      {!mine && (
        <div className="mt-0.5 shrink-0">
          <CompassMark size={16} />
        </div>
      )}
      <div
        className={
          mine
            ? "max-w-[85%] rounded-2xl rounded-br-sm border border-cyan-300/35 bg-cyan-400/15 px-3.5 py-2.5 text-sm text-white"
            : "max-w-[85%] text-sm text-white/90"
        }
      >
        {message.imageUrl?.startsWith("data:image/") && (
          <img src={message.imageUrl} alt="" className="mb-2 max-h-40 rounded-xl" />
        )}
        {message.weather && (
          <p
            className={
              "mb-2 rounded-xl border px-3 py-2 text-xs leading-relaxed " +
              (message.weather.alert === "storm" || message.weather.alert === "gale"
                ? "border-rose-300/40 bg-rose-500/10 text-rose-50"
                : "border-cyan-300/30 bg-cyan-400/10 text-cyan-50")
            }
          >
            {message.weather.summary}
          </p>
        )}
        {message.route && (
          <p className="mb-2 text-xs text-cyan-100">
            {message.route}
          </p>
        )}
        <div className="thalvo-md space-y-2 leading-relaxed [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-cyan-100 [&_ol]:list-decimal [&_ol]:pl-4 [&_ul]:list-disc [&_ul]:pl-4 [&_strong]:text-white [&_code]:text-cyan-100">
          <ReactMarkdown
            components={{
              a: ({ href, children }) => <SafeLink href={href}>{children}</SafeLink>,
              img: ({ src, alt }) =>
                typeof src === "string" && /^https:\/\//i.test(src) ? (
                  <img src={src} alt={alt ?? ""} className="mt-1 max-h-40 rounded-xl" />
                ) : null,
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function SafeLink({ href, children }: { href?: string; children?: ReactNode }) {
  const safe = typeof href === "string" && (/^https?:\/\//i.test(href) || (href.startsWith("/") && !href.startsWith("//")));
  if (!safe) return <span>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className="text-cyan-200 underline">
      {children}
    </a>
  );
}

function friendlyError(raw: string, lang: "en" | "tr", limited: string): string {
  if (raw.includes("ai_rate_limited")) return limited;
  if (raw.includes("ai_too_long")) {
    return lang === "en" ? "That message is too long." : "Bu mesaj çok uzun.";
  }
  if (raw.includes("ai_not_configured")) {
    return lang === "en"
      ? "THALVO AI has no model key on the server yet."
      : "THALVO AI için sunucuda model anahtarı yok.";
  }
  return lang === "en"
    ? "Compass is momentarily out of range. Please try again."
    : "Pusula geçici olarak menzil dışında. Lütfen tekrar deneyin.";
}

function readOrCreateSession(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing && UUID_RE.test(existing)) return existing;
  } catch {
    /* sessionStorage can throw */
  }
  const id = crypto.randomUUID();
  try {
    sessionStorage.setItem(SESSION_KEY, id);
  } catch {
    /* keep the generated id in memory */
  }
  return id;
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("read_failed"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}
