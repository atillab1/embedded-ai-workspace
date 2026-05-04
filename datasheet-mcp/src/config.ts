/**
 * Central configuration. Override anything via environment variables
 * (see .env.example). Defaults target the STM32F407 RM0090 reference manual.
 *
 * To repurpose this server for a different datasheet:
 *   1. Drop your PDF in `pdfs/` and set DATASHEET_PDF.
 *   2. Optionally set DATASHEET_NAME / DATASHEET_DESCRIPTION so the
 *      search_datasheet tool description matches your doc.
 *   3. If your manual uses non-STM32 peripheral names, edit
 *      PERIPHERAL_PREFIXES below.
 *   4. Rebuild: npm run ingest && npm run chunk && npm run embed && npm run parse-registers
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

function abs(p: string): string {
  return resolve(PROJECT_ROOT, p);
}

export const config = {
  // -- input --
  pdfPath: abs(process.env.DATASHEET_PDF ?? "pdfs/RM0090.pdf"),

  // -- build artefacts --
  rawPagesPath: abs("data/raw-pages.json"),
  chunksPath: abs("data/chunks.json"),
  registersPath: abs("data/registers.json"),
  dbPath: abs("data/lance-db"),
  tableName: process.env.DATASHEET_TABLE ?? "datasheet",

  // -- identity (shown to Claude in tool descriptions) --
  datasheetName: process.env.DATASHEET_NAME ?? "STM32F407 reference manual (RM0090)",
  datasheetShortName: process.env.DATASHEET_SHORT ?? "STM32F407",
  datasheetDescription:
    process.env.DATASHEET_DESCRIPTION ??
    "STM32F407 microcontroller peripherals, registers, clock trees, DMA, interrupts.",

  // -- chunking --
  // Regex for section headings. STM32/ST manuals: "8.4.1 GPIO ..."
  // Other vendors might need a different pattern.
  headingRegex: /(?:^|\n)\s*(\d{1,2}(?:\.\d{1,3}){1,3})\s+([^\n]{5,200})/g,
  maxChunkChars: 4000,

  // -- register parser --
  // Peripheral group prefixes used by your manual. STM32 default below.
  // For NXP/TI/Nordic, replace with your vendor's naming.
  peripheralPrefixes: (process.env.DATASHEET_PERIPHERALS?.split(",") ?? [
    "GPIO", "USART", "UART", "TIM", "RCC", "SPI", "I2C", "DMA", "NVIC",
    "EXTI", "ADC", "DAC", "CAN", "USB", "OTG", "SDIO", "FSMC", "FMC",
    "CRC", "RNG", "HASH", "CRYP", "PWR", "FLASH", "DBG", "DCMI", "ETH",
    "LTDC", "IWDG", "WWDG", "RTC", "SYSCFG",
  ]).map((s) => s.trim()).filter(Boolean),

  // -- feature flags --
  // Disable register tools if your document is not register-oriented
  // (e.g. you're indexing an RFC or a textbook).
  enableRegisterTools: process.env.DISABLE_REGISTER_TOOLS !== "1",

  // -- embedding --
  embeddingModel: process.env.EMBEDDING_MODEL ?? "Xenova/all-MiniLM-L6-v2",
} as const;
