import { formatTL } from "@/lib/filter";
import { GlassPanel } from "@/components/mission/GlassPanel";
import { StatusChip } from "@/components/mission/StatusChip";
import { LiveMap, type LivePin, type LiveRoute } from "@/components/LiveMap";
import { pickValidCoordinates } from "@/lib/geolocation";
import { AlertTriangle, ChevronRight, Ship } from "lucide-react";

export interface MissionRow {
  id: string;
  problem_category: string;
  status: string;
  marina: string | null;
  service_type: string | null;
  total_escrow_pool: number | null;
  created_at: string;
  lat: number | null;
  lng: number | null;
  provider_id?: string | null;
  sos?: boolean;
}

interface Props {
  missions: MissionRow[];
  providers: LivePin[];
  /** Live dispatch route lines — responding boat to assigned job. */
  routes?: LiveRoute[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
}

function toneFor(
  status: string,
  sos?: boolean,
): "danger" | "warning" | "info" | "success" | "neutral" {
  if (sos || status === "Requested") return "danger";
  if (["Accepted", "EnRoute", "OnSite"].includes(status)) return "info";
  if (status === "PartsPending") return "warning";
  if (status === "InProgress") return "info";
  if (status === "Completed") return "success";
  return "neutral";
}

/** MissionCommandBoard — map + live mission list, aviation ops style. */
export function MissionCommandBoard({
  missions,
  providers,
  routes = [],
  selectedId,
  onSelect,
}: Props) {
  const mapPins: LivePin[] = [
    ...providers,
    ...pickValidCoordinates(missions).map<LivePin>((m) => ({
      id: `job-${m.id}`,
      name: m.problem_category,
      lat: Number(m.lat),
      lng: Number(m.lng),
      kind: m.service_type === "Underwater Diver" ? "diver" : "mechanic",
    })),
  ];

  return (
    <GlassPanel padded={false} className="overflow-hidden">
      <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
            Mission board
          </p>
          <p className="text-sm font-semibold text-white mt-0.5">
            {missions.length} live · {providers.length} providers on grid
          </p>
        </div>
        <StatusChip tone="info">Realtime</StatusChip>
      </div>

      <div className="relative">
        <LiveMap providers={mapPins} routes={routes} height={320} variant="dark" />
      </div>

      <ul className="divide-y divide-white/[0.05] max-h-[360px] overflow-y-auto">
        {missions.length === 0 && (
          <li className="p-6 text-center text-xs text-white/40">No active missions.</li>
        )}
        {missions.map((m) => {
          const active = m.id === selectedId;
          const tone = toneFor(m.status, m.sos);
          return (
            <li key={m.id}>
              <button
                onClick={() => onSelect(m.id)}
                className={
                  "w-full text-left px-4 py-3 flex items-center gap-3 transition-colors " +
                  (active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]")
                }
              >
                <div
                  className={
                    "size-9 rounded-xl grid place-items-center border " +
                    (m.sos
                      ? "bg-rose-500/15 border-rose-400/40 text-rose-300"
                      : "bg-white/5 border-white/10 text-white/70")
                  }
                >
                  {m.sos ? <AlertTriangle className="size-4" /> : <Ship className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white truncate">
                      {m.problem_category}
                    </p>
                    <StatusChip tone={tone}>{m.status}</StatusChip>
                  </div>
                  <p className="text-[11px] text-white/50 truncate">
                    {m.marina ?? "Unknown marina"} ·{" "}
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-white">
                    {m.total_escrow_pool ? formatTL(Math.round(Number(m.total_escrow_pool))) : "—"}
                  </p>
                  <ChevronRight className="inline size-4 text-white/30" />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </GlassPanel>
  );
}
