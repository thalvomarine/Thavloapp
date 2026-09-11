import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Ban, Check, Loader2, Radio, Shield, Trash2, UserCog, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { EmptyState } from "@/components/core/EmptyState";
import { formatDegrees } from "@/lib/marine-data";
import { createRealtimeBuffer } from "@/lib/schedule";

type UserRole = "Client" | "Provider" | "Supplier";
type JobFilter = "all" | "pending" | "assigned" | "done";

interface DirectoryUser {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  boat_name: string | null;
  home_marina: string | null;
  is_available: boolean;
  service_type: "Marine Mechanic" | "Underwater Diver" | null;
}

interface JobRow {
  id: string;
  problem_category: string;
  status: string;
  marina: string | null;
  lat: number | null;
  lng: number | null;
  total_escrow_pool: number | null;
  provider_id: string | null;
  client_id: string;
  created_at: string;
  client?: { full_name: string | null } | null;
  provider?: { full_name: string | null } | null;
}

interface SosRow {
  id: string;
  status: string;
  category: string;
  vessel_name: string;
  bay_name: string | null;
  lat: number;
  lng: number;
  assigned_provider_id: string | null;
  created_at: string;
}

const PENDING_JOB = new Set(["Pending", "Offered"]);
const ASSIGNED_JOB = new Set(["Accepted", "EnRoute", "OnSite", "PartsPending", "InProgress"]);
const DONE_JOB = new Set(["Completed", "Cancelled"]);

function directoryKind(u: DirectoryUser): string {
  if (u.role === "Client") return "captain";
  if (u.role === "Supplier") return "supplier";
  if (u.service_type === "Underwater Diver") return "diver";
  if (u.service_type === "Marine Mechanic") return "technician";
  return "provider";
}

