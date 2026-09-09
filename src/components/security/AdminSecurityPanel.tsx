import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { StatusChip } from "@/components/mission/StatusChip";
import { SecurityEventCard, type SecurityEvent } from "./SecurityEventCard";
import { ShieldCheck, ShieldAlert, Radio } from "lucide-react";
import { classifyLeakRisk } from "@/lib/security";

interface MessageRow {
  id: string;
  text: string;
  masked: boolean;
  blocked_terms: string[] | null;
  created_at: string;
  job_id: string;
}

/**
 * AdminSecurityPanel — anti-leak visibility for admin/operator role.
 * Real signals come from job_messages.masked / blocked_terms (populated by
 * the server-side mask_job_message trigger). No fake logs.
 *
 * TODO(security-events): swap this derivation for a dedicated
 *   `security_events` append-only table once introduced. That table
 *   should also capture client-side high-risk blocks that never reach
 *   the DB (MessageLeakGuard blocks the insert entirely).
 */
export function AdminSecurityPanel() {
  const [rows, setRows] = useState<MessageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("job_messages")
      .select("id, text, masked, blocked_terms, created_at, job_id")
      .eq("masked", true)
      .order("created_at", { ascending: false })
      .limit(40)
      .then(({ data, error }) => {
        if (error) { setError(error.message); return; }
        setRows((data as MessageRow[]) ?? []);
      });
  }, []);

  const events = useMemo<SecurityEvent[]>(() => {
    if (!rows) return [];
    return rows.map((r) => {
      const report = classifyLeakRisk(r.text);
      return {
        id: r.id,
        risk: report.risk === "safe" ? "medium" : report.risk, // masked ⇒ at least medium
        summary: r.text.slice(0, 90),
        detail: `Mission ${r.job_id.slice(0, 8)} · ${(r.blocked_terms ?? []).join(", ") || "masked"}`,
        timestamp: r.created_at,
        categories: r.blocked_terms ?? report.categories,
      };
    });
  }, [rows]);

  const termCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows ?? []) {
      for (const t of r.blocked_terms ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [rows]);

  const blockedCount = rows?.length ?? 0;

  return (
    <div className="space-y-3">
      <GlassPanel padded={false}>
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45 flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" /> Security barrier
            </p>
            <p className="text-sm font-semibold text-white mt-0.5">
              {blockedCount} masked message{blockedCount === 1 ? "" : "s"}
            </p>
          </div>
          <StatusChip tone="success">Active</StatusChip>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/[0.05]">
          <ProtectionCell label="Phone masking" ok />
          <ProtectionCell label="Email masking" ok />
          <ProtectionCell label="IBAN blocking" ok />
          <ProtectionCell label="Escrow leak guard" ok />
        </div>
      </GlassPanel>

      <GlassPanel padded={false}>
        <div className="p-4 border-b border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
            Top risky terms
          </p>
        </div>
        <ul className="p-3 flex flex-wrap gap-1.5">
          {termCounts.length === 0 && (
            <li className="text-[11px] text-white/40 px-1 py-1">No risky terms recorded yet.</li>
          )}
          {termCounts.map(([term, count]) => (
            <li
              key={term}
              className="text-[10px] uppercase tracking-[0.14em] rounded-full border border-amber-400/25 bg-amber-400/10 text-amber-200 px-2 py-1"
            >
              {term} · {count}
            </li>
          ))}
        </ul>
      </GlassPanel>

      <GlassPanel padded={false}>
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45 flex items-center gap-1.5">
            <Radio className="size-3.5" /> Recent security events
          </p>
          <span className="text-[10px] text-white/40">Event logging ready</span>
        </div>
        <div className="p-3 space-y-2 max-h-[360px] overflow-y-auto">
          {rows == null && !error && (
            <p className="text-center text-[11px] text-white/40 py-6">Loading…</p>
          )}
          {error && (
            <p className="text-center text-[11px] text-white/40 py-6">
              Security event logging ready — no accessible records yet.
            </p>
          )}
          {rows && rows.length === 0 && (
            <p className="text-center text-[11px] text-white/40 py-6">
              No masked messages recorded. Barrier is holding.
            </p>
          )}
          {events.map((e) => (
            <SecurityEventCard key={e.id} event={e} />
          ))}
        </div>
      </GlassPanel>
    </div>
  );
}

function ProtectionCell({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="p-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className={`mt-1 text-[12px] font-semibold flex items-center gap-1.5 ${ok ? "text-emerald-300" : "text-amber-300"}`}>
        {ok ? <ShieldCheck className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
        {ok ? "Protected" : "Attention"}
      </p>
    </div>
  );
}
