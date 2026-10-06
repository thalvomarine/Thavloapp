export type MarineDomain = "weather" | "machinery" | "seamanship" | "outside";

const LEXICON: Record<Exclude<MarineDomain, "outside">, string[]> = {
  weather: [
    "hava",
    "rüzgar",
    "ruzgar",
    "dalga",
    "fırtına",
    "firtina",
    "meltem",
    "poyraz",
    "lodos",
    "deniz durumu",
    "beaufort",
    "forecast",
    "weather",
    "wind",
    "wave",
    "swell",
    "storm",
    "gale",
    "gust",
    "barometer",
    "basınç",
    "basinc",
  ],
  machinery: [
    "motor",
    "makine",
    "hararet",
    "overheat",
    "impeller",
    "pervane",
    "yağ",
    "yag",
    "yakıt",
    "yakit",
    "dizel",
    "benzin",
    "volvo",
    "yanmar",
    "mercury",
    "yamaha",
    "cummins",
    "caterpillar",
    "marş",
    "mars",
    "egzoz",
    "egzoz",
    "duman",
    "kayış",
    "kayis",
    "soğutma",
    "sogutma",
    "alternatör",
    "alternator",
    "jeneratör",
    "generator",
    "outboard",
    "saildrive",
    "mixing elbow",
    "dirsek",
    "tell-tale",
    "su kaçağı",
    "su kacagi",
    "engine",
    "diesel",
    "oil pressure",
    "impeller",
  ],
  seamanship: [
    "demir",
    "alarga",
    "tonoz",
    "colreg",
    "çatışma",
    "catisma",
    "seyir",
    "rota",
    "sığ",
    "siglik",
    "su çekimi",
    "su cekimi",
    "draft",
    "marina",
    "göcek",
    "gocek",
    "marmaris",
    "bodrum",
    "adam denize",
    "man overboard",
    "can yeleği",
    "sis",
    "fog",
    "iskele",
    "sancak",
    "mooring",
    "anchor",
    "anchorage",
    "under keel",
    "dip payı",
    "dip payi",
  ],
};

interface Note {
  domain: Exclude<MarineDomain, "outside" | "weather">;
  keys: string[];
  tr: string;
  en: string;
  emergency?: boolean;
}

