/**
 * THALVO shared formatters — M6 Architecture Freeze.
 *
 * Central home for money, ETA, distance, coordinate and date rendering so
 * feature panels stop reinventing `Intl.NumberFormat` per component.
 */

const FORMATTERS = new Map<string, Intl.NumberFormat>();

/** Map an i18n language tag onto a full BCP-47 locale for number formatting. */
function resolveLocale(locale: string | undefined, currency: string): string {
  if (locale) {
    const base = locale.toLowerCase().split("-")[0];
    if (base === "tr") return "tr-TR";
    if (base === "en") return "en-IE";
    return locale;
  }
  return currency === "TRY" ? "tr-TR" : "en-IE";
}

function fmt(currency: string, precise: boolean, locale: string): Intl.NumberFormat {
  const key = `${locale}:${currency}:${precise ? 1 : 0}`;
  let f = FORMATTERS.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: precise ? 2 : 0,
      maximumFractionDigits: precise ? 2 : 0,
    });
    FORMATTERS.set(key, f);
  }
  return f;
}

/**
 * ₺1.240 by default (TRY). `precise` renders ₺1.240,50.
 * Pass `currency` to override, `locale` to follow the active i18n language.
 */
export function formatMoney(
  amount: number | null | undefined,
  opts: { precise?: boolean; fallback?: string; currency?: string; locale?: string } = {},
): string {
  if (amount == null || Number.isNaN(amount)) return opts.fallback ?? "—";
  const currency = opts.currency ?? "TRY";
  return fmt(currency, !!opts.precise, resolveLocale(opts.locale, currency)).format(amount);
}


/** Minutes → "18 min", "1h 20m", "2h". */
export function formatEta(minutes: number | null | undefined): string {
  if (minutes == null || minutes < 0 || Number.isNaN(minutes)) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Kilometres → "820 m", "3.4 km", "18 km". */
export function formatDistance(km: number | null | undefined): string {
  if (km == null || Number.isNaN(km)) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/** Signed decimal degrees → "41.0082°N, 28.9784°E". */
export function formatCoordinates(
  lat: number | null | undefined,
  lng: number | null | undefined,
): string {
  if (lat == null || lng == null) return "—";
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${ns}, ${Math.abs(lng).toFixed(4)}°${ew}`;
}

/** Short operational date — "02 Jul 22:04". Locale-aware but concise. */
export function formatDateShort(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Rough "3 min ago" / "in 12 min" — used by feeds. */
export function formatRelative(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = d.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const min = Math.round(abs / 60_000);
  const suffix = diffMs < 0 ? "ago" : "from now";
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ${suffix}`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs}h ${suffix}`;
  const days = Math.round(hrs / 24);
  return `${days}d ${suffix}`;
}

/** Turn "OutForDelivery" / "in_progress" into "Out for delivery". */
export function humanizeStatus(raw: string | null | undefined): string {
  if (!raw) return "—";
  const spaced = raw
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
