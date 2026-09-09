import { useTranslation } from "react-i18next";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { StatusChip } from "@/components/mission/StatusChip";
import { EmptyState } from "@/components/core/EmptyState";
import { UserCheck } from "lucide-react";

export interface RoleRequestRow {
  id: string;
  full_name: string | null;
  boat_name: string | null;
  requested_role: string;
  created_at: string;
}

interface Props {
  requests: RoleRequestRow[];
  /** id of the row currently being written, so its controls are disabled. */
  busyId: string | null;
  onApprove: (row: RoleRequestRow) => void;
  onReject: (row: RoleRequestRow) => void;
}

/** PendingRoleRequests — operators approve or clear pending role upgrades. */
export function PendingRoleRequests({ requests, busyId, onApprove, onReject }: Props) {
  const { t, i18n } = useTranslation();
  const fmt = new Intl.DateTimeFormat(i18n.language === "tr" ? "tr-TR" : "en-IE", {
    day: "2-digit", month: "short", year: "numeric",
  });

  return (
    <GlassPanel padded={false}>
      <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45 flex items-center gap-1.5">
            <UserCheck className="size-3.5" /> {t("admin.requests.title")}
          </p>
          <p className="text-sm font-semibold text-white mt-0.5">
            {t("admin.requests.count", { count: requests.length })}
          </p>
        </div>
        {requests.length > 0 && <StatusChip tone="warning">{requests.length}</StatusChip>}
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={<UserCheck className="size-4" />}
          title={t("admin.requests.empty_title")}
          body={t("admin.requests.empty_body")}
        />
      ) : (
        <ul className="divide-y divide-white/[0.05] max-h-[320px] overflow-y-auto">
          {requests.map((r) => {
            const busy = busyId === r.id;
            return (
              <li key={r.id} className="px-4 py-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-white truncate">
                      {r.full_name ?? t("admin.requests.unnamed")}
                    </p>
                    <p className="text-[10px] text-white/60 truncate">
                      {r.boat_name ?? t("admin.requests.no_boat")} · {fmt.format(new Date(r.created_at))}
                    </p>
                  </div>
                  <StatusChip tone="info">{r.requested_role}</StatusChip>
                </div>
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onApprove(r)}
                    className="h-8 flex-1 rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200 hover:bg-emerald-400/20 disabled:opacity-40 transition-colors"
                  >
                    {t("admin.requests.approve")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onReject(r)}
                    className="h-8 flex-1 rounded-lg border border-white/15 bg-white/[0.06] text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80 hover:bg-white/[0.12] disabled:opacity-40 transition-colors"
                  >
                    {t("admin.requests.reject")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </GlassPanel>
  );
}
