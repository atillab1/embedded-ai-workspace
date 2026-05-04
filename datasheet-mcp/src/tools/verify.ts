/**
 * verify_register_write tool: lint C code that writes to STM32 registers.
 *
 * Detected patterns (regex-based, no full C parser):
 *   1) `PERIPH->REG = 0xN;`     direct assignment of magic constant
 *   2) `PERIPH->REG |= mask;`   set bits
 *   3) `PERIPH->REG &= ~mask;`  clear bits
 *
 * For each detected write we look up the register in registers.json and
 * emit warnings:
 *   - W1: register not in our index (caller should still review)
 *   - W2: write touches reserved bits
 *   - W3: magic-number write (no #define / no comment) — readability
 *   - W4: full-word assignment — likely overwriting unrelated bits
 */
import { readFile } from "node:fs/promises";
import type { Register, BitField } from "../parseRegisters.js";
import { config } from "../config.js";

const REG_PATH = config.registersPath;

let cache: Register[] | null = null;
async function loadRegisters(): Promise<Register[]> {
  if (!cache) cache = JSON.parse(await readFile(REG_PATH, "utf8"));
  return cache!;
}

export interface Warning {
  line: number;
  code: string;
  severity: "info" | "warn" | "error";
  message: string;
}

export interface VerifyResult {
  writes: number;
  warnings: Warning[];
}

// PERIPHX->REG  op  expression ;
const WRITE_RE = /([A-Z][A-Z0-9_]*?\d?)\s*->\s*([A-Z][A-Z0-9_]+)\s*(=|\|=|&=)\s*([^;]+);/g;

function findRegister(registers: Register[], peripheralRef: string, regName: string): Register | undefined {
  // peripheralRef may be "GPIOA", "USART1" etc. Strip trailing digits/letters
  // to get peripheral group.
  const group = peripheralRef.replace(/[A-Z0-9]$/, "").replace(/\d+$/, "");
  const candidates = registers.filter(
    (r) =>
      r.name === regName &&
      (r.peripheral === group || peripheralRef.startsWith(r.peripheral))
  );
  return candidates[0];
}

function reservedBitsCovered(value: bigint, fields: BitField[]): string[] {
  // Returns list of "Bits X:Y" reserved fields where mask intersects with value
  const hits: string[] = [];
  for (const f of fields) {
    if (!f.reserved) continue;
    const m = f.bits.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
    if (!m) continue;
    const high = Number(m[1]);
    const low = m[2] !== undefined ? Number(m[2]) : high;
    let mask = 0n;
    for (let b = low; b <= high; b++) mask |= 1n << BigInt(b);
    if ((value & mask) !== 0n) {
      hits.push(`Bits ${f.bits}`);
    }
  }
  return hits;
}

function tryParseHexOrInt(expr: string): bigint | null {
  const trimmed = expr.trim();
  // Strip simple casts: (uint32_t)0x12 -> 0x12
  const stripped = trimmed.replace(/^\(\s*[a-zA-Z_]+[a-zA-Z0-9_*\s]*\)\s*/, "");
  if (/^0x[0-9A-Fa-f]+u?l?l?$/i.test(stripped)) {
    return BigInt(stripped.replace(/[ulUL]+$/, ""));
  }
  if (/^\d+u?l?l?$/i.test(stripped)) {
    return BigInt(stripped.replace(/[ulUL]+$/, ""));
  }
  // Bit shift: (1 << N)
  const sh = stripped.match(/^\(?\s*1[uU]?[lL]*\s*<<\s*(\d+)\s*\)?$/);
  if (sh) return 1n << BigInt(sh[1]);
  return null;
}

export async function verifyRegisterWrite(code: string): Promise<VerifyResult> {
  const registers = await loadRegisters();
  const warnings: Warning[] = [];
  const lines = code.split("\n");
  let totalWrites = 0;

  for (const m of code.matchAll(WRITE_RE)) {
    totalWrites++;
    const [whole, peripheralRef, regName, op, expr] = m;
    // Find line number
    const before = code.slice(0, m.index!);
    const lineNum = before.split("\n").length;
    const lineText = lines[lineNum - 1] ?? whole;

    const reg = findRegister(registers, peripheralRef, regName);

    if (!reg) {
      warnings.push({
        line: lineNum,
        code: lineText.trim(),
        severity: "info",
        message: `Register ${peripheralRef}->${regName} is not in the indexed register set; review against the datasheet manually.`,
      });
      continue;
    }

    // W4: full-word assignment ('=' rather than |= / &=) is a smell —
    // EXCEPT for "atomic write-1-to-set/clear" registers where direct
    // assignment is the *correct* idiom (writing 1 to a bit acts on that
    // bit alone; zeros are no-ops). On STM32 these include the GPIO
    // BSRR / BSRRL / BSRRH, the EXTI software-trigger registers, and
    // similar peripheral "action" registers. Read-modify-write on these
    // is actually wrong, so we don't warn.
    const ATOMIC_WRITE_REGS = /^(BSRR|BSRRL|BSRRH|SWIER|EMR|IMR_W1)$/;
    const isAtomicAction = ATOMIC_WRITE_REGS.test(reg.name);
    if (op === "=" && !isAtomicAction) {
      warnings.push({
        line: lineNum,
        code: lineText.trim(),
        severity: "warn",
        message: `Direct assignment to ${reg.fullName}: this overwrites every bit, including bits not mentioned. Prefer read-modify-write (|= or &=~) unless you really mean to reset the whole register.`,
      });
    }

    // Try to evaluate the right-hand side numerically
    const value = tryParseHexOrInt(expr);
    if (value === null) {
      // Symbolic — can't check reserved bits. Note in info if no comment
      const hasComment = /\/\*|\/\//.test(lineText);
      if (!hasComment) {
        warnings.push({
          line: lineNum,
          code: lineText.trim(),
          severity: "info",
          message: `Could not statically evaluate value written to ${reg.fullName}; consider adding a comment explaining intent.`,
        });
      }
      continue;
    }

    // W2: reserved-bit write
    const reservedHit = reservedBitsCovered(value, reg.fields);
    if (reservedHit.length > 0 && op !== "&=") {
      warnings.push({
        line: lineNum,
        code: lineText.trim(),
        severity: "warn",
        message: `Write to ${reg.fullName} touches reserved field(s): ${reservedHit.join(", ")}. Datasheet says these must be kept at reset value.`,
      });
    }

    // W3: magic-number, no comment, no macro
    const isMagic = /^0x[0-9A-Fa-f]+/.test(expr.trim()) || /^\d+/.test(expr.trim());
    const hasComment = /\/\*|\/\//.test(lineText);
    if (isMagic && !hasComment) {
      warnings.push({
        line: lineNum,
        code: lineText.trim(),
        severity: "info",
        message: `Magic value (${expr.trim()}) written to ${reg.fullName}; consider a #define or comment explaining the bit layout.`,
      });
    }
  }

  return { writes: totalWrites, warnings };
}

export function formatVerifyResult(r: VerifyResult): string {
  if (r.writes === 0) {
    return "No register writes detected in the supplied code.";
  }
  if (r.warnings.length === 0) {
    return `Inspected ${r.writes} register write(s). No issues flagged.`;
  }
  const sev = (s: string) => (s === "error" ? "[ERROR]" : s === "warn" ? "[WARN]" : "[INFO]");
  const lines = r.warnings.map(
    (w) => `${sev(w.severity)} line ${w.line}: ${w.message}\n    > ${w.code}`
  );
  return `Inspected ${r.writes} register write(s). ${r.warnings.length} finding(s):\n\n${lines.join("\n\n")}`;
}