const NOTES: Note[] = [
  {
    domain: "machinery",
    keys: ["hararet", "overheat", "ısındı", "isindi", "temperature", "hararet yaptı", "hararet yapti"],
    tr: `## Sade Dil Raporu
- Ne oluyor: Motor soğutma suyunu yeterince alamıyor veya ısıyı denize atamıyor.
- Neden olabilir: Deniz suyu süzgeci tıkalı; impeller yırtık; kayış gevşek; ekzoz dirseği (mixing elbow) daralmış.
- Şimdi ne yap: Devri düşür. Hararet düşmezse motoru durdur. Sıcakken radyatör veya eşanjör kapağını açma. Tatlı su devresine deniz suyu karıştıysa ustaya bırak.
- Ne zaman usta çağır: Durdurmana rağmen ibre düşmüyorsa, beyaz buhar veya soğutma suyu kaçağı varsa.
- Marka notu: Parça kodu plakadaki model olmadan söylenmez. Volvo Penta, Yanmar ve dıştan takmalarda ilk bakılacak parça sezonluk impeller'dır.`,
    en: `## Plain-language report
- What is happening: The engine is not taking enough seawater, or it cannot dump the heat.
- What can cause it: Blocked seawater strainer, torn impeller, loose belt, or a narrowed mixing elbow.
- What to do now: Reduce rpm. Stop the engine if the temperature does not fall. Do not open a hot cooling cap.
- When to call a mechanic: The gauge stays high after shutdown, or you see steam or a cooling-water leak.
- Brand note: No part number without the plate. On Volvo Penta, Yanmar, and outboards the seasonal impeller is the first item to inspect.`,
  },
  {
    domain: "machinery",
    keys: ["yağ basıncı", "yag basinci", "oil pressure", "yağ ikaz", "yag ikaz"],
    emergency: true,
    tr: `## Sade Dil Raporu
- Ne oluyor: Yağ basıncı düşünce yataklar yağsız kalır. Bu bir seyir arızası değil, motoru durdurma sebebidir.
- Neden olabilir: Yağ seviyesi düşük; yağ filtresi tıkalı; basınç müşiri arızalı; kaçak.
- Şimdi ne yap: Motoru hemen durdur. Seviyeyi motor soğuyunca kontrol et. Kaçak varsa üstüne basma ve kıvılcım çıkarma.
- Ne zaman usta çağır: Şimdi. Yağsız motoru tekrar çalıştırma.
- Marka notu: Müşir hatası ihtimali, düşük yağ ihtimalinden sonra gelir. Uydurma basınç değeri yok.`,
    en: `## Plain-language report
- What is happening: Low oil pressure starves the bearings. Stop the engine.
- What can cause it: Low oil level, a blocked filter, a faulty sender, or a leak.
- What to do now: Shut down now. Check the level only once it is cool. Keep sparks away from a leak.
- When to call a mechanic: Now. Do not restart an engine that ran without oil pressure.
- Brand note: A bad sender is considered after a real low level. No invented pressure figure.`,
  },
  {
    domain: "machinery",
    keys: ["çalışmıyor", "calismiyor", "marş", "mars basmıyor", "won't start", "wont start", "no start", "marş almıyor"],
    tr: `## Sade Dil Raporu
- Ne oluyor: Motor dönmüyor ya da dönüp tutuşmuyor.
- Neden olabilir: Akü zayıf veya şalter kapalı; yakıt musluğu kapalı; yakıtta hava; stop ipleri veya güvenlik şalteri çekili.
- Şimdi ne yap: Akü şalterini, stop düğmesini ve yakıt vanasını kontrol et. Marş basarken tık yoksa akü ve kutup başıdır. Devir alıp sönüyorsa yakıtta hava olabilir.
- Ne zaman usta çağır: Kutuplar temiz ve yakıt açıkken hâlâ dönmüyorsa.
- Marka notu: Seri numarası veya arıza kodu uydurulmaz. Plakadaki marka ve modeli yaz.`,
    en: `## Plain-language report
- What is happening: The engine does not crank, or it cranks and does not fire.
- What can cause it: A weak battery or an open switch, a closed fuel valve, air in the fuel, or a kill switch left on.
- What to do now: Check the battery switch, stop button, and fuel valve. A click with no crank points at the battery. Crank then die points at air in the fuel.
- When to call a mechanic: It still will not turn with clean terminals and fuel open.
- Brand note: Do not invent a fault code. Read the brand and model off the plate.`,
  },
  {
    domain: "machinery",
    keys: ["impeller", "su atmıyor", "su atmiyor", "tell-tale", "soğutma suyu yok", "sogutma suyu yok"],
    tr: `## Sade Dil Raporu
- Ne oluyor: Deniz suyu pompası basmıyor. Dıştan takmada kontrol deliğinden (tell-tale) su gelmez; içten takmada hararet bunu izler.
- Neden olabilir: Impeller kanatları kopmuş; süzgeç yosun tutmuş; termostat kapalı kalmış.
- Şimdi ne yap: Motoru yükte çalıştırmaya devam etme. Sezon başı impeller kontrolü standart bakımdır. Kopan kanat eşanjörde kalmış olabilir.
- Ne zaman usta çağır: Impeller değişince de su gelmiyorsa.
- Marka notu: Kanat sayısı modele göredir. Plakasız parça kodu yok.`,
    en: `## Plain-language report
- What is happening: The seawater pump is not pumping. On an outboard the tell-tale goes dry; on an inboard the temperature follows.
- What can cause it: A shredded impeller, a fouled strainer, or a thermostat stuck shut.
- What to do now: Do not keep it under load. Checking the impeller at the start of the season is normal service. Broken vanes can sit in the heat exchanger.
- When to call a mechanic: Still no water after a new impeller.
- Brand note: Vane count depends on the model. No part number without the plate.`,
  },
  {
    domain: "machinery",
    keys: ["duman", "smoke", "beyaz duman", "siyah duman", "mavi duman"],
    tr: `## Sade Dil Raporu
- Ne oluyor: Egzoz dumanının rengi yanma veya soğutma hakkında ipucu verir. Tek başına teşhis değildir.
- Neden olabilir: Beyaz ve sürekli duman soğutma suyunun egzoza kaçması olabilir. Siyah duman fazla yakıt veya tıkalı hava filtresi. Mavi duman yağ yakımı.
- Şimdi ne yap: Yükü azalt. Beyaz duman hararetle birlikteyse motoru durdur. Yakıt kaçağının yanında çıplak alev veya kıvılcım yok.
- Ne zaman usta çağır: Renk yük kalkınca geçmiyorsa veya su kaçağı şüphesi varsa.
- Marka notu: Enjektör kodu veya kompresyon değeri uydurulmaz.`,
    en: `## Plain-language report
- What is happening: Exhaust colour is a clue, not a diagnosis by itself.
- What can cause it: Continuous white smoke can be cooling water in the exhaust. Black smoke is excess fuel or a choked air filter. Blue smoke is oil.
- What to do now: Reduce load. If white smoke comes with overheating, stop. No flame or spark near a fuel leak.
- When to call a mechanic: The colour stays after you ease off, or you suspect water in the engine.
- Brand note: No invented injector code or compression figure.`,
  },
  {
    domain: "seamanship",
    keys: ["demir", "alarga", "anchor", "anchorage", "tonoz"],
    tr: `## Seyir notu
- Demir yeri: Rüzgâr koyun açık ağzına doğru esiyorsa alarga açık sayılır. Tonoz varsa çapayı ona göre seç.
- Dip payı: Haritadaki derinliğin tekne su çekiminden en az 1,5 m fazla olması gerekir. Derinlik kaydı yoksa "kayıtta yok" de, uydurma.
- Zincir: Sert havada kısa kaloma demiri taratır. Kaloma, rüzgâr ve dip cinsine göre artar. Sayı uydurma.
- Kontrol: Demir tuttuktan sonra sabit bir kerahet (kerteriz) al. Kayma varsa motor hazır olsun.`,
    en: `## Seamanship note
- Anchorage: If the wind blows into the open mouth, the bay is exposed. Use a mooring buoy when one is there.
- Under-keel: Charted depth should exceed draft by at least 1.5 m. If depth is not on file, say so.
- Scope: Short scope drags in a blow. Scope grows with wind and bottom. Do not invent a length.
- Check: Take a transit after the anchor sets. Have the engine ready if the transit moves.`,
  },
  {
    domain: "seamanship",
    keys: ["colreg", "çatışma", "catisma", "sancak", "starboard", "sis", "fog", "çatışmayı önleme"],
    tr: `## Seyir notu
- Dar kanalda mümkün olduğunca sancağına yakın seyret.
- Karşıdan karşıya: ikisi de sancağa manevra eder.
- Kesişme: sancağındaki tekneye yol ver.
- Sınırlı görüşte sürat düşer ve sis işareti verilir.
- Manevra erken ve karşı tarafa belli olacak kadar belirgin olmalı.`,
    en: `## Seamanship note
- In a narrow channel, keep to starboard as far as is safe.
- Head-on: both alter to starboard.
- Crossing: give way to the vessel on your starboard side.
- In fog, slow down and sound the signal.
- The alteration should be early and large enough to be obvious.`,
  },
  {
    domain: "seamanship",
    keys: ["adam denize", "man overboard", "mob", "denize adam"],
    emergency: true,
    tr: `## Seyir notu
- Bağır, işaret et, bir kişi bakışı hiç kesmesin.
- Can simidini at. Pervaneden uzak dur.
- Tekneyi adama doğru yavaş ve kontrollü yaklaştır. İlk iş motoru tam yol kişiye sürmek değildir.
- VHF veya telefon ile yardım, kişi teknedeyken çağrılır; önce kişi gözden kaçmasın.`,
    en: `## Seamanship note
- Shout, point, and keep one person watching without looking away.
- Throw the lifebuoy. Stay clear of the propeller.
- Bring the boat back slowly. Do not drive full ahead at the person.
- Call for help once someone still has the person in sight.`,
  },
  {
    domain: "seamanship",
    keys: ["meltem", "etezyen", "etesian", "poyraz", "lodos"],
    tr: `## Seyir notu
- Yaz meltemi Ege'de çoğunlukla kuzeyli eser ve öğleden sonra sertleşir.
- Poyraz kuzeydoğudan, lodos güneybatıdan gelir. Koy seçimi rüzgârın ağza mı yoksa sırtın arkasına mı geldiğine bakar.
- Sayı için canlı hava ölçümü gerekir. Bu not rüzgâr hızı uydurmaz.`,
    en: `## Seamanship note
- The summer meltem in the Aegean is usually northerly and often freshens after noon.
- Poyraz is northeasterly, lodos southwesterly. A bay is chosen by whether that wind blows into the mouth or over the hill behind it.
- A speed needs a live weather reading. This note does not invent one.`,
  },
];

