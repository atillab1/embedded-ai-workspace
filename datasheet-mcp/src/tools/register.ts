/**
 * get_register_info tool: structured lookup from data/registers.json.
 */
import { readFile } from "node:fs/promises";
import type { Register } from "../parseRegisters.js";
import { config } from "../config.js";

const REG_PATH = config.registersPath;

let cache: Register[] | null = null;

async function loadRegisters(): Promise<Register[]> {
  if (!cache) {
    cache = JSON.parse(await readFile(REG_PATH, "utf8"));
  }
  return cache!;
}

export type RegisterLookupResult =
  | { found: true; register: Register }
  | { found: false; suggestions: { fullName: string; section: string; page: number }[] };

export async function getRegisterInfo(
  peripheral: string,
  register: string
): Promise<RegisterLookupResult> {
  const registers = await loadRegisters();
  const wantedPeripheral = peripheral.toUpperCase();
  const wantedRegister = register.toUpperCase();

  // Exact match: peripheral matches and name matches (or fullName ends with name)
  const exact = registers.find(
    (r) =>
      r.peripheral === wantedPeripheral &&
      (r.name.toUpperCase() === wantedRegister ||
        r.fullName.toUpperCase().endsWith("_" + wantedRegister))
  );
  if (exact) return { found: true, register: exact };

  // Fuzzy: any register whose fullName contains the search terms
  const candidates = registers
    .filter(
      (r) =>
        r.peripheral === wantedPeripheral ||
        r.fullName.toUpperCase().includes(wantedRegister)
    )
    .slice(0, 10)
    .map((r) => ({ fullName: r.fullName, section: r.section, page: r.page }));

  return { found: false, suggestions: candidates };
}

export function formatRegisterInfo(result: RegisterLookupResult): string {
  if (!result.found) {
    if (result.suggestions.length === 0) {
      return "Register not found, and no similar registers indexed. Try `search_datasheet` with the full register name.";
    }
    const lines = result.suggestions.map(
      (s) => `  - ${s.fullName}  (section ${s.section}, page ${s.page})`
    );
    return `Register not found. Did you mean one of these?\n${lines.join("\n")}\n\nFor unindexed registers, use \`search_datasheet\` instead.`;
  }

  const r = result.register;
  let out = `# ${r.fullName}\n`;
  out += `Peripheral: ${r.peripheral}  |  Section: ${r.section}  |  Page: ${r.page}\n`;
  if (r.addressOffset) out += `Address offset: ${r.addressOffset}\n`;
  if (r.resetValue) out += `Reset value: ${r.resetValue}\n`;
  out += `\n## Bit fields\n`;
  if (r.fields.length === 0) {
    out += "(none parsed — see datasheet page above)\n";
  } else {
    for (const f of r.fields) {
      const tag = f.reserved ? "[Reserved]" : f.name;
      out += `- Bits ${f.bits}  ${tag}: ${f.description}\n`;
    }
  }
  return out;
}
