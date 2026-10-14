/**
 * Didim → Antalya marina roster for SOS / report pickers.
 * Names match `marine_zones` seed (kind = marina) so the list tracks the chart.
 */
export const COAST_MARINAS = [
  "D-Marin Didim",
  "Yalıkavak Marina",
  "Turgutreis D-Marin",
  "Bodrum Milta Marina",
  "Palamutbükü Limanı",
  "Datça Şehir Limanı",
  "Bozburun Limanı",
  "Netsel Marina Marmaris",
  "D-Marin Göcek",
  "Göcek Yakıt İskelesi",
  "Fethiye Ece Marina",
  "Kalkan Şehir İskelesi",
  "Kaş Setur Marina",
  "Setur Finike Marina",
  "G-Marina Kemer",
  "Setur Antalya Marina (Büyük Liman)",
  "Kaleiçi Yat Limanı (Antalya)",
] as const;

export type CoastMarina = (typeof COAST_MARINAS)[number];

/** Legacy short labels → chart marina names. */
const MARINA_ALIASES: Record<string, CoastMarina> = {
  "Göcek D-Marin": "D-Marin Göcek",
  "Bodrum Milta": "Bodrum Milta Marina",
  "Marmaris Netsel": "Netsel Marina Marmaris",
  "Fethiye Ece": "Fethiye Ece Marina",
  "Kaş Setur": "Kaş Setur Marina",
};

export function normalizeCoastMarina(name: string): string {
  return MARINA_ALIASES[name] ?? name;
}
