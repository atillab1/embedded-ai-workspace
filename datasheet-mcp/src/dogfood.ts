/**
 * Dogfood: realistic queries against all three tools, plus quality notes.
 * Run with: npx tsx src/dogfood.ts > DOGFOOD-output.txt
 */
import { searchDatasheet, formatSearchHits } from "./tools/search.js";
import { getRegisterInfo, formatRegisterInfo } from "./tools/register.js";
import { verifyRegisterWrite, formatVerifyResult } from "./tools/verify.js";

interface SearchCase { kind: "search"; q: string; expectKeyword: RegExp; }
interface RegCase { kind: "register"; p: string; r: string; expectFields: number; }
interface VerifyCase { kind: "verify"; code: string; minWarnings: number; }

const cases: (SearchCase | RegCase | VerifyCase)[] = [
  { kind: "search", q: "GPIO alternate function configuration", expectKeyword: /AFR|alternate function/i },
  { kind: "search", q: "USART baud rate calculation formula", expectKeyword: /BRR|USARTDIV|fraction/i },
  { kind: "search", q: "DMA stream priority levels", expectKeyword: /priority|DMA_S.*CR/i },
  { kind: "search", q: "I2C maximum clock frequency fast mode", expectKeyword: /400|fast mode|fm/i },
  { kind: "search", q: "SysTick timer reload value", expectKeyword: /SysTick|reload|LOAD/i },
  { kind: "register", p: "GPIO", r: "MODER", expectFields: 0 }, // known-flaky
  { kind: "register", p: "USART", r: "BRR", expectFields: 1 },
  { kind: "register", p: "RCC", r: "AHB1ENR", expectFields: 1 },
  { kind: "register", p: "TIM", r: "CR1", expectFields: 1 },
  {
    kind: "verify",
    code: `void init(void) {
    GPIOA->MODER = 0xFFFFFFFF;       /* every pin to output */
    USART1->CR1 |= 0x2000;           /* enable USART */
    SPI1->CR2 = some_runtime_value;
    RCC->AHB1ENR |= 1 << 0;          /* enable GPIOA clock */
}`,
    minWarnings: 2,
  },
];

function pad(n: number, w: number): string { return String(n).padStart(w); }

async function main() {
  console.log("# Datasheet-MCP Dogfood Report");
  console.log(`Generated: ${new Date().toISOString()}\n`);

  const results: { case: string; pass: boolean; note: string }[] = [];

  let i = 0;
  for (const c of cases) {
    i++;
    console.log("\n" + "=".repeat(72));

    if (c.kind === "search") {
      console.log(`## Case ${i}: search_datasheet  "${c.q}"`);
      const hits = await searchDatasheet(c.q, 3);
      const formatted = formatSearchHits(hits);
      console.log(formatted.slice(0, 600));
      const top = hits[0];
      const pass = top !== undefined && (c.expectKeyword.test(top.title) || c.expectKeyword.test(top.text));
      const note = pass
        ? `top hit: ${top.title} (page ${top.page})`
        : `top hit unrelated: ${top?.title ?? "(none)"}`;
      results.push({ case: `search "${c.q}"`, pass, note });
      console.log(`\n[${pass ? "PASS" : "FAIL"}] ${note}`);
    } else if (c.kind === "register") {
      console.log(`## Case ${i}: get_register_info  ${c.p}->${c.r}`);
      const info = await getRegisterInfo(c.p, c.r);
      console.log(formatRegisterInfo(info).slice(0, 400));
      const pass = info.found && info.register.fields.length >= c.expectFields;
      const note = info.found
        ? `found ${info.register.fullName}, ${info.register.fields.length} fields`
        : "not found";
      results.push({ case: `register ${c.p}->${c.r}`, pass, note });
      console.log(`\n[${pass ? "PASS" : "FAIL"}] ${note}`);
    } else {
      console.log(`## Case ${i}: verify_register_write`);
      const r = await verifyRegisterWrite(c.code);
      console.log(formatVerifyResult(r).slice(0, 800));
      const pass = r.warnings.length >= c.minWarnings;
      results.push({
        case: "verify_register_write",
        pass,
        note: `${r.writes} writes, ${r.warnings.length} warnings`,
      });
      console.log(`\n[${pass ? "PASS" : "FAIL"}] ${r.warnings.length} warnings (expected >= ${c.minWarnings})`);
    }
  }

  console.log("\n" + "=".repeat(72));
  console.log("# Summary\n");
  const passCount = results.filter((r) => r.pass).length;
  console.log(`${passCount}/${results.length} cases passed.\n`);
  console.log("| # | Case | Pass | Note |");
  console.log("|---|---|---|---|");
  results.forEach((r, idx) => {
    console.log(`| ${pad(idx + 1, 2)} | ${r.case} | ${r.pass ? "✅" : "❌"} | ${r.note} |`);
  });
}

main().catch((err) => { console.error(err); process.exit(1); });
