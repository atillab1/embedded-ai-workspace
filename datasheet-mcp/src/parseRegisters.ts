/**
 * Register parser: data/chunks.json -> data/registers.json
 *
 * Heuristic regex parser. Targets register chunks in the RM0090 (those whose
 * title contains "register" + a parenthesized name like "(GPIOx_MODER)").
 *
 * For the MVP we extract: peripheral, register name, address offset, reset
 * value, and bit-field rows ("Bits 31:30 NAME: description...").
 *
 * Coverage is intentionally partial — GPIO, USART, TIM, RCC, SPI, I2C, DMA,
 * NVIC are most common. Other peripherals' full parsing is future work.
 *
 * Run with: npm run parse-registers
 */

import { readFile, writeFile } from "node:fs/promises";
import { config } from "./config.js";

const IN_PATH = config.chunksPath;
const OUT_PATH = config.registersPath;

interface Chunk {
  id: string;
  section: string;
  title: string;
  page: number;
  text: string;
}

export interface BitField {
  bits: string;       // "31:30" or "5"
  name: string;       // "MODER15" or "Reserved"
  description: string;
  reserved: boolean;
}

export interface Register {
  peripheral: string;     // "GPIO", "USART", "RCC", etc.
  name: string;           // "MODER", "CR1", ...
  fullName: string;       // "GPIOx_MODER"
  section: string;        // "8.4.1"
  page: number;
  addressOffset?: string; // "0x00"
  resetValue?: string;    // "0x00000000"
  fields: BitField[];
}

const PERIPHERAL_PREFIXES = config.peripheralPrefixes;

function parseTitle(title: string): { peripheral: string; name: string; fullName: string } | null {
  // Match a parenthesized register identifier like (GPIOx_MODER) or (USART_CR1)
  const m = title.match(/\(([A-Z][A-Z0-9_]*?(?:x|\d+)?_[A-Z0-9_]+)\)/);
  if (!m) return null;
  const fullName = m[1];

  // Extract peripheral by checking known prefixes
  for (const p of PERIPHERAL_PREFIXES) {
    const re = new RegExp(`^${p}`);
    if (re.test(fullName)) {
      // Strip prefix + optional 'x' or digits + '_'
      const rest = fullName.replace(new RegExp(`^${p}[x\\dA-Z]*_`), "");
      return { peripheral: p, name: rest, fullName };
    }
  }
  return null;
}

function parseAddressOffset(text: string): string | undefined {
  const m = text.match(/Address offset:\s*(0x[0-9A-Fa-f]+(?:\s*-\s*0x[0-9A-Fa-f]+)?)/);
  return m?.[1].replace(/\s+/g, "");
}

function parseResetValue(text: string): string | undefined {
  // Match "Reset value: 0x0000 0000" but stay within the same line
  // (no newlines in capture)
  const m = text.match(/Reset value:\s*(0x[0-9A-Fa-f][0-9A-Fa-f ]{2,12})/);
  if (!m) return undefined;
  return m[1].replace(/\s+/g, "");
}

function parseBitFields(text: string): BitField[] {
  const fields: BitField[] = [];

  // Match "Bits 31:30" / "Bit 5" headers, capture description until next header
  // or end of text.
  const headerRe = /\bBits?\s+(\d{1,2}(?::\d{1,2})?)\s+([^\n]*?)(?=\n|$)/g;
  const matches: { bits: string; restLine: string; index: number }[] = [];
  for (const m of text.matchAll(headerRe)) {
    matches.push({ bits: m[1], restLine: m[2], index: m.index! });
  }

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const bodyEnd = next ? next.index : Math.min(text.length, cur.index + 800);
    const body = text.slice(cur.index, bodyEnd);

    // First line after "Bits N:M" usually has "NAME: description"
    let name = "Reserved";
    let description = cur.restLine.trim();
    let reserved = /reserved/i.test(cur.restLine);

    const nameMatch = cur.restLine.match(/^([A-Z][A-Z0-9_\[\]:]*?):\s*(.*)$/);
    if (nameMatch) {
      name = nameMatch[1].trim();
      description = nameMatch[2].trim();
      reserved = false;
    }

    // Append continuation lines (up to ~300 chars) for richer description
    const continuation = body.slice(cur.restLine.length).replace(/\s+/g, " ").trim();
    if (continuation && !reserved) {
      description = `${description} ${continuation}`.slice(0, 400).trim();
    }

    fields.push({ bits: cur.bits, name, description, reserved });
  }

  return fields;
}

async function main() {
  console.log(`Reading ${IN_PATH}...`);
  const chunks = JSON.parse(await readFile(IN_PATH, "utf8")) as Chunk[];
  console.log(`Loaded ${chunks.length} chunks.`);

  const registers: Register[] = [];

  for (const chunk of chunks) {
    // Heuristic: must mention "register" in title and have a parenthesized
    // register name
    if (!/register/i.test(chunk.title)) continue;
    const parsed = parseTitle(chunk.title);
    if (!parsed) continue;

    const reg: Register = {
      peripheral: parsed.peripheral,
      name: parsed.name,
      fullName: parsed.fullName,
      section: chunk.section,
      page: chunk.page,
      addressOffset: parseAddressOffset(chunk.text),
      resetValue: parseResetValue(chunk.text),
      fields: parseBitFields(chunk.text),
    };

    // Quality filter: a real register chunk should yield at least 1 bit field
    // OR have an explicit address offset
    if (reg.fields.length === 0 && !reg.addressOffset) continue;

    registers.push(reg);
  }

  await writeFile(OUT_PATH, JSON.stringify(registers, null, 2));

  // Summary stats
  const byPeripheral = new Map<string, number>();
  for (const r of registers) {
    byPeripheral.set(r.peripheral, (byPeripheral.get(r.peripheral) ?? 0) + 1);
  }
  console.log(`\nDone. Parsed ${registers.length} registers.`);
  console.log("By peripheral:");
  for (const [p, n] of [...byPeripheral.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${p.padEnd(10)} ${n}`);
  }
  console.log(`\nOutput: ${OUT_PATH}`);

  // Show one sample
  const sample = registers.find(
    (r) => r.peripheral === "GPIO" && r.fields.length > 3
  );
  if (sample) {
    console.log(`\n--- Sample: ${sample.fullName} ---`);
    console.log(`section=${sample.section}, page=${sample.page}, offset=${sample.addressOffset}, reset=${sample.resetValue}`);
    for (const f of sample.fields.slice(0, 3)) {
      console.log(`  Bits ${f.bits}  ${f.name}: ${f.description.slice(0, 100)}`);
    }
    if (sample.fields.length > 3) console.log(`  ... ${sample.fields.length - 3} more`);
  }
}

main().catch((err) => {
  console.error("Register parse failed:", err);
  process.exit(1);
});
