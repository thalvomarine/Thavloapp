export type HullType = "sail" | "motor" | "catamaran" | "rib";
export type ListingCurrency = "EUR" | "USD" | "TRY";
export type FuelType = "diesel" | "petrol";
export type BoatHue = "navy" | "teal" | "gold" | "slate" | "wine";

export const HULL_TYPES: HullType[] = ["motor", "sail", "catamaran", "rib"];
export const CURRENCIES: ListingCurrency[] = ["EUR", "USD", "TRY"];
export const FUEL_TYPES: FuelType[] = ["diesel", "petrol"];

export const FEATURED_EQUIPMENT = [
  "Bow Thruster",
  "Generator",
  "Watermaker",
  "Solar",
  "Air Conditioning",
] as const;

export type FeaturedEquipment = (typeof FEATURED_EQUIPMENT)[number];

export const MARINA_PRESETS: { name: string; region: string; lat: number; lng: number }[] = [
  { name: "Göcek D-Marin", region: "Göcek", lat: 36.7578, lng: 28.9412 },
  { name: "Marmaris Yacht Marina", region: "Marmaris", lat: 36.851, lng: 28.274 },
  { name: "Bodrum Milta", region: "Bodrum", lat: 37.0342, lng: 27.4298 },
  { name: "Yalıkavak Marina", region: "Bodrum", lat: 37.1048, lng: 27.2916 },
  { name: "Fethiye Ece Marina", region: "Fethiye", lat: 36.6275, lng: 29.1028 },
  { name: "D-Marin Didim", region: "Didim", lat: 37.3522, lng: 27.2594 },
];

export interface BoatListing {
  id: string;
  title: string;
  year: number;
  price: number;
  currency: ListingCurrency;
  marina: string;
  region: string;
  hull: HullType;
  loaM: number;
  beamM: number;
  draftM: number;
  engineBrand: string;
  engineHp: number;
  engineHours: number;
  fuel: FuelType;
  flag: string;
  cabins: number;
  berths: number;
  cruiseKn: number;
  fuelTankL: number | null;
  waterTankL: number | null;
  lat: number;
  lng: number;
  equipment: string[];
  description: string;
  seller: string;
  sellerPhone: string;
  hue: BoatHue;
}

const STORAGE_KEY = "thalvo.boat-listings.v1";