const WATERS = [
  { keys: ["göcek", "gocek"], name: "Göcek", lat: 36.7525, lng: 28.9428 },
  { keys: ["marmaris"], name: "Marmaris", lat: 36.8525, lng: 28.278 },
  { keys: ["bodrum"], name: "Bodrum", lat: 37.034, lng: 27.43 },
];

export function classifyMarineDomain(text: string): MarineDomain {
  const q = text.toLocaleLowerCase("tr");
  let best: MarineDomain = "outside";
  let score = 0;
  for (const domain of ["weather", "machinery", "seamanship"] as const) {
    const hits = LEXICON[domain].reduce((sum, word) => sum + (q.includes(word) ? word.length : 0), 0);
    if (hits > score) {
      score = hits;
      best = domain;
    }
  }
  return best;
}

export function offTopicReply(lang: "tr" | "en"): string {
  return lang === "tr"
    ? "THALVO AI yalnız üç konuda cevap verir: deniz ve seyir, makine, hava durumu. Bu soru o alanın dışında."
    : "THALVO AI answers only three subjects: seamanship, machinery, and weather. That question is outside those subjects.";
}

export function retrieveMarineNotes(text: string, lang: "tr" | "en"): string {
  const note = matchNote(text);
  if (!note) return "";
  return lang === "tr" ? note.tr : note.en;
}