export function SuperadminDesk() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [sos, setSos] = useState<SosRow[]>([]);
  const [providers, setProviders] = useState<Array<{ id: string; full_name: string }>>([]);
  const [filter, setFilter] = useState<JobFilter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    await supabase.rpc("ensure_superadmin");
    const [dir, prof, jobRes, sosRes, details] = await Promise.all([
      supabase.rpc("admin_list_users"),
      supabase
        .from("profiles")
        .select("id, full_name, phone, role, boat_name, home_marina, is_available"),
      supabase
        .from("jobs")
        .select(
          "id, problem_category, status, marina, lat, lng, total_escrow_pool, provider_id, client_id, created_at, client:profiles!jobs_client_id_fkey(full_name), provider:profiles!jobs_provider_id_fkey(full_name)",
        )
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("emergency_service_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("provider_details").select("id, service_type"),
    ]);

    const byId = new Map((prof.data ?? []).map((p) => [p.id, p]));
    const svcById = new Map(
      (details.data ?? []).map((d) => [d.id, d.service_type as DirectoryUser["service_type"]]),
    );
    const directory: DirectoryUser[] = ((dir.data as Array<{
      id: string;
      email: string;
      full_name: string;
      phone: string;
      role: UserRole;
    }> | null) ?? []).map((row) => {
      const p = byId.get(row.id);
      return {
        id: row.id,
        email: row.email,
        full_name: p?.full_name || row.full_name,
        phone: p?.phone ?? row.phone,
        role: (p?.role as UserRole) ?? row.role,
        boat_name: p?.boat_name ?? null,
        home_marina: p?.home_marina ?? null,
        is_available: p?.is_available ?? true,
        service_type: svcById.get(row.id) ?? null,
      };
    });
    if (directory.length === 0 && prof.data) {
      setUsers(
        prof.data.map((p) => ({
          id: p.id,
          email: "—",
          full_name: p.full_name,
          phone: p.phone,
          role: p.role as UserRole,
          boat_name: p.boat_name,
          home_marina: p.home_marina,
          is_available: p.is_available,
          service_type: svcById.get(p.id) ?? null,
        })),
      );
    } else {
      setUsers(directory);
    }

    setJobs((jobRes.data as unknown as JobRow[]) ?? []);
    setSos((sosRes.data as SosRow[] | null) ?? []);
    setProviders(
      (prof.data ?? [])
        .filter((p) => p.role === "Provider")
        .map((p) => ({ id: p.id, full_name: p.full_name || p.id.slice(0, 8) })),
    );
    setLoading(false);
    if (dir.error) console.warn("[superadmin] admin_list_users", dir.error.message);
    if (jobRes.error) console.warn("[superadmin] jobs", jobRes.error.message);
    if (sosRes.error) console.warn("[superadmin] sos", sosRes.error.message);
  }, []);

  useEffect(() => {
    void load();
    const buffer = createRealtimeBuffer(() => {
      void load();
    }, 180);
    const ch = supabase
      .channel("superadmin-desk")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => buffer.ping())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => buffer.ping())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "emergency_service_requests" },
        () => buffer.ping(),
      )
      .subscribe();
    return () => {
      buffer.dispose();
      supabase.removeChannel(ch);
    };
  }, [load]);

  const run = async (id: string, fn: () => Promise<{ error: { message: string } | null }>) => {
    setBusy(id);
    const { error } = await fn();
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("admin.super.saved"));
    await load();
  };

  const visibleJobs = useMemo(() => {
    if (filter === "pending") return jobs.filter((j) => PENDING_JOB.has(j.status));
    if (filter === "assigned") return jobs.filter((j) => ASSIGNED_JOB.has(j.status));
    if (filter === "done") return jobs.filter((j) => DONE_JOB.has(j.status));
    return jobs;
  }, [jobs, filter]);

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-white/60">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-300/80">
          {t("admin.super.eyebrow")}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-white">{t("admin.super.title")}</h1>
        <p className="mt-1 text-[12px] text-white/55">{t("admin.super.subtitle")}</p>
      </header>

      <GlassPanel padded={false}>
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] p-4">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
              <UserCog className="size-3.5" /> {t("admin.super.users")}
            </p>
            <p className="text-sm font-semibold text-white">{users.length}</p>
          </div>
        </div>
        {users.length === 0 ? (
          <EmptyState icon={<Shield className="size-4" />} title={t("admin.super.users_empty")} />
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[720px] text-left text-[12px]">
              <thead className="sticky top-0 bg-[#0a192f] text-[10px] uppercase tracking-[0.14em] text-white/40">
                <tr>
                  <th className="px-3 py-2 font-semibold">{t("admin.super.col_name")}</th>
                  <th className="px-3 py-2 font-semibold">{t("admin.email")}</th>
                  <th className="px-3 py-2 font-semibold">{t("admin.phone")}</th>
                  <th className="px-3 py-2 font-semibold">{t("admin.super.col_boat")}</th>
                  <th className="px-3 py-2 font-semibold">{t("admin.super.col_marina")}</th>
                  <th className="px-3 py-2 font-semibold">{t("admin.super.col_role")}</th>
                  <th className="px-3 py-2 font-semibold">{t("admin.super.col_actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {users.map((u) => (
                  <tr key={u.id} className={u.is_available ? "" : "opacity-50"}>
                    <td className="px-3 py-2 font-semibold text-white">{u.full_name || "—"}</td>
                    <td className="px-3 py-2 text-white/70">{u.email}</td>
                    <td className="px-3 py-2 text-white/70">{u.phone || t("admin.no_phone")}</td>
                    <td className="px-3 py-2 text-white/70">{u.boat_name || "—"}</td>
                    <td className="px-3 py-2 text-white/70">{u.home_marina || "—"}</td>
                    <td className="px-3 py-2">
                      <select
                        value={directoryKind(u)}
                        disabled={busy === u.id}
                        onChange={(e) => {
                          const kind = e.target.value;
                          void run(u.id, async () => {
                            const primary = await supabase.rpc("admin_set_directory_role", {
                              _user_id: u.id,
                              _kind: kind,
                            });
                            if (!primary.error) return primary;
                            const role: UserRole =
                              kind === "captain" ? "Client" : kind === "supplier" ? "Supplier" : "Provider";
                            return supabase.rpc("approve_role_request", {
                              _user_id: u.id,
                              _role: role,
                            });
                          });
                        }}
                        className="h-8 rounded-lg border border-white/15 bg-white/5 px-2 text-[11px] text-white"
                      >
                        <option value="captain">{t("admin.super.role_captain")}</option>
                        <option value="provider">{t("admin.super.role_provider")}</option>
                        <option value="diver">{t("admin.super.role_diver")}</option>
                        <option value="technician">{t("admin.super.role_technician")}</option>
                        <option value="supplier">{t("admin.super.role_supplier")}</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={busy === u.id}
                          onClick={() =>
                            void run(u.id, () =>
                              supabase.rpc("admin_set_user_available", {
                                _user_id: u.id,
                                _available: true,
                              }),
                            )
                          }
                          className="grid size-8 place-items-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                          title={t("admin.super.approve")}
                        >
                          <Check className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={busy === u.id}
                          onClick={() =>
                            void run(u.id, () =>
                              supabase.rpc("admin_set_user_available", {
                                _user_id: u.id,
                                _available: false,
                              }),
                            )
                          }
                          className="grid size-8 place-items-center rounded-lg border border-rose-400/30 bg-rose-500/10 text-rose-200"
                          title={t("admin.super.ban")}
                        >
                          <Ban className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>

      <GlassPanel padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] p-4">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
              <Radio className="size-3.5" /> {t("admin.super.jobs")}
            </p>
            <p className="text-sm font-semibold text-white">
              {visibleJobs.length} · SOS {sos.filter((s) => s.status === "pending").length}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["all", "admin.super.filter_all"],
                ["pending", "admin.super.filter_pending"],
                ["assigned", "admin.super.filter_assigned"],
                ["done", "admin.super.filter_done"],
              ] as const
            ).map(([id, key]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={
                  "h-8 rounded-full border px-3 text-[10px] font-bold uppercase tracking-[0.12em] " +
                  (filter === id
                    ? "border-cyan-300/50 bg-cyan-400/20 text-cyan-50"
                    : "border-white/10 bg-white/[0.04] text-white/50")
                }
              >
                {t(key)}
              </button>
            ))}
          </div>
        </div>
        {visibleJobs.length === 0 ? (
          <EmptyState icon={<Radio className="size-4" />} title={t("admin.super.jobs_empty")} />
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {visibleJobs.map((j) => (
              <li key={j.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {t(`problems.${j.problem_category}`, { defaultValue: j.problem_category })}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/50">
                      {t(`status.${j.status}`, { defaultValue: j.status })}
                      {j.marina ? ` · ${j.marina}` : ""}
                      {j.lat != null && j.lng != null
                        ? ` · ${formatDegrees(Number(j.lat), Number(j.lng))}`
                        : ""}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/45">
                      {t("admin.super.captain")}: {j.client?.full_name ?? j.client_id.slice(0, 8)}
                      {" · "}
                      {t("admin.super.assignee")}: {j.provider?.full_name ?? t("admin.super.unassigned")}
                      {j.total_escrow_pool
                        ? ` · ₺${Math.round(Number(j.total_escrow_pool)).toLocaleString("tr-TR")}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <select
                      defaultValue=""
                      disabled={busy === j.id}
                      onChange={(e) => {
                        const pid = e.target.value;
                        if (!pid) return;
                        void run(j.id, () =>
                          supabase.rpc("admin_reassign_job", {
                            _job_id: j.id,
                            _provider_id: pid,
                          }),
                        );
                        e.target.value = "";
                      }}
                      className="h-8 max-w-[10rem] rounded-lg border border-white/15 bg-white/5 px-2 text-[11px] text-white"
                    >
                      <option value="">{t("admin.super.reassign")}</option>
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy === j.id}
                      onClick={() => void run(j.id, () => supabase.rpc("admin_close_job", { _job_id: j.id }))}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-100"
                    >
                      <XCircle className="size-3.5" /> {t("admin.super.close")}
                    </button>
                    <button
                      type="button"
                      disabled={busy === j.id}
                      onClick={() => void run(j.id, () => supabase.rpc("admin_delete_job", { _job_id: j.id }))}
                      className="grid size-8 place-items-center rounded-lg border border-rose-400/30 bg-rose-500/10 text-rose-200"
                      title={t("admin.super.delete")}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {sos.length > 0 && (
          <div className="border-t border-white/[0.06] p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-200/80">
              {t("admin.super.sos")}
            </p>
            <ul className="space-y-2">
              {sos.slice(0, 12).map((row) => (
                <li key={row.id} className="rounded-xl border border-rose-400/20 bg-rose-500/5 px-3 py-2 text-[12px]">
                  <p className="font-semibold text-white">
                    {row.vessel_name || t("esvc.unnamed_vessel")} · {row.status}
                  </p>
                  <p className="text-white/50">
                    {row.category}
                    {row.bay_name ? ` · ${row.bay_name}` : ""} ·{" "}
                    {formatDegrees(row.lat, row.lng)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
