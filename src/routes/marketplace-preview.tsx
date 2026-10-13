/**
 * Local / PR review only — mock authorised-dealer catalogue.
 * Design B (showroom) is preserved as the liked default for /app/marketplace.
 * Design C (day desk) is an alternative for comparison only.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PartsCatalogShowroom } from "@/components/marketplace/PartsCatalogShowroom";
import { PartsCatalogDayDesk } from "@/components/marketplace/PartsCatalogDayDesk";
import type { PartCardData } from "@/components/marketplace/PartCard";
import { MarketplaceShell } from "@/components/marketplace/MarketplaceShell";
import { formatTL } from "@/lib/filter";

export const Route = createFileRoute("/marketplace-preview")({
  ssr: false,
  component: MarketplacePreviewPage,
});

const MOCK_PARTS: PartCardData[] = [
  {
    id: "p1",
    name: "Yamaha F150 Impeller Kit",
    brand: "Yamaha",
    category: "outboard_parts",
    categoryLabel: "Dıştan takma motor parçaları",
    sku: "6CE-44352-00",
    imageUrl: null,
    price: 1850,
    stock: 6,
    compatibility: ["Yamaha F150", "Yamaha F175"],
    dealerName: "Thalvo Göcek Yetkili Bayi",
    dealerVerified: true,
    marina: "D-Marin Göcek",
    deliveryMode: "service_boat",
    deliveryMinutes: 45,
    distanceKm: 2.1,
  },
  {
    id: "p2",
    name: "Volvo Penta D4 Fuel Filter",
    brand: "Volvo Penta",
    category: "filters_oils",
    categoryLabel: "Filtre & yağlar",
    sku: "3581078",
    imageUrl: null,
    price: 1240,
    stock: 12,
    compatibility: ["D4-225", "D4-300"],
    dealerName: "Aegean Marine Parts",
    dealerVerified: true,
    marina: "Marmaris Yacht Marina",
    deliveryMode: "marina_pickup",
    deliveryMinutes: 20,
    distanceKm: 0.3,
  },
  {
    id: "p3",
    name: "Mercury Verado 300 Anode Kit",
    brand: "Mercury",
    category: "outboard_parts",
    categoryLabel: "Dıştan takma motor parçaları",
    sku: "8M0113726",
    imageUrl: null,
    price: 980,
    stock: 2,
    compatibility: ["Verado 300"],
    dealerName: "Bodrum Powerboats",
    dealerVerified: true,
    marina: "Milta Bodrum",
    deliveryMode: "service_boat",
    deliveryMinutes: 60,
    distanceKm: 8.4,
  },
  {
    id: "p4",
    name: "Raymarine Axiom+ 9 Chartplotter",
    brand: "Raymarine",
    category: "navigation_electronics",
    categoryLabel: "Seyir elektroniği",
    sku: "E70635",
    imageUrl: null,
    price: 68900,
    stock: 3,
    compatibility: ["NMEA 2000"],
    dealerName: "Thalvo Electronics Desk",
    dealerVerified: true,
    marina: "D-Marin Göcek",
    deliveryMode: "marina_pickup",
    deliveryMinutes: 30,
    distanceKm: 1.2,
  },
  {
    id: "p5",
    name: "Victron MultiPlus 12/3000",
    brand: "Victron",
    category: "electrical",
    categoryLabel: "Elektrik",
    sku: "PMP123021010",
    imageUrl: null,
    price: 42500,
    stock: 4,
    compatibility: ["12V house bank"],
    dealerName: "Blue Water Power",
    dealerVerified: true,
    marina: "Fethiye Ece Marina",
    deliveryMode: "service_boat",
    deliveryMinutes: 90,
    distanceKm: 18,
  },
  {
    id: "p6",
    name: "Lewmar V3 Windlass Gypsy Kit",
    brand: "Lewmar",
    category: "anchoring",
    categoryLabel: "Demirleme",
    sku: "66800041",
    imageUrl: null,
    price: 6400,
    stock: 0,
    compatibility: ["V3 / V4"],
    dealerName: "Deck & Anchor TR",
    dealerVerified: true,
    marina: "Didim Marina",
    deliveryMode: "service_boat",
    deliveryMinutes: null,
    distanceKm: 42,
  },
  {
    id: "p7",
    name: "Suzuki DF140A Water Pump Kit",
    brand: "Suzuki",
    category: "outboard_parts",
    categoryLabel: "Dıştan takma motor parçaları",
    sku: "17400-93J00",
    imageUrl: null,
    price: 2100,
    stock: 5,
    compatibility: ["DF140A"],
    dealerName: "Thalvo Göcek Yetkili Bayi",
    dealerVerified: true,
    marina: "D-Marin Göcek",
    deliveryMode: "service_boat",
    deliveryMinutes: 40,
    distanceKm: 2.4,
    emergencyCompatible: true,
  },
  {
    id: "p8",
    name: "Garmin GPSMAP 1223xsv",
    brand: "Garmin",
    category: "navigation_electronics",
    categoryLabel: "Seyir elektroniği",
    sku: "010-02367-01",
    imageUrl: null,
    price: 74500,
    stock: 2,
    compatibility: ["NMEA 2000", "Panoptix"],
    dealerName: "Thalvo Electronics Desk",
    dealerVerified: true,
    marina: "D-Marin Göcek",
    deliveryMode: "marina_pickup",
    deliveryMinutes: 25,
    distanceKm: 1.0,
  },
  {
    id: "p9",
    name: "Yanmar SD60 Sail Drive Anode",
    brand: "Yanmar",
    category: "inboard_parts",
    categoryLabel: "İçten takma motor parçaları",
    sku: "X21-SD60-AN",
    imageUrl: null,
    price: 760,
    stock: 9,
    compatibility: ["SD60"],
    dealerName: "Aegean Marine Parts",
    dealerVerified: true,
    marina: "Marmaris Yacht Marina",
    deliveryMode: "marina_pickup",
    deliveryMinutes: 15,
    distanceKm: 0.4,
  },
];

type DesignId = "B" | "C";

function MarketplacePreviewPage() {
  const { t, i18n } = useTranslation();
  const [design, setDesign] = useState<DesignId>("C");
  const [toast, setToast] = useState<string | null>(null);
  const rawParts = useMemo(
    () => MOCK_PARTS.map((p, i) => ({ id: p.id, created_at: new Date(Date.now() - i * 86400000).toISOString() })),
    [],
  );

  useEffect(() => {
    void i18n.changeLanguage("tr");
  }, [i18n]);

  const handlers = {
    onAdd: (p: PartCardData) => setToast(`${p.name} · sepete eklendi (önizleme)`),
    onNotify: (p: PartCardData) => setToast(`${p.name} · stok haberi (önizleme)`),
    onAskAi: (p: PartCardData) => setToast(`THALVO AI · ${p.name} (önizleme)`),
  };

  const catalog =
    design === "B" ? (
      <PartsCatalogShowroom
        parts={MOCK_PARTS}
        rawParts={rawParts}
        currencyFormat={(n) => formatTL(n)}
        {...handlers}
      />
    ) : (
      <PartsCatalogDayDesk
        parts={MOCK_PARTS}
        rawParts={rawParts}
        currencyFormat={(n) => formatTL(n)}
        {...handlers}
      />
    );

  return (
    <div
      className={
        design === "B"
          ? "thalvo-dark thalvo-catalog min-h-dvh bg-[#0A192F] px-4 py-6 text-white sm:px-6"
          : "min-h-dvh bg-[#EEF2F6] px-4 py-6 text-slate-900 sm:px-6"
      }
    >
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <div
          className={
            "rounded-xl border px-4 py-3 text-[12px] leading-relaxed " +
            (design === "B"
              ? "border-[color:color-mix(in_srgb,#F5B942_40%,transparent)] bg-[color:color-mix(in_srgb,#F5B942_12%,transparent)] text-[#F5B942]"
              : "border-slate-300 bg-white text-slate-700 shadow-sm")
          }
        >
          <p className="font-semibold uppercase tracking-[0.14em]">
            Önizleme · B saklı · C alternatif · canlıya yazılmaz
          </p>
          <p className="mt-1 opacity-90">
            Beğendiğiniz <strong>Tasarım B</strong> korunuyor (`/app/marketplace` varsayılanı). Aşağıda son
            alternatif <strong>Tasarım C</strong> (gündüz tezgâh).
          </p>
          <div className="mt-3 inline-flex rounded-xl border border-current/20 p-0.5">
            <button
              type="button"
              onClick={() => setDesign("B")}
              className={
                "h-9 rounded-lg px-3 text-[11px] font-bold " +
                (design === "B" ? "bg-[#F5B942] text-[#0A192F]" : "opacity-70 hover:opacity-100")
              }
            >
              {t("marketplace.catalog.design_b")}
            </button>
            <button
              type="button"
              onClick={() => setDesign("C")}
              className={
                "h-9 rounded-lg px-3 text-[11px] font-bold " +
                (design === "C" ? "bg-[#0A192F] text-white" : "opacity-70 hover:opacity-100")
              }
            >
              {t("marketplace.catalog.design_c")}
            </button>
          </div>
          <div className="mt-2">
            <Link
              to="/"
              className={
                "text-[11px] font-semibold " + (design === "B" ? "text-cyan-300" : "text-[#0A192F]")
              }
            >
              ← Ana sayfa
            </Link>
          </div>
        </div>

        {design === "B" ? (
          <MarketplaceShell eyebrow="THALVO · Marine Logistics" title="Pazar yeri">
            {catalog}
          </MarketplaceShell>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                THALVO · Marine Logistics
              </p>
              <h1 className="font-[Montserrat,ui-sans-serif,system-ui] text-2xl font-bold text-[#0A192F]">
                Pazar yeri
              </h1>
            </div>
            {catalog}
          </div>
        )}

        {toast && (
          <div
            role="status"
            className={
              "fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border px-4 py-2 text-[12px] shadow-xl " +
              (design === "B"
                ? "border-cyan-400/30 bg-[#0f1c2e] text-cyan-100"
                : "border-slate-200 bg-white text-slate-800")
            }
          >
            {toast}
            <button type="button" className="ml-3 opacity-50 hover:opacity-100" onClick={() => setToast(null)}>
              kapat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
