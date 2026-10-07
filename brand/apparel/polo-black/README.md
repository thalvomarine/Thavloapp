# THALVO — Siyah Polo Baskı Paketi

Siyah polo yaka tshirt için logo baskı tasarımı ve baskıya hazır dosyalar.

## Önerilen yerleşim

| Alan | Dosya | Boyut | Teknik |
|------|-------|-------|--------|
| Sol göğüs | Crest + THALVO | **7–8 cm** genişlik | Nakış veya DTG |
| Sırt (opsiyonel) | Full lockup | **18–22 cm** yükseklik | DTG / serigrafi |

## Renk

- Kumaş: siyah
- Baskı: krem / champagne / soft gold (mevcut logo paleti)
- Siyah kumaşta koyu konturlar kaybolmasın diye mevcut alpha PNG master kullanın (açık fill + koyu outline zaten siyah zeminde okunur)

## Baskıcıya verilecek master dosyalar

1. `print-master-full-transparent.png` — crest + THALVO, şeffaf zemin (sırt / büyük baskı)
2. `print-master-crest-transparent.png` — sadece amblem (göğüs nakışı için)
3. `print-full-lockup-on-black.png` — siyah zeminde önizleme (2048², 300 dpi)
4. `print-crest-only-on-black.png` — crest önizleme

## Mockup’lar

- `mockup-chest.jpg` — sol göğüs
- `mockup-back.jpg` — sırt
- `concept-print-art.jpg` — konsept sanat sayfası
- `placement-guide-chest.png` / `placement-guide-back.png` — oran rehberi

## Not

Kaynak logo: `src/assets/thalvo-logo-full-alpha.png` ve `thalvo-mark-alpha.png`.
Baskı için master’ları kullanın; mockup görselleri referans amaçlıdır.


## 5 varyant (site adresi dahil)

`variants/` klasöründe `thalvo.org` içeren 5 yerleşim:

1. Classic Chest — sol göğüs + URL
2. Back Flag — sırt + URL
3. Crest + Hem — göğüs crest, etekte URL
4. Chest + Sleeve — göğüs + kol URL
5. Center Stack — ön orta + MarineOS + URL

Detay: `variants/README.md`