export const BOAT_LISTINGS: BoatListing[] = [
  {
    id: "oceanis-40-1-2022",
    title: "2022 Beneteau Oceanis 40.1",
    year: 2022,
    price: 285_000,
    currency: "EUR",
    marina: "Göcek D-Marin",
    region: "Göcek",
    hull: "sail",
    loaM: 12.87,
    beamM: 4.18,
    draftM: 2.17,
    engineBrand: "Yanmar",
    engineHp: 45,
    engineHours: 340,
    fuel: "diesel",
    flag: "Poland",
    cabins: 3,
    berths: 8,
    cruiseKn: 7.5,
    fuelTankL: 200,
    waterTankL: 330,
    lat: 36.7578,
    lng: 28.9412,
    equipment: ["Watermaker", "Solar", "Bow Thruster"],
    description:
      "Göcek D-Marin’de hazır, 2022 Oceanis 40.1. 340 saatlik Yanmar 45 HP, baş pervane, güneş ve su yapıcı ile Ege sezonuna çıkmaya hazır.",
    seller: "Aegean Yacht Brokerage",
    sellerPhone: "+90 252 645 12 40",
    hue: "navy",
  },
  {
    id: "northstar-ion-105-2023",
    title: "2023 Northstar Ion 10.5 RIB Tender",
    year: 2023,
    price: 165_000,
    currency: "EUR",
    marina: "Marmaris Yacht Marina",
    region: "Marmaris",
    hull: "rib",
    loaM: 10.5,
    beamM: 3.2,
    draftM: 0.65,
    engineBrand: "Mercury",
    engineHp: 600,
    engineHours: 120,
    fuel: "petrol",
    flag: "Türkiye",
    cabins: 0,
    berths: 2,
    cruiseKn: 38,
    fuelTankL: 480,
    waterTankL: 80,
    lat: 36.851,
    lng: 28.274,
    equipment: ["Joystick", "Raymarine Axiom"],
    description:
      "2× Mercury 300 V8, 120 saat. Joystick sürüş ve Axiom plotter. Ana tekneye tender veya gün teknesi olarak teslim.",
    seller: "Ion Tender Desk",
    sellerPhone: "+90 252 412 88 10",
    hue: "teal",
  },
  {
    id: "lagoon-42-2019",
    title: "2019 Lagoon 42 Katamaran",
    year: 2019,
    price: 490_000,
    currency: "EUR",
    marina: "Fethiye Ece Marina",
    region: "Fethiye",
    hull: "catamaran",
    loaM: 12.8,
    beamM: 7.7,
    draftM: 1.25,
    engineBrand: "Yanmar",
    engineHp: 114,
    engineHours: 680,
    fuel: "diesel",
    flag: "France",
    cabins: 4,
    berths: 8,
    cruiseKn: 7,
    fuelTankL: 300,
    waterTankL: 300,
    lat: 36.6275,
    lng: 29.1028,
    equipment: ["Generator", "Air Conditioning", "Watermaker"],
    description:
      "4 kabin owner versiyonu. Jeneratör, klima ve su yapıcı takılı. Ece Marina’da görülebilir.",
    seller: "Ece Catamaran Desk",
    sellerPhone: "+90 252 612 50 50",
    hue: "gold",
  },
  {
    id: "sun-odyssey-410-2020",
    title: "2020 Jeanneau Sun Odyssey 410",
    year: 2020,
    price: 259_000,
    currency: "EUR",
    marina: "D-Marin Didim",
    region: "Didim",
    hull: "sail",
    loaM: 12.35,
    beamM: 3.99,
    draftM: 2.25,
    engineBrand: "Yanmar",
    engineHp: 45,
    engineHours: 410,
    fuel: "diesel",
    flag: "Türkiye",
    cabins: 3,
    berths: 6,
    cruiseKn: 7.2,
    fuelTankL: 200,
    waterTankL: 330,
    lat: 37.3522,
    lng: 27.2594,
    equipment: ["Bow Thruster", "Solar", "Bimini"],
    description: "Didim’de Türk bayraklı, baş pervane ve güneş panelli cruiser.",
    seller: "Didim Blue Water",
    sellerPhone: "+90 256 813 90 00",
    hue: "slate",
  },
  {
    id: "axopar-28-2021",
    title: "2021 Axopar 28 T-Top",
    year: 2021,
    price: 145_000,
    currency: "EUR",
    marina: "Bodrum Milta",
    region: "Bodrum",
    hull: "motor",
    loaM: 8.74,
    beamM: 2.96,
    draftM: 0.8,
    engineBrand: "Mercury",
    engineHp: 400,
    engineHours: 80,
    fuel: "petrol",
    flag: "Türkiye",
    cabins: 1,
    berths: 2,
    cruiseKn: 32,
    fuelTankL: 300,
    waterTankL: 40,
    lat: 37.0342,
    lng: 27.4298,
    equipment: ["T-Top", "Chartplotter", "Bow Thruster"],
    description: "Bodrum Milta’da 80 saatlik 2× Mercury 200. Gün ve geçiş teknesi.",
    seller: "Bodrum Powerboats",
    sellerPhone: "+90 252 385 40 00",
    hue: "wine",
  },
];

export function formatListingPrice(price: number, currency: ListingCurrency, locale: string): string {
  const loc = locale.startsWith("tr") ? "tr-TR" : locale.startsWith("en") ? "en-US" : "de-DE";
  return new Intl.NumberFormat(loc, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

export function engineLabel(boat: BoatListing): string {
  return `${boat.engineBrand} ${boat.engineHp} HP`;
}

export function marinaCoords(marina: string): { lat: number; lng: number; region: string } {
  const hit = MARINA_PRESETS.find((m) => m.name === marina);
  return hit ?? { lat: 36.7525, lng: 28.9428, region: marina };
}

export function whatsappHref(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/\s/g, "")}`;
}

export function loadUserBoatListings(): BoatListing[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BoatListing[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistUserBoatListings(listings: BoatListing[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(listings));
  } catch {
    /* quota / private mode */
  }
}

export function nextHue(index: number): BoatHue {
  const hues: BoatHue[] = ["navy", "teal", "gold", "slate", "wine"];
  return hues[index % hues.length] ?? "navy";
}
