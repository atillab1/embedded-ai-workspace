/**
 * Smoke test all three tools end-to-end without spinning up MCP transport.
 * Run with: npx tsx src/smoke.ts
 */
import { searchDatasheet, formatSearchHits } from "./tools/search.js";
import { getRegisterInfo, formatRegisterInfo } from "./tools/register.js";
import { verifyRegisterWrite, formatVerifyResult } from "./tools/verify.js";

async function main() {
  console.log("=".repeat(60));
  console.log("TEST 1: search_datasheet");
  console.log("=".repeat(60));
  const hits = await searchDatasheet("GPIO alternate function configuration", 3);
  console.log(formatSearchHits(hits).slice(0, 1500));

  console.log("\n" + "=".repeat(60));
  console.log("TEST 2: get_register_info(GPIO, MODER)");
  console.log("=".repeat(60));
  const info1 = await getRegisterInfo("GPIO", "MODER");
  console.log(formatRegisterInfo(info1).slice(0, 1500));

  console.log("\n" + "=".repeat(60));
  console.log("TEST 3: get_register_info(USART, CR1)");
  console.log("=".repeat(60));
  const info2 = await getRegisterInfo("USART", "CR1");
  console.log(formatRegisterInfo(info2).slice(0, 1000));

  console.log("\n" + "=".repeat(60));
  console.log("TEST 4: verify_register_write");
  console.log("=".repeat(60));
  const code = `
void init_led(void) {
    GPIOD->MODER = 0x55555555;            /* 16 pins as output */
    GPIOD->ODR  |= (1 << 12);
    USART1->CR1  = 0xFFFFFFFF;
    SPI1->CR2   |= mask;
}
`;
  const result = await verifyRegisterWrite(code);
  console.log(formatVerifyResult(result));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
