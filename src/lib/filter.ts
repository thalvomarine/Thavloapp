import i18n from "@/i18n";
import { formatMoney } from "@/lib/formatters";
import { CURRENCY } from "@/lib/payments";
/** Chat fraud/off-platform interception. Blocks Turkish + English tokens
 *  and any phone-number / IBAN / email shaped strings before persisting. */
const FORBIDDEN = [
  "iban", "bank", "banka", "hesap", "transfer", "havale", "eft",
  "cash", "nakit", "elden", "elden ödeme",
  "whatsapp", "wp", "whats app", "telegram", "signal",
  "phone number", "telefon", "telefonum", "ara beni", "call me",
  "instagram", "dm me",
];

const PHONE_RE = /(?:\+?\d[\s\-().]?){7,}/g;
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9 ]{11,30}\b/gi;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
const TR_MOBILE_RE = /\b(?:\+?90 ?)?0?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/g;

export interface FilterResult {
  text: string;
  masked: boolean;
  blocked: string[];
}

export function filterMessage(raw: string): FilterResult {
  let text = raw;
  const blocked: string[] = [];
  for (const w of FORBIDDEN) {
    const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    if (re.test(text)) {
      blocked.push(w);
      text = text.replace(re, "█████");
    }
  }
  if (TR_MOBILE_RE.test(text)) { blocked.push("phone"); text = text.replace(TR_MOBILE_RE, "███-███-████"); }
  if (PHONE_RE.test(text)) { blocked.push("phone"); text = text.replace(PHONE_RE, "███-███-████"); }
  if (IBAN_RE.test(text)) { blocked.push("IBAN"); text = text.replace(IBAN_RE, "██ IBAN BLOCKED ██"); }
  if (EMAIL_RE.test(text)) { blocked.push("email"); text = text.replace(EMAIL_RE, "███@███"); }
  return { text, masked: blocked.length > 0, blocked: Array.from(new Set(blocked)) };
}

/**
 * Money rendering funnels through `formatMoney`, driven by the active i18n
 * language. TRY is the platform currency (see CURRENCY in lib/payments).
 */
export const formatTL = (n: number) =>
  formatMoney(n, { currency: CURRENCY, locale: i18n.language, fallback: "—" });

/**
 * M9 Location Integrity — mixed coordinate format tolerance.
 *
 * The `jobs` and `provider_details` tables contain both legacy demo rows
 * (normalized in [-1, 1]) and real device rows (geographical degrees).
 * When both endpoints share a format we can compute a distance; when
 * they are mixed the answer would be nonsense, so we return null and let
 * the caller hide the distance chip.
 */
const isRealDegree = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && (Math.abs(lat) > 1 || Math.abs(lng) > 1);
const isNormalized = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 1 && Math.abs(lng) <= 1;

export function harborDistanceKm(
  aLat: number, aLng: number, bLat: number, bLng: number,
): number | null {
  if (isRealDegree(aLat, aLng) && isRealDegree(bLat, bLng)) {
    // Haversine — real geographical degrees.
    const R = 6371;
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  if (isNormalized(aLat, aLng) && isNormalized(bLat, bLng)) {
    // Legacy normalized demo coords — preserve prior heuristic.
    const dx = (aLat - bLat) * 40;
    const dy = (aLng - bLng) * 40;
    return Math.sqrt(dx * dx + dy * dy);
  }
  return null;
}
export const kmToNm = (km: number) => km * 0.539957;
