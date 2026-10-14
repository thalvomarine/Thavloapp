import { supabase } from "@/integrations/supabase/client";

export type HullType = "sail" | "motor" | "catamaran" | "rib";
export type ListingCurrency = "EUR" | "USD" | "TRY";
export type FuelType = "diesel" | "petrol";
export type BoatHue = "navy" | "teal" | "gold" | "slate" | "wine";
export type ListingStatus = "live" | "paused";

export const HULL_TYPES: HullType[] = ["motor", "sail", "catamaran", "rib"];
export const CURRENCIES: ListingCurrency[] = ["EUR", "USD", "TRY"];
export const FUEL_TYPES: FuelType[] = ["diesel", "petrol"];

export const FEATURED_EQUIPMENT = [
  "Bow Thruster",
  "Stern Thruster",
  "Generator",
  "Watermaker",
  "Solar",
  "Air Conditioning",
  "Radar",
  "Autopilot",
  "Windlass",
  "Inverter",
  "Life Raft",
  "Stabilizers",
  "Heating",
  "Teak Deck",
  "Dinghy",
] as const;

export type FeaturedEquipment = (typeof FEATURED_EQUIPMENT)[number];

export const MARINA_PRESETS: { name: string; region: string; lat: number; lng: number }[] = [
  { name: "D-Marin Didim", region: "Didim", lat: 37.3372, lng: 27.2608 },
  { name: "Yalıkavak Marina", region: "Bodrum", lat: 37.1065, lng: 27.2885 },
  { name: "Turgutreis D-Marin", region: "Bodrum", lat: 37.0015, lng: 27.258 },
  { name: "Bodrum Milta Marina", region: "Bodrum", lat: 37.0345, lng: 27.424 },
  { name: "Palamutbükü Limanı", region: "Datça", lat: 36.671, lng: 27.505 },
  { name: "Datça Şehir Limanı", region: "Datça", lat: 36.7215, lng: 27.689 },
  { name: "Bozburun Limanı", region: "Bozburun", lat: 36.689, lng: 28.043 },
  { name: "Netsel Marina Marmaris", region: "Marmaris", lat: 36.8525, lng: 28.278 },
  { name: "D-Marin Göcek", region: "Göcek", lat: 36.7525, lng: 28.9428 },
  { name: "Göcek Yakıt İskelesi", region: "Göcek", lat: 36.7485, lng: 28.938 },
  { name: "Fethiye Ece Marina", region: "Fethiye", lat: 36.626, lng: 29.102 },
  { name: "Kalkan Şehir İskelesi", region: "Kalkan", lat: 36.2625, lng: 29.416 },
  { name: "Kaş Setur Marina", region: "Kaş", lat: 36.2045, lng: 29.626 },
  { name: "Setur Finike Marina", region: "Finike", lat: 36.295, lng: 30.15 },
  { name: "G-Marina Kemer", region: "Kemer", lat: 36.601, lng: 30.569 },
  { name: "Setur Antalya Marina (Büyük Liman)", region: "Antalya", lat: 36.8335, lng: 30.608 },
  { name: "Kaleiçi Yat Limanı (Antalya)", region: "Antalya", lat: 36.8845, lng: 30.7025 },
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
  /** Cover is the first URL. Empty when the seller has not added a photo yet. */
  photos?: string[];
  /** Set on captain-created listings. Catalogue boats have no owner. */
  ownerId?: string;
  /** Omitted listings stay live. Owners can pause without deleting. */
  status?: ListingStatus;
}

const STORAGE_KEY = "thalvo.boat-listings.v1";
const IMPORT_FLAG = "thalvo.boat-listings.imported.v1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export function isOwnListing(boat: BoatListing, ownerId: string | null | undefined): boolean {
  return Boolean(ownerId && boat.ownerId && boat.ownerId === ownerId);
}

export function isLiveListing(boat: BoatListing): boolean {
  return boat.status !== "paused";
}

