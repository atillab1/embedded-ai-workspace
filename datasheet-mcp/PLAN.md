# FAZ 2 — Datasheet MCP — 14 Günlük Plan

> **Hedef:** STM32F407 Reference Manual (RM0090) PDF'ini sorgulanabilir bir
> MCP server'a dönüştür. Claude Code, Datasheet MCP'yi kullanarak register
> sorularına cevap verebilsin, kodda yazılmış register write'larını
> datasheet'le çapraz kontrol edebilsin.
>
> **Donanım:** STM32F407VGT6 dev board (elinde ✅)
> **Stack:** TypeScript + Node 20+, MCP SDK, pdf-parse, OpenAI embeddings, LanceDB

---

## Hafta 1 — Temel altyapı + ilk çalışan MCP

### Gün 1 — Ortam kurulumu + STM32 toolchain doğrulama (3-4 saat)

**Hedef:** Bilgisayarın bu işe hazır mı, board PC ile konuşuyor mu doğrulamak.

**Adımlar:**
1. **Node 20+ kontrol:** terminalde `node --version`. 20'den düşükse [nodejs.org](https://nodejs.org)'dan LTS kur.
2. **TypeScript global:** `npm install -g typescript ts-node`. Test: `tsc --version`.
3. **STM32CubeIDE indir** (ücretsiz, ST resmi). Faz 2'de kod yazmayacaksın ama Faz 3 için gerek olacak.
4. **Board'u USB'ye tak.** Windows aygıt yöneticisinde "ST-Link" diye görünüyor mu kontrol et. Görünmüyorsa [ST-Link sürücüsü](https://www.st.com/en/development-tools/stsw-link009.html) kur.
5. **Klasör hazırla:** `<your-workspace>/SkillEmbedded/datasheet-mcp/` (zaten oluşturuldu).

**Deliverable:**
- `node --version` 20+ gösteriyor
- ST-Link aygıt yöneticisinde ✅
- Klasör mevcut

**Bilmen gereken:**
- *ST-Link* = STM32 board'unu PC'ye bağlayan in-circuit debugger/programmer. Senin board'da onboard (ayrı kablo gerekmez).

---

### Gün 2 — MCP "Hello World" (3-4 saat)

**Hedef:** En basit haliyle çalışan bir MCP server yaz, Claude Code'a bağla, "echo" yap.

**Adımlar:**
1. Klasörde:
   ```bash
   cd <your-workspace>/SkillEmbedded/datasheet-mcp
   npm init -y
   npm install @modelcontextprotocol/sdk
   npm install -D typescript @types/node tsx
   ```
2. `tsconfig.json` oluştur (target: ES2022, module: NodeNext, strict: true).
3. `src/index.ts` yaz — tek tool'lu server: `echo(message)`.
4. `package.json`'a `"start": "tsx src/index.ts"` ekle.
5. Claude Code'un MCP config dosyasını bul:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json` (Claude Desktop için)
   - Claude Code için: `.claude/mcp.json` proje kökünde veya `~/.claude.json`
6. MCP server'ı bağla:
   ```json
   {
     "mcpServers": {
       "datasheet": {
         "command": "node",
         "args": ["<absolute-path>/SkillEmbedded/datasheet-mcp/dist/index.js"]
       }
     }
   }
   ```
7. Claude Code'u yeniden başlat, "use the echo tool with message 'hello'" yaz.

**Deliverable:**
- MCP server start oluyor
- Claude Code echo tool'unu görüyor
- "hello" yazınca "You said: hello" cevabı geliyor

**Tuzaklar:**
- Path'lerde Windows backslash sorun çıkarır → forward slash kullan
- ESM/CJS kafa karışıklığı için: `"type": "module"` ekle `package.json`'a
- MCP transport olarak **stdio** (standart) kullan, başlangıçta bu en kolayı

**Kaynak:**
- [MCP Quickstart (TypeScript)](https://modelcontextprotocol.io/quickstart/server) — resmi tutorial

---

### Gün 3 — PDF ingestion: ham metni çıkar (3-4 saat)

**Hedef:** STM32F407 reference manual'ı düz metne dönüştür, sayfa numaralarını koru.

**Adımlar:**
1. **PDF'i indir:** [RM0090 Reference Manual](https://www.st.com/resource/en/reference_manual/rm0090-stm32f405415-stm32f407417-stm32f427437-and-stm32f429439-advanced-armbased-32bit-mcus-stmicroelectronics.pdf) (~1700 sayfa, 35 MB).
2. `pdfs/RM0090.pdf` olarak kaydet.
3. `npm install pdf-parse` veya `pdfjs-dist` (önerilen: pdfjs-dist, daha güvenilir).
4. `src/ingest.ts` yaz:
   ```typescript
   // Her sayfayı ayrı string olarak çıkar
   // pages: { pageNum: number, text: string }[]
   ```
5. Çıktıyı `data/raw-pages.json` olarak yaz.

**Deliverable:**
- `data/raw-pages.json` 1700+ sayfa içeriyor
- Her sayfa kendi text'iyle, page number tagged

**Bilmen gereken:**
- PDF parse %100 mükemmel olmaz — formüller, şekiller, multi-column layout zorlaştırır
- Şimdilik "iyi enough" yeterli. Kötü çıkan kısımları sonra fixleriz.

---

### Gün 4 — Akıllı chunking (3-4 saat)

**Hedef:** Sayfaları daha küçük, anlamlı parçalara böl. Her parça bir konuyu kapsasın.

**Niye chunking?** Embedding ve search kalitesi için. Tek bir 5000 kelimelik sayfa embed edersen anlamı bulanıklaşır. 200-500 kelimelik parçalar daha keskin sonuç verir.

**Adımlar:**
1. `src/chunk.ts` yaz.
2. **Strateji:** her sayfayı section heading'lerine göre böl. STM32 datasheet'inde headings genelde:
   - "10.2.1 GPIO port output data register (GPIOx_ODR)"
   - Numbered heading + register/feature name
3. Regex ile heading'leri yakala, her heading + altındaki paragrafları bir chunk yap.
4. Her chunk'a metadata ekle:
   ```typescript
   {
     id: string,
     section: "10.2.1",
     title: "GPIOx_ODR",
     page: 287,
     text: "..."
   }
   ```
5. Çıktı: `data/chunks.json` (~3000-5000 chunk olmalı).

**Deliverable:**
- `data/chunks.json` mevcut
- Spot check: 10 random chunk'a bak, başlığa karşılık gelen içeriği var mı?

---

### Gün 5 — Embedding + LanceDB ingestion (3-4 saat)

**Hedef:** Her chunk için vector embedding al, LanceDB'ye yaz.

**Adımlar:**
1. **OpenAI API key al** ([platform.openai.com](https://platform.openai.com)). $5 kredi yeterli.
2. `npm install openai @lancedb/lancedb`
3. `.env` dosyasına `OPENAI_API_KEY=sk-...` koy. **`.gitignore`'a `.env` ekle.**
4. `src/embed.ts`:
   - chunks.json'u oku
   - Her chunk için `text-embedding-3-small` ile vector al (1536 dim)
   - Batch işle (100 chunk/request) — hız + maliyet için
   - LanceDB tablosuna yaz: `{ id, section, title, page, text, vector }`
5. Bir kez çalıştır, ~5 dakika sürer, ~$0.05 tutar.

**Deliverable:**
- `data/lance-db/` klasörü dolu
- `npm run check-db` (sen yazacaksın) ile 3000+ row görünüyor

**Maliyet:**
- 5000 chunk × ~300 token ortalama = 1.5M token
- text-embedding-3-small: $0.02/1M token → ~3 sent. Endişelenmeyecek seviye.

---

### Gün 6 — İlk gerçek MCP tool: `search_datasheet` (3-4 saat)

**Hedef:** Claude'dan "find info about X" diye sorulduğunda relevant chunk'ları döndüren tool.

**Adımlar:**
1. `src/tools/search.ts`:
   ```typescript
   async function searchDatasheet(query: string, k: number = 5) {
     // 1. query'yi embed et
     // 2. LanceDB'de cosine similarity search
     // 3. top-k chunk'ı dön
   }
   ```
2. MCP server'a tool olarak kaydet (Gün 2'deki echo'nun yerine geçer).
3. Tool description'a dikkat — Claude bunu okuyup ne zaman çağıracağına karar veriyor:
   ```
   "Search the STM32F407 reference manual for information about
    peripherals, registers, or features. Returns the most relevant
    sections with page numbers."
   ```

**Deliverable:**
- Claude'a "use datasheet to find info about GPIO alternate function configuration" yazınca:
  - Tool çağrılıyor
  - 5 chunk dönüyor, her biri sayfa numarası ile
  - Claude bunlardan özetli bir cevap veriyor

---

### Gün 7 — Hafta 1 toparlama + dogfood (2-3 saat)

**Hedef:** Hafta 1'deki çalışmayı sağlamlaştır, gerçek soru-cevap senaryosu.

**Adımlar:**
1. README.md yaz (kısa: ne yapıyor, nasıl kurulur, nasıl kullanılır).
2. 5 farklı gerçek soru sor Claude'a, hepsi datasheet MCP'yi çağırsın:
   - "What's the function of bit 17 in GPIOx_PUPDR?"
   - "How do I configure USART1 for 115200 baud?"
   - "Which timer can generate PWM on PA5?"
   - "What is the maximum I2C clock speed for STM32F407?"
   - "Which DMA stream serves SPI1_RX?"
3. Cevapları not al — doğru mu? Hangi sorularda zayıf? (Bu Hafta 2 için iyileştirme listesi olur.)

**Deliverable:**
- Çalışan + dogfood'lanmış v0.1
- Bilinen sınırlamaların listesi (Gün 8-14'te bunları çözeriz)

---

## Hafta 2 — Yapılandırılmış sorgular + Faz 1 entegrasyonu

### Gün 8-9 — Register tablosu çıkarımı (toplam 6-8 saat)

**Hedef:** Datasheet'teki register tablolarını yapılandırılmış JSON'a çevir.

**Niye?** "Hangi bit ne yapıyor" sorusu *full-text search* ile bulanıklaşıyor. Yapılandırılmış data ile **kesin** cevap verilebilir.

**Adımlar:**
1. Bir register sayfasının yapısını analiz et (örnek: GPIOx_MODER, sayfa 285):
   ```
   Bits 31:30  MODER15[1:0]: Port x configuration bits
                00: Input (reset state)
                01: General purpose output mode
                ...
   ```
2. Heuristic ile parse (regex + heuristics):
   - "Bits N:M" veya "Bit N" pattern'lerini yakala
   - Bit field name, description, possible values çıkar
3. Çıktı format:
   ```json
   {
     "peripheral": "GPIO",
     "register": "MODER",
     "address_offset": "0x00",
     "reset": "0x00000000",
     "fields": [
       {
         "bits": "31:30",
         "name": "MODER15",
         "description": "Port x configuration bits",
         "values": { "00": "Input", "01": "Output", ... }
       },
       ...
     ]
   }
   ```
4. **İlk seferde sadece GPIO + USART + TIM register'larını parse et.** Tüm peripheral'lar Hafta 4 işi.
5. `data/registers.json` olarak kaydet.

**Deliverable:**
- 30-50 register parse edilmiş, JSON dolu
- Manuel doğrulama: 5 register'ı PDF'le karşılaştır, doğru mu?

---

### Gün 10 — `get_register_info` MCP tool (3-4 saat)

**Hedef:** "Tell me about GPIOA->MODER" gibi sorulara yapılandırılmış cevap.

**Adımlar:**
1. `src/tools/register.ts`:
   ```typescript
   async function getRegisterInfo(peripheral: string, register: string) {
     // registers.json'dan ara, bul, dön
   }
   ```
2. Tool description'a örnek kullanım koy.
3. Test: Claude'a "what bit fields are in USART1_CR1?" yazınca yapılandırılmış cevap.

**Deliverable:**
- 2. tool çalışıyor
- 5 farklı register sorusu doğru cevap alıyor

---

### Gün 11-12 — Cross-check tool: `verify_register_write` (6-8 saat)

**Hedef:** **Bu projenin yıldız özelliği.** Kullanıcı C kodu paylaşıyor, tool register write'larını datasheet'le kontrol ediyor.

**Adımlar:**
1. C parser yaz (basit regex yeterli, full parser overkill):
   - `GPIOA->MODER = 0xFFFFFFFF;` pattern'lerini yakala
   - Bit-mask şeklinde olanlar: `GPIOA->MODER |= (1 << 16);`
2. Her tespit için:
   - registers.json'dan ilgili register'ı çek
   - Reserved bit'lere yazma var mı? Geçersiz değer var mı?
   - Reset value'dan tehlikeli sapma var mı?
3. MCP tool: `verify_register_write(c_code: string)` → uyarı listesi dön.

**Deliverable:**
- Şu kodu verince:
  ```c
  GPIOA->MODER = 0x3FFFFFFF;
  ```
  Tool şunu uyarıyor: "Bit 31:30 (MODER15): you are clearing this — was this intentional?"

---

### Gün 13 — MISRA Skill + Datasheet MCP entegrasyon testi (3-4 saat)

**Hedef:** İki sistemin **birlikte** çalıştığını kanıtla.

**Adımlar:**
1. STM32CubeIDE'de yeni proje aç (board'unla).
2. Bilerek hatalı bir GPIO init kodu yaz:
   ```c
   void init_led(void) {
       GPIOD->MODER = 0x55555555;          /* Hangi pin'leri output yapıyor? */
       int unused;                          /* MISRA Rule 9.1 */
       GPIOD->ODR |= (uint32_t)(1 << 12);   /* LED4 yanmalı */
   }
   ```
3. Claude Code'da hem MISRA Skill hem Datasheet MCP aktifken:
   "Review this code for MISRA compliance and verify register writes"
4. Beklenti — tek cevapta:
   - MISRA: Rule 9.1 (unused), Rule 10.4 (signed/unsigned)
   - Datasheet: GPIOD->MODER = 0x55555555 → her pin "01" (output) yapıyor, bu doğru mu istediğin?
5. **Board'a flash et** (CubeIDE üzerinden), LED4 yanıyor mu?

**Deliverable:**
- Screenshot: Claude'un birleşik review cevabı
- LED4 board'da yanıyor (Faz 2 + donanım birleşti!)
- README'ye demo bölümü ekle

---

### Gün 14 — Cilalama, GitHub'a push, retrospektif (3-4 saat)

**Hedef:** v1.0 olarak yayınla.

**Adımlar:**
1. README'yi cilala — kurulum, kullanım, demo GIF/screenshot.
2. Bilinen sınırlamaları yaz (`KNOWN_LIMITATIONS.md`):
   - Hangi register'lar parse edilmedi
   - PDF parse'ın zayıf olduğu sayfalar
   - Cross-check'in atladığı pattern'ler
3. GitHub'a public repo aç, push et. README'de MISRA Skill repo'suna link.
4. **Retrospektif yaz** (`RETRO.md`):
   - Plan vs gerçek (hangi günler taştı, neden?)
   - En zor kısım hangisiydi?
   - Faz 3'e ne taşımalı?

**Deliverable:**
- GitHub'da public repo
- v1.0 release tag
- Retrospektif belgesi

---

## Faz 3'e Köprü

Bu plan biterse Faz 3 (HIL Pipeline) için elinde:
- ✅ MISRA Skill (Faz 1)
- ✅ Datasheet MCP (Faz 2)
- ✅ TypeScript + Node + MCP protokol deneyimi
- ✅ STM32F407 board'unu komut satırından flash etme deneyimi
- ✅ Birleşik dogfood pipeline'ın canlı örneği

Bu noktada Faz 3'ün ana zorluğu **HIL test runner**ı — board'u GitHub Actions'tan tetikleyip sonucu CI yorumuna döndürmek. Faz 2 bunun altyapısının %60'ını veriyor.

---

## Acil İlk Adım: Bugün Yap

1. Gün 1'deki kontroller (Node, ST-Link, klasör)
2. **MISRA Skill'i test et** — `test-input.c` üzerinde (henüz yapmadın). Gün 2'ye başlamadan önce skill'in çalıştığını doğrulamış ol. Çünkü Datasheet MCP de aynı path üzerinde çalışıyor — biri çalışmıyorsa diğeri de çalışmaz.

Sonraki oturumda Gün 1 sonuçlarını paylaş, beraber Gün 2'ye geçelim.
