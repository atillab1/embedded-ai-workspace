# Faz 2 retrospektif — datasheet-mcp v0.3.0

## Plan vs gerçek

| Gün | Planlanan süre | Gerçek | Not |
|---|---|---|---|
| 1 — Ortam | 3-4 sa | <1 sa | Node + ST-Link önceden hazırdı |
| 2 — MCP Hello World | 3-4 sa | ~1 sa | SDK boilerplate ufak; karışıklık `.mcp.json` path'inde Windows backslash |
| 3 — PDF ingestion | 3-4 sa | ~30 dk | pdfjs-dist sürpriz hızlı (3.6s/1757 sayfa) |
| 4 — Chunking | 3-4 sa | ~1 sa | 3 kez iterasyon: önce TOC parazit, regex sertleştirildi |
| 5 — Embedding + DB | 3-4 sa | ~1 sa | OpenAI yerine **lokal MiniLM** seçildi → kullanıcı için sıfır maliyet, plandan bilinçli sapma |
| 6 — search_datasheet | 3-4 sa | ~30 dk | LanceDB API'si beklenenden basit |
| 7 — Dogfood | 2-3 sa | ~30 dk | Otomatize edildi (`src/dogfood.ts`) — manuel sormak yerine |
| 8-9 — Register parser | 6-8 sa | ~1 sa | Heuristic regex; %60 kaliteli, bilinen sınırlar belgelendi |
| 10 — get_register_info | 3-4 sa | ~30 dk | Lookup + fuzzy fallback |
| 11-12 — verify_register_write | 6-8 sa | ~1 sa | Regex C parser yeterli; 4 ayrı uyarı kuralı |
| 13 — Integration | 3-4 sa | ~30 dk (sw) + ⏳ donanım | Buggy/clean örnek + recipe yazıldı; gerçek flash kullanıcıya bırakıldı |
| 14 — Cilalama | 3-4 sa | ~1 sa | README + KNOWN_LIMITATIONS + DOGFOOD + RETRO + config refactor |

**Toplam:** plan ~50-60 saat, gerçek ~10 saat.

Plan **çok şişirilmişti**. Sebep: Anthropic'in MCP SDK'sı, pdfjs-dist, LanceDB ve transformers kütüphaneleri olgun ve iyi belgelenmiş — hepsi ilk denemede çalıştı. Gerçek zaman heuristic'leri ayarlamaya gitti.

## Plandan sapmalar

| Sapma | Neden | Sonuç |
|---|---|---|
| OpenAI → lokal MiniLM embedding | API key + kredi engeli | Kullanıcı için sıfır maliyet, hız aynı |
| Manuel dogfood → otomatik dogfood script | Tekrarlanabilir, regression test olarak da kullanılabilir | `npx tsx src/dogfood.ts` her commit'te çalışır |
| Donanım flash → recipe + örnek dosyalar | LLM oturumu donanıma erişemiyor | Kullanıcı tarafında 15 dk iş kaldı |
| Tek-PDF → config-driven | LinkedIn paylaşımında genel kullanılabilir olsun diye | `.env` ile başka manuel/RFC/kitap için tekrar kullanılabilir |

## En zor 3 kısım

1. **Chunking heuristic'leri**. PDF'in TOC + index sayfaları kaliteyi baştan
   bozuyordu. 3 iterasyon: dot-leader oranı, ALLCAPS register-name yoğunluğu,
   page-number-suffix line sayısı. Hala mükemmel değil.
2. **Register parser'ın bit-field name detection**. `MODER15[1:0]:` gibi
   compound name'lerde regex tutarsız. ~%60 register'ı eksiksiz veriyor,
   geri kalanın description'u kayıyor. Cross-encoder + better PDF layout
   tools ile çözülür ama scope dışına çıktı.
3. **TypeScript ESM + Node + Hugging Face transformers** üçünün uyumu.
   `pipeline()` döndürdüğü tensor tipi `any` üzerinden gidiyor — strict
   mode'da `extractor: any` yapmak gerekti. SDK'lar olgunlaştıkça düzelir.

## Faz 3'e taşıdığım dersler

- **Lokal model + dosya-bazlı DB** kombosu çoğu durumda yeterli kaliteyi
  veriyor ve setup'ı sıfırlıyor. Faz 3'te HIL test runner için de aynı
  felsefe: harici servis yok, her şey local çalışsın, GitHub Actions
  self-hosted runner üzerinde dönsün.
- **Otomatize dogfood** = regression test. Faz 3'te de "5 senaryo"
  bir test script'i olacak.
- **`.env` + `config.ts`** her projeye konsa bedava esneklik. Faz 3'ün
  serial-mcp + hil-runner ikilisinde de aynı yapı.

## Bilinen sınırlamalar (henüz çözülmedi)

`KNOWN_LIMITATIONS.md`'de detay var. Özet:

- I2C/elektriksel-spec sorgularında search zayıflıyor (case 4 fail).
- GPIO_MODER ve USART_BRR'nin bit field'ları parse olmuyor.
- C parser regex; `HAL_GPIO_Init()` çağrılarını veya struct write'ları
  yakalayamıyor.

## Açık metrikler

- Kod: ~855 satır TypeScript (test'ler dahil)
- Build pipeline: 85 sn (CPU)
- Disk: ~120 MB (model + DB)
- Test başarı oranı: 8/10
- API maliyeti: 0
