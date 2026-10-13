/**
 * Local / PR review only — mock authorised-dealer catalogue + boat desk.
 * Design C is the `/app/marketplace` default (parts + boats share .thalvo-desk).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PartsCatalogShowroom } from "@/components/marketplace/PartsCatalogShowroom";
import { PartsCatalogDayDesk } from "@/components/marketplace/PartsCatalogDayDesk";
import { BoatsTendersBoard } from "@/components/marketplace/BoatsTendersBoard";
import type { PartCardData } from "@/components/marketplace/PartCard";
import { MarketplaceShell } from "@/components/marketplace/MarketplaceShell";
import { formatTL } from "@/lib/filter";
import { useThalvoTheme, type ThalvoTheme } from "@/lib/theme";
import type { BoatListing } from "@/lib/boat-listings";

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
type MarketTab = "boats" | "spare_parts";

const THEMES: ThalvoTheme[] = ["system", "day", "night"];
const PREVIEW_OWNER = "preview-owner";

const MOCK_BOATS: BoatListing[] = [
  {
    id: "b1",
    title: "2021 Beneteau Oceanis 40.1",
    year: 2021,
    price: 285000,
    currency: "EUR",
    marina: "Göcek D-Marin",
    region: "Göcek",
    hull: "sail",
    loaM: 12.87,
    beamM: 4.18,
    draftM: 2.17,
    engineBrand: "Yanmar 45 HP",
    engineHp: 45,
    engineHours: 420,
    fuel: "diesel",
    flag: "Türkiye",
    cabins: 3,
    berths: 6,
    cruiseKn: 7,
    fuelTankL: 200,
    waterTankL: 330,
    lat: 36.7578,
    lng: 28.9412,
    equipment: ["Bow Thruster", "Autopilot", "Solar"],
    description: "Ege için bakımlı cruiser. Son sezon Göcek’te bağlandı.",
    seller: "Ege Broker Desk",
    sellerPhone: "+905321112233",
    hue: "navy",
    status: "live",
  },
  {
    id: "b2",
    title: "2019 Axopar 28 Cabin",
    year: 2019,
    price: 168000,
    currency: "EUR",
    marina: "Bodrum Milta",
    region: "Bodrum",
    hull: "motor",
    loaM: 9.1,
    beamM: 2.95,
    draftM: 0.85,
    engineBrand: "Mercury Verado 300",
    engineHp: 300,
    engineHours: 310,
    fuel: "petrol",
    flag: "Türkiye",
    cabins: 1,
    berths: 2,
    cruiseKn: 28,
    fuelTankL: 280,
    waterTankL: 80,
    lat: 37.0342,
    lng: 27.4298,
    equipment: ["Joystick", "Chartplotter", "T-Top"],
    description: "Günübirlik ve ada geçişleri için hızlı cabin RIB ailesi.",
    seller: "Bodrum Powerboats",
    sellerPhone: "+905324445566",
    hue: "teal",
    status: "live",
  },
  {
    id: "b3",
    title: "2018 Lagoon 42",
    year: 2018,
    price: 420000,
    currency: "EUR",
    marina: "Marmaris Yacht Marina",
    region: "Marmaris",
    hull: "catamaran",
    loaM: 12.8,
    beamM: 7.7,
    draftM: 1.25,
    engineBrand: "Yanmar 2x57 HP",
    engineHp: 114,
    engineHours: 980,
    fuel: "diesel",
    flag: "Malta",
    cabins: 4,
    berths: 8,
    cruiseKn: 8,
    fuelTankL: 300,
    waterTankL: 300,
    lat: 36.851,
    lng: 28.274,
    equipment: ["Generator", "Watermaker", "Air Conditioning"],
    description: "Aile ve charter için geniş katamaran; marmaris bağlama.",
    seller: "Marmaris Yacht Desk",
    sellerPhone: "+905327778899",
    hue: "gold",
    ownerId: PREVIEW_OWNER,
    status: "live",
  },
];

function MarketplacePreviewPage() {
  const { t, i18n } = useTranslation();
  const { theme, choose } = useThalvoTheme();
  const [design, setDesign] = useState<DesignId>("C");
  const [tab, setTab] = useState<MarketTab>("boats");
  const [toast, setToast] = useState<string | null>(null);
  const [boats, setBoats] = useState<BoatListing[]>(MOCK_BOATS);
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

  const partsCatalog =
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
    <div className="thalvo-dark thalvo-cockpit thalvo-desk min-h-dvh bg-[var(--desk-canvas)] px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <div className="rounded-xl border border-[var(--desk-border)] bg-[var(--desk-paper)] px-4 py-3 text-[12px] leading-relaxed text-[var(--desk-ink)] shadow-[var(--desk-shadow)]">
          <p className="font-semibold uppercase tracking-[0.14em] text-[var(--desk-muted)]">
            Önizleme · bot + yedek parça aynı tezgâh
          </p>
          <p className="mt-1 text-[var(--desk-muted)]">
            Tema siteyle aynı kaynaktan gelir: <strong>sistem / gündüz / gece</strong>. Canlıya yazılmaz.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="inline-flex rounded-xl border border-[var(--desk-border)] p-0.5">
              {THEMES.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => choose(id)}
                  className={
                    "h-9 rounded-lg px-3 text-[11px] font-bold uppercase " +
                    (theme === id
                      ? "bg-[var(--desk-accent)] text-[var(--desk-accent-fg)]"
                      : "text-[var(--desk-muted)] hover:text-[var(--desk-ink)]")
                  }
                >
                  {id === "system" ? "Sistem" : id === "day" ? "Gündüz" : "Gece"}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-xl border border-[var(--desk-border)] p-0.5">
              <button
                type="button"
                onClick={() => setDesign("B")}
                className={
                  "h-9 rounded-lg px-3 text-[11px] font-bold " +
                  (design === "B"
                    ? "bg-[var(--desk-price)] text-[#0A192F]"
                    : "text-[var(--desk-muted)] hover:text-[var(--desk-ink)]")
                }
              >
                {t("marketplace.catalog.design_b")}
              </button>
              <button
                type="button"
                onClick={() => setDesign("C")}
                className={
                  "h-9 rounded-lg px-3 text-[11px] font-bold " +
                  (design === "C"
                    ? "bg-[var(--desk-accent)] text-[var(--desk-accent-fg)]"
                    : "text-[var(--desk-muted)] hover:text-[var(--desk-ink)]")
                }
              >
                {t("marketplace.catalog.design_c")}
              </button>
            </div>
          </div>
          <div className="mt-2">
            <Link to="/" className="text-[11px] font-semibold text-[var(--desk-ink)]">
              ← Ana sayfa
            </Link>
          </div>
        </div>

        {design === "B" ? (
          <MarketplaceShell eyebrow="THALVO · Marine Logistics" title="Pazar yeri">
            {partsCatalog}
          </MarketplaceShell>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--desk-muted)]">
                THALVO · Marine Logistics
              </p>
              <h1 className="thalvo-desk-title text-2xl tracking-tight text-[var(--desk-ink)]">Pazar yeri</h1>
            </div>
            <div
              className="grid w-full grid-cols-2 gap-1.5"
              role="tablist"
              aria-label={t("marketplace.category.label")}
            >
              {(["boats", "spare_parts"] as const).map((c) => {
                const selected = tab === c;
                return (
                  <button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setTab(c)}
                    className={
                      "h-10 rounded-xl border px-2.5 text-[12px] font-semibold " +
                      (selected
                        ? "border-[var(--desk-accent)] bg-[var(--desk-accent)] text-[var(--desk-accent-fg)]"
                        : "border-[var(--desk-border)] bg-[var(--desk-paper)] text-[var(--desk-muted)]")
                    }
                  >
                    {t(`marketplace.category.${c}`)}
                  </button>
                );
              })}
            </div>
            {tab === "boats" ? (
              <BoatsTendersBoard
                extraListings={boats}
                ownerId={PREVIEW_OWNER}
                onEdit={(boat) => setToast(`Düzenle · ${boat.title} (önizleme)`)}
                onSetStatus={(id, status) => {
                  setBoats((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
                  setToast(status === "paused" ? "İlan yayından kaldırıldı (önizleme)" : "İlan yayında (önizleme)");
                }}
              />
            ) : (
              partsCatalog
            )}
          </div>
        )}

        {toast && (
          <div
            role="status"
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-[var(--desk-border)] bg-[var(--desk-paper)] px-4 py-2 text-[12px] text-[var(--desk-ink)] shadow-xl"
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
