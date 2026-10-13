/**
 * Broker / appraisal helpers for THALVO AI.
 * Bands are indicative Aegean–Med private-sale ranges, not a survey certificate.
 */

export type BrokerIntent = "sell" | "appraise" | null;

export type HullBand = "sail" | "motor" | "catamaran" | "rib" | "unknown";

export function detectBrokerIntent(text: string): BrokerIntent {
  const q = text.toLocaleLowerCase("tr");
  if (
    /hızlı\s*sat|hizli\s*sat|tekneyi\s*sat|teknemi\s*sat|tekne\s*sat|ilan\s*ver|quick\s*sell|sell\s+(my\s+)?boat|list\s+(my\s+)?boat/.test(
      q,
    )
  ) {
    return "sell";
  }
  if (
    /fiyat\s*bi[cç]|ekspertiz|değer\s*bi[cç]|deger\s*bic|ne\s*eder|kaça\s*sat|kaca\s*sat|apprais|valuat|how\s+much\s+(is|for)|worth\b|market\s+value/.test(
      q,
    )
  ) {
    return "appraise";
  }
  return null;
}

export function classifyHull(text: string): HullBand {
  const q = text.toLocaleLowerCase("tr");
  if (/katamaran|catamaran|cat\b/.test(q)) return "catamaran";
  if (/\brib\b|şişme|sisme|bot\b|tender/.test(q)) return "rib";
  if (/yelken|sail|sailing|gulet/.test(q)) return "sail";
  if (/motor|motoryat|motor\s*yacht|cruiser/.test(q)) return "motor";
  return "unknown";
}

/** Rough private-sale EUR mid for coastal TR/Med when year + LOA are known. */
export function indicativePriceEur(input: {
  loaM: number;
  year: number;
  hull: HullBand;
}): { low: number; mid: number; high: number } | null {
  if (!(input.loaM >= 5 && input.loaM <= 45)) return null;
  if (!(input.year >= 1975 && input.year <= new Date().getFullYear() + 1)) return null;
  const age = Math.max(0, new Date().getFullYear() - input.year);
  const basePerM =
    input.hull === "catamaran" ? 28_000 : input.hull === "sail" ? 14_000 : input.hull === "rib" ? 9_000 : 18_000;
  const raw = input.loaM * basePerM;
  const ageFactor = Math.max(0.28, 1 - age * 0.028);
  const mid = Math.round((raw * ageFactor) / 1000) * 1000;
  const low = Math.round((mid * 0.82) / 1000) * 1000;
  const high = Math.round((mid * 1.22) / 1000) * 1000;
  return { low, mid, high };
}

export function parseBoatSpecs(text: string): { loaM: number | null; year: number | null; hull: HullBand } {
  const q = text.toLocaleLowerCase("tr");
  const yearMatch = q.match(/\b(19[7-9]\d|20[0-2]\d)\b/);
  const loaMatch = q.match(/(\d{1,2}(?:[.,]\d+)?)\s*m\b/) || q.match(/(\d{1,2}(?:[.,]\d+)?)\s*metre/);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  const loaM = loaMatch ? Number(loaMatch[1].replace(",", ".")) : null;
  return {
    year: year != null && Number.isFinite(year) ? year : null,
    loaM: loaM != null && Number.isFinite(loaM) ? loaM : null,
    hull: classifyHull(text),
  };
}

function formatEur(n: number, lang: "tr" | "en"): string {
  return new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function appraisalReply(text: string, lang: "tr" | "en"): string {
  const specs = parseBoatSpecs(text);
  const band =
    specs.loaM != null && specs.year != null
      ? indicativePriceEur({ loaM: specs.loaM, year: specs.year, hull: specs.hull })
      : null;

  if (band && specs.loaM != null && specs.year != null) {
    const hullLabel =
      lang === "tr"
        ? { sail: "yelkenli", motor: "motoryat", catamaran: "katamaran", rib: "RIB/bot", unknown: "tekne" }[specs.hull]
        : { sail: "sailboat", motor: "motor yacht", catamaran: "catamaran", rib: "RIB", unknown: "boat" }[
            specs.hull
          ];
    return lang === "tr"
      ? `## Broker ekspertiz (gösterge)
- Tekne: ${specs.year} · ~${specs.loaM} m · ${hullLabel}
- Özel satış bandı (Ege–Akdeniz, anket değil): **${formatEur(band.low, "tr")} – ${formatEur(band.high, "tr")}**
- Ortanca referans: **${formatEur(band.mid, "tr")}**
- Bandı hareket ettirenler: motor saati, refit, donanım, marina, hasar/osmoz, belgeler.
- Bu bir sörvey veya taahhüt değil. Net ilan için **Hızlı Sat** formuna marka, LOA, yıl, motor, fotoğraf ve istediğin fiyatı yaz.`
      : `## Broker appraisal (indicative)
- Boat: ${specs.year} · ~${specs.loaM} m · ${hullLabel}
- Private-sale band (Aegean–Med, not a survey): **${formatEur(band.low, "en")} – ${formatEur(band.high, "en")}**
- Mid reference: **${formatEur(band.mid, "en")}**
- Movers: engine hours, refit, gear, berth, damage/osmosis, papers.
- Not a survey or commitment. For a live listing, open **Quick sell** and add brand, LOA, year, engine, photos, and your ask.`;
  }

  return lang === "tr"
    ? `## Broker ekspertiz
Fiyat için şunlar lazım: **yıl, tam boy (m), gövde tipi** (yelken / motor / katamaran / RIB), mümkünse motor saati ve marina.
Örnek: \`2018 Bavaria 40, 12 m yelkenli, Göcek\`.
Rakam uydurmam. Bilgiyi yaz veya **Hızlı Sat** formunu açıp fotoğraflarla gir — bandı ona göre söylerim.`
    : `## Broker appraisal
I need **year, LOA (m), hull type** (sail / motor / catamaran / RIB), plus engine hours and marina when you have them.
Example: \`2018 Bavaria 40, 12 m sail, Göcek\`.
I will not invent a price. Send the specs or open **Quick sell** with photos and I will band it.`;
}

export function sellReply(lang: "tr" | "en"): string {
  return lang === "tr"
    ? `## Hızlı Sat
İlan formunu açıyorum. Şunları gir:
1. Başlık, istediğin fiyat, marina
2. Yıl, LOA, kabin
3. Motor marka/model, HP, saat
4. Fotoğraflar (ilk kapak) + WhatsApp
Yayınlanınca pazar yerinde görünür. İstersen önce yıl + boy yaz; ekspertiz bandı da söyleyeyim.`
    : `## Quick sell
Opening the listing form. Enter:
1. Title, ask price, marina
2. Year, LOA, cabins
3. Engine brand/model, HP, hours
4. Photos (first is cover) + WhatsApp
It goes live on the marketplace. Or send year + LOA first for an indicative band.`;
}
