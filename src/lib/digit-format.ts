/** Turkish grouping: 1250000 → 1.250.000. The dot is only a thousands mark. */

export function groupThousands(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Lengths, depths and speeds. Dots group thousands. A comma, or a single dot
 * with one or two digits after it, is the decimal mark and is shown as a comma.
 */
export function groupMeasure(value: string): string {
  const cleaned = value.replace(/[^\d.,]/g, "");
  if (!cleaned) return "";
  const decimalDot = cleaned.match(/^(\d*)\.(\d{1,2})$/);
  const source = decimalDot ? `${decimalDot[1]},${decimalDot[2]}` : cleaned;
  const comma = source.lastIndexOf(",");
  if (comma === -1) return groupThousands(source.replace(/\./g, ""));
  const whole = groupThousands(source.slice(0, comma).replace(/\D/g, ""));
  const frac = source.slice(comma + 1).replace(/\D/g, "").slice(0, 2);
  if (source.endsWith(",") && !frac) return whole ? `${whole},` : "";
  return frac ? `${whole || "0"},${frac}` : whole;
}

export function parseGrouped(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return NaN;
  const n = Number(trimmed.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

/** 4242424242424242 → 4242 4242 4242 4242 */
export function groupCard(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** First two digits, then a slash, then the month or year. 1228 → 12/28 */
export function groupExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function digitsOnly(value: string, max: number): string {
  return value.replace(/\D/g, "").slice(0, max);
}

/** Keep the caret on the same digit after grouping characters are inserted. */
export function caretAfterGrouping(raw: string, formatted: string, selectionStart: number | null): number {
  if (selectionStart == null) return formatted.length;
  const digitsBefore = raw.slice(0, selectionStart).replace(/\D/g, "").length;
  if (digitsBefore === 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i] ?? "")) seen += 1;
    if (seen >= digitsBefore) return i + 1;
  }
  return formatted.length;
}
