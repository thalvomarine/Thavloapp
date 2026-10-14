import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { distanceNm, etaMinutes, knotsFromMps } from "@/lib/range";

const SERVICE_SPEED_KTS = 8;

export function VesselRange({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
}) {
  const { t } = useTranslation();
  const [own, setOwn] = useState<{ lat: number; lng: number; speedKts: number | null } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setOwn({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speedKts: knotsFromMps(pos.coords.speed),
        });
      },
      () => setOwn(null),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 12000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const nm = own ? distanceNm(own.lat, own.lng, lat, lng) : null;
  const speed = own?.speedKts ?? SERVICE_SPEED_KTS;
  const eta = nm == null ? null : etaMinutes(nm, speed);
  const assumed = own?.speedKts == null;

  return (
    <div
      className="grid grid-cols-2 gap-2 rounded-2xl border p-3"
      style={{
        borderColor: "var(--sheet-active-border, rgb(245 185 66 / 0.5))",
        background: "var(--sheet-active-bg, rgb(245 185 66 / 0.16))",
      }}
    >
      <div>
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: "var(--sheet-active-ink, #f5b942)" }}
        >
          {t("ops.distance")}
        </p>
        <p
          className="mt-1 text-lg font-semibold tabular-nums"
          style={{ color: "var(--sheet-ink, #fff)" }}
        >
          {nm == null ? "—" : `${nm.toFixed(nm < 10 ? 1 : 0)} NM`}
        </p>
      </div>
      <div>
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: "var(--sheet-active-ink, #f5b942)" }}
        >
          {t("ops.eta")}
        </p>
        <p
          className="mt-1 text-lg font-semibold tabular-nums"
          style={{ color: "var(--sheet-ink, #fff)" }}
        >
          {eta == null ? "—" : t("ops.eta_min", { min: eta })}
        </p>
        <p className="text-[10px]" style={{ color: "var(--sheet-faint, rgb(255 255 255 / 0.45))" }}>
          {assumed
            ? t("ops.eta_assumed", { kts: SERVICE_SPEED_KTS })
            : t("ops.eta_live", { kts: speed.toFixed(1) })}
        </p>
      </div>
    </div>
  );
}