export async function answerFromTraining(input: {
  text: string;
  lang: "tr" | "en";
  position: { lat: number; lng: number } | null;
}): Promise<{
  text: string;
  domain: MarineDomain;
  emergency: boolean;
  confident: boolean;
  weather: { alert: string; summaryTr: string; summaryEn: string } | null;
}> {
  const domain = classifyMarineDomain(input.text);
  if (domain === "outside") {
    return { text: offTopicReply(input.lang), domain, emergency: false, confident: true, weather: null };
  }
  if (domain === "weather") {
    const place = namedWater(input.text) ?? input.position;
    if (!place) {
      const text =
        input.lang === "tr"
          ? "Hava için bir yer lazım. Göcek, Marmaris, Bodrum diyebilirsin veya haritada konumunu aç."
          : "Weather needs a place. Name Göcek, Marmaris, or Bodrum, or turn on your position.";
      return { text, domain, emergency: false, confident: true, weather: null };
    }
    try {
      const { fetchMarineWeather } = await import("./marine-weather");
      const report = await fetchMarineWeather(place.lat, place.lng);
      const label = "name" in place ? place.name : null;
      return {
        text: formatWeather(report, input.lang, label),
        domain,
        emergency: report.alert === "storm" || report.alert === "gale",
        confident: true,
        weather: { alert: report.alert, summaryTr: report.summaryTr, summaryEn: report.summaryEn },
      };
    } catch {
      const text =
        input.lang === "tr"
          ? "Canlı hava ölçümü şu an gelmedi. Dalga yüksekliği uydurmam. Biraz sonra aynı yeri tekrar sor."
          : "The live weather reading did not arrive. I will not invent a wave height. Ask the same place again shortly.";
      return { text, domain, emergency: false, confident: true, weather: null };
    }
  }
  const note = matchNote(input.text);
  if (!note) {
    const text =
      domain === "machinery"
        ? input.lang === "tr"
          ? "Makine için belirtiyi yaz: hararet, yağ basıncı, marş, su atmama veya duman rengi. Plakadaki marka ve modeli ekle. Parça kodu uydurmam."
          : "For machinery, name the symptom: overheating, oil pressure, no start, no tell-tale, or smoke colour. Add the brand and model from the plate. I will not invent a part number."
        : input.lang === "tr"
          ? "Seyir için ne yapmak istediğini yaz: demir, çatışma kuralları veya denize adam düşmesi. Rüzgâr hızı ancak canlı ölçüden gelir."
          : "For seamanship, say what you need: anchoring, collision rules, or man overboard. A wind speed comes only from a live reading.";
    return { text, domain, emergency: false, confident: false, weather: null };
  }
  return {
    text: input.lang === "tr" ? note.tr : note.en,
    domain,
    emergency: note.emergency === true,
    confident: true,
    weather: null,
  };
}

function matchNote(text: string): Note | null {
  const q = text.toLocaleLowerCase("tr");
  let best: Note | null = null;
  let score = 0;
  for (const note of NOTES) {
    const hits = note.keys.reduce((sum, key) => sum + (q.includes(key) ? key.length : 0), 0);
    if (hits > score) {
      score = hits;
      best = note;
    }
  }
  return best;
}

function namedWater(text: string): { name: string; lat: number; lng: number } | null {
  const q = text.toLocaleLowerCase("tr");
  return WATERS.find((water) => water.keys.some((key) => q.includes(key))) ?? null;
}

function formatWeather(
  report: {
    summaryTr: string;
    summaryEn: string;
  },
  lang: "tr" | "en",
  label: string | null,
): string {
  const body = lang === "tr" ? report.summaryTr : report.summaryEn;
  const where =
    label == null
      ? lang === "tr"
        ? "Bulunduğun nokta"
        : "Your position"
      : label;
  const source = lang === "tr" ? "Kaynak: Open-Meteo canlı ölçü." : "Source: Open-Meteo live reading.";
  return `${where}. ${body} ${source}`;
}
