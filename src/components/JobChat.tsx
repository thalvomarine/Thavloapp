import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { filterMessage } from "@/lib/filter";
import { sanitizeMultiline } from "@/lib/sanitize";
import { classifyLeakRisk, riskCopy } from "@/lib/security";
import { SecurityWarningBanner } from "@/components/security/SecurityWarningBanner";
import { emitEvent } from "@/lib/events";
import { AlertTriangle, Send, ShieldCheck } from "lucide-react";

interface Message {
  id: string;
  sender_id: string;
  text: string;
  masked: boolean;
  created_at: string;
}

export function JobChat({ jobId, meId }: { jobId: string; meId: string }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [alert, setAlert] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    supabase.from("job_messages").select("id,sender_id,text,masked,created_at").eq("job_id", jobId).order("created_at").then(({ data }) => {
      if (mounted && data) setMessages(data as Message[]);
    });
    const ch = supabase
      .channel(`chat:${jobId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "job_messages", filter: `job_id=eq.${jobId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message]))
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [jobId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const preflight = classifyLeakRisk(text);
  const blocked = preflight.risk === "high";
  const preflightCopy = riskCopy(preflight.risk);

  const send = async () => {
    if (!text.trim() || sending) return;
    // Client-side barrier: refuse high-risk sends outright. DB trigger
    // masks anything else that slips through as defense-in-depth.
    if (blocked) {
      setAlert(true);
      // M7: log blocked send attempt as telemetry.
      emitEvent({
        type: "chat.high_risk_blocked",
        subject_type: "chat",
        subject_id: jobId,
        metadata: { categories: preflight.categories, signal_count: preflight.signals.length },
      });
      return;
    }
    const filtered = filterMessage(sanitizeMultiline(text, 2000));
    if (filtered.masked) setAlert(true);
    setSending(true);
    await supabase.from("job_messages").insert({
      job_id: jobId,
      sender_id: meId,
      text: filtered.text,
      masked: filtered.masked,
      blocked_terms: filtered.blocked,
    });
    setText("");
    setSending(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-2.5 bg-deep text-white flex items-center gap-2">
        <ShieldCheck className="size-4 text-aqua" />
        <p className="text-sm font-bold">{t("chat.title")}</p>
      </div>
      <p className="px-4 py-2 text-[11px] text-muted-foreground bg-muted/40">{t("chat.masked_notice")}</p>

      {alert && (
        <div className="mx-3 mt-3 rounded-xl border-2 border-destructive/70 bg-destructive/10 p-3 flex items-start gap-2">
          <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
          <div className="text-xs font-semibold text-destructive">{t("chat.security_alert")}</div>
        </div>
      )}

      <div ref={scrollRef} className="h-72 overflow-y-auto px-3 py-3 space-y-2 bg-background">
        {messages.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className={"flex " + (mine ? "justify-end" : "justify-start")}>
              <div className={"max-w-[80%] px-3 py-2 rounded-2xl text-sm " + (mine ? "bg-deep text-white rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm")}>
                {m.text}
                {m.masked && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-destructive-foreground bg-destructive px-1.5 py-0.5 rounded">{t("chat.blocked")}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-2 border-t border-border">
        {preflight.risk !== "safe" && text.trim() && (
          <div className="mb-2">
            <SecurityWarningBanner
              risk={preflight.risk}
              title={preflightCopy.title}
              body={preflightCopy.body}
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder={t("chat.placeholder")}
            className="flex-1 h-10 rounded-full border border-input bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={send}
            disabled={sending || blocked}
            title={blocked ? preflightCopy.body : undefined}
            className="size-10 rounded-full marine-gradient text-white grid place-items-center disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
