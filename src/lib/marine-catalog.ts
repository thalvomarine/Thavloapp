/** Shared marine catalogue for the vessel passport, boat listings, and parts. */

export const ENGINE_BRANDS = [
  "Volvo Penta",
  "Yanmar",
  "Yamaha",
  "Mercury",
  "MerCruiser",
  "Suzuki",
  "Honda",
  "Tohatsu",
  "Cummins",
  "Caterpillar",
  "MAN",
  "MTU",
  "Scania",
  "Perkins",
  "John Deere",
  "Baudouin",
  "Nanni",
  "Beta Marine",
  "Westerbeke",
  "Kohler",
  "Steyr",
  "Vetus",
  "Lombardini",
  "FPT",
  "Hyundai SeasAll",
  "OXE",
  "Torqeedo",
  "ePropulsion",
] as const;

export const PART_BRANDS = [
  ...ENGINE_BRANDS,
  "Garmin",
  "Raymarine",
  "Simrad",
  "B&G",
  "Victron",
  "Mastervolt",
  "Lewmar",
  "Jabsco",
  "Whale",
  "Rule",
  "Osculati",
] as const;

export const VESSEL_CATEGORIES = ["yacht", "boat", "rib", "gulet", "tender", "commercial"] as const;
export type VesselCategoryId = (typeof VESSEL_CATEGORIES)[number];

export const VESSEL_TYPES = [
  { id: "motor_yacht", hull: "motor" },
  { id: "sailing", hull: "sail" },
  { id: "gulet", hull: "sail" },
  { id: "motorsailer", hull: "sail" },
  { id: "catamaran", hull: "catamaran" },
  { id: "trimaran", hull: "catamaran" },
  { id: "flybridge", hull: "motor" },
  { id: "trawler", hull: "motor" },
  { id: "sportfish", hull: "motor" },
  { id: "center_console", hull: "motor" },
  { id: "walkaround", hull: "motor" },
  { id: "cabin_cruiser", hull: "motor" },
  { id: "dayboat", hull: "motor" },
  { id: "explorer", hull: "motor" },
  { id: "workboat", hull: "motor" },
  { id: "houseboat", hull: "motor" },
  { id: "rib", hull: "rib" },
  { id: "tender", hull: "rib" },
  { id: "pwc", hull: "rib" },
] as const;

export type VesselTypeId = (typeof VESSEL_TYPES)[number]["id"];
export type ListingHull = "sail" | "motor" | "catamaran" | "rib";

export const FUEL_IDS = ["diesel", "petrol", "petrol_outboard", "electric", "hybrid"] as const;
export type FuelId = (typeof FUEL_IDS)[number];

export const PART_CONDITIONS = ["new", "used", "rebuilt"] as const;
export type PartCondition = (typeof PART_CONDITIONS)[number];

const TYPE_PREFIX = "type:";
const CONDITION_PREFIX = "condition:";

export function hullForType(typeId: string): ListingHull {
  const hit = VESSEL_TYPES.find((item) => item.id === typeId);
  return (hit?.hull ?? "motor") as ListingHull;
}

export function withListingType(equipment: string[], typeId: string): string[] {
  return [`${TYPE_PREFIX}${typeId}`, ...equipment.filter((item) => !item.startsWith(TYPE_PREFIX))];
}

export function readListingType(equipment: string[]): string | null {
  const hit = equipment.find((item) => item.startsWith(TYPE_PREFIX));
  return hit ? hit.slice(TYPE_PREFIX.length) : null;
}

export function publicEquipment(equipment: string[]): string[] {
  return equipment.filter((item) => !item.startsWith(TYPE_PREFIX) && !item.startsWith(CONDITION_PREFIX));
}

export function splitEngine(value: string | null | undefined): { brand: string; model: string } {
  const text = (value ?? "").trim();
  if (!text) return { brand: ENGINE_BRANDS[0], model: "" };
  const known = ENGINE_BRANDS.find((brand) => text.toLowerCase().startsWith(brand.toLowerCase()));
  if (!known) return { brand: "other", model: text };
  return { brand: known, model: text.slice(known.length).replace(/^[\s·\-]+/, "") };
}

export function joinEngine(brand: string, model: string): string | null {
  const line = [brand === "other" ? "" : brand.trim(), model.trim()].filter(Boolean).join(" · ");
  return line || null;
}

export function withPartCondition(compatibility: string[], condition: PartCondition | ""): string[] {
  const rest = compatibility.filter((item) => !item.startsWith(CONDITION_PREFIX));
  return condition ? [`${CONDITION_PREFIX}${condition}`, ...rest] : rest;
}

export function readPartCondition(compatibility: string[] | null | undefined): PartCondition | "" {
  const hit = (compatibility ?? []).find((item) => item.startsWith(CONDITION_PREFIX));
  const value = hit?.slice(CONDITION_PREFIX.length);
  return PART_CONDITIONS.includes(value as PartCondition) ? (value as PartCondition) : "";
}

export function publicCompatibility(compatibility: string[] | null | undefined): string[] {
  return (compatibility ?? []).filter((item) => !item.startsWith(CONDITION_PREFIX));
}