export function loadUserBoatListings(ownerId?: string): BoatListing[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BoatListing[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((boat) => ({
      ...boat,
      status: boat.status === "paused" ? "paused" : "live",
      ownerId: boat.ownerId ?? ownerId,
      photos: Array.isArray(boat.photos)
        ? boat.photos.filter((url) => typeof url === "string" && url.startsWith("https://")).slice(0, 6)
        : [],
    }));
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

interface BoatListingRow {
  id: string;
  owner_id: string;
  title: string;
  year: number;
  price: number;
  currency: ListingCurrency;
  marina: string;
  region: string;
  hull: HullType;
  loa_m: number;
  beam_m: number;
  draft_m: number;
  engine_brand: string;
  engine_hp: number;
  engine_hours: number;
  fuel: FuelType;
  flag: string;
  cabins: number;
  berths: number;
  cruise_kn: number;
  fuel_tank_l: number | null;
  water_tank_l: number | null;
  lat: number;
  lng: number;
  equipment: string[] | null;
  description: string;
  seller_name: string;
  seller_phone: string;
  hue: BoatHue;
  photos: string[] | null;
  status: ListingStatus;
}

function rowToListing(row: BoatListingRow): BoatListing {
  return {
    id: row.id,
    title: row.title,
    year: row.year,
    price: Number(row.price),
    currency: row.currency,
    marina: row.marina,
    region: row.region,
    hull: row.hull,
    loaM: Number(row.loa_m),
    beamM: Number(row.beam_m),
    draftM: Number(row.draft_m),
    engineBrand: row.engine_brand,
    engineHp: row.engine_hp,
    engineHours: row.engine_hours,
    fuel: row.fuel,
    flag: row.flag,
    cabins: row.cabins,
    berths: row.berths,
    cruiseKn: Number(row.cruise_kn),
    fuelTankL: row.fuel_tank_l == null ? null : Number(row.fuel_tank_l),
    waterTankL: row.water_tank_l == null ? null : Number(row.water_tank_l),
    lat: row.lat,
    lng: row.lng,
    equipment: row.equipment ?? [],
    description: row.description,
    seller: row.seller_name,
    sellerPhone: row.seller_phone,
    hue: row.hue,
    photos: (row.photos ?? []).filter((url) => url.startsWith("https://")).slice(0, 6),
    ownerId: row.owner_id,
    status: row.status === "paused" ? "paused" : "live",
  };
}

function listingToRow(listing: BoatListing, ownerId: string) {
  return {
    id: listing.id,
    owner_id: ownerId,
    title: listing.title,
    year: listing.year,
    price: listing.price,
    currency: listing.currency,
    marina: listing.marina,
    region: listing.region,
    hull: listing.hull,
    loa_m: listing.loaM,
    beam_m: listing.beamM,
    draft_m: listing.draftM,
    engine_brand: listing.engineBrand,
    engine_hp: listing.engineHp,
    engine_hours: listing.engineHours,
    fuel: listing.fuel,
    flag: listing.flag,
    cabins: listing.cabins,
    berths: listing.berths,
    cruise_kn: listing.cruiseKn,
    fuel_tank_l: listing.fuelTankL,
    water_tank_l: listing.waterTankL,
    lat: listing.lat,
    lng: listing.lng,
    equipment: listing.equipment,
    description: listing.description,
    seller_name: listing.seller,
    seller_phone: listing.sellerPhone,
    hue: listing.hue,
    photos: (listing.photos ?? []).filter((url) => url.startsWith("https://")).slice(0, 6),
    status: listing.status === "paused" ? "paused" : "live",
  };
}

function readImportDone(): Set<string> {
  try {
    const raw = localStorage.getItem(IMPORT_FLAG);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

async function importLocalBoatListings(ownerId: string) {
  if (typeof window === "undefined") return;
  const local = loadUserBoatListings(ownerId).filter((boat) => !boat.ownerId || boat.ownerId === ownerId);
  if (local.length === 0) return;
  const done = readImportDone();
  const pending = local.filter((boat) => !done.has(boat.id));
  for (const boat of pending) {
    const id = UUID_RE.test(boat.id) ? boat.id : crypto.randomUUID();
    const { error } = await supabase.from("boat_listings").upsert(listingToRow({ ...boat, id, ownerId }, ownerId));
    if (error) throw error;
    done.add(boat.id);
    localStorage.setItem(IMPORT_FLAG, JSON.stringify([...done]));
  }
  localStorage.removeItem(STORAGE_KEY);
}

export async function loadSharedBoatListings(ownerId: string): Promise<BoatListing[]> {
  try {
    await importLocalBoatListings(ownerId);
  } catch (error) {
    console.warn("[market] local boat import skipped", error);
  }
  const { data, error } = await supabase
    .from("boat_listings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[market] boat_listings unavailable", error.message);
    return [];
  }
  return ((data ?? []) as BoatListingRow[]).map(rowToListing);
}

export async function saveBoatListing(listing: BoatListing, ownerId: string): Promise<void> {
  const { error } = await supabase.from("boat_listings").upsert(listingToRow({ ...listing, ownerId }, ownerId));
  if (error) throw error;
}

export async function setBoatListingStatus(id: string, ownerId: string, status: ListingStatus): Promise<void> {
  const { error } = await supabase
    .from("boat_listings")
    .update({ status })
    .eq("id", id)
    .eq("owner_id", ownerId);
  if (error) throw error;
}
