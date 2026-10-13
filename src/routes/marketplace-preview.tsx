/**
 * Local / PR review only — mock authorised-dealer catalogue.
 * Not linked from production nav. Remove or gate before merging to main.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PartsCatalogBoard } from "@/components/marketplace/PartsCatalogBoard";
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

function MarketplacePreviewPage() {
  const { t, i18n } = useTranslation();
  const [toast, setToast] = useState<string | null>(null);
  const rawParts = useMemo(
    () => MOCK_PARTS.map((p, i) => ({ id: p.id, created_at: new Date(Date.now() - i * 86400000).toISOString() })),
    [],
  );

  useEffect(() => {
    void i18n.changeLanguage("tr");
  }, [i18n]);

  return (
    <div className="thalvo-dark thalvo-catalog min-h-dvh bg-[#0A192F] px-4 py-6 text-white sm:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <div className="rounded-xl border border-[color:color-mix(in_srgb,#F5B942_40%,transparent)] bg-[color:color-mix(in_srgb,#F5B942_12%,transparent)] px-4 py-3 text-[12px] leading-relaxed text-[#F5B942]">
          <p className="font-semibold uppercase tracking-[0.14em]">
            Skill geçişi · MarineOS token · canlıya yazılmaz
          </p>
          <p className="mt-1 text-[color:color-mix(in_srgb,#F5B942_85%,white)]">
            {t("marketplace.catalog.skill_pass_note")} — web sol / mobil alttan filtre. Onayınızdan sonra{" "}
            <code className="rounded bg-black/30 px-1">/app/marketplace</code>.
          </p>
          <Link to="/" className="mt-2 inline-block text-[11px] font-semibold text-cyan-300 hover:text-cyan-200">
            ← Ana sayfa
          </Link>
        </div>

        <MarketplaceShell eyebrow="THALVO · Marine Logistics" title="Pazar yeri">
          <PartsCatalogBoard
            parts={MOCK_PARTS}
            rawParts={rawParts}
            currencyFormat={(n) => formatTL(n)}
            onAdd={(p) => setToast(`${p.name} · sepete eklendi (önizleme)`)}
            onNotify={(p) => setToast(`${p.name} · stok haberi (önizleme)`)}
            onAskAi={(p) => setToast(`THALVO AI · ${p.name} (önizleme)`)}
          />
        </MarketplaceShell>

        {toast && (
          <div
            role="status"
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-cyan-400/30 bg-[#0f1c2e] px-4 py-2 text-[12px] text-cyan-100 shadow-xl"
          >
            {toast}
            <button type="button" className="ml-3 text-white/50 hover:text-white" onClick={() => setToast(null)}>
              kapat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
