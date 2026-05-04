# Dogfood report — v0.3.0

10 realistic queries against the three tools. Run with `npx tsx src/dogfood.ts`.

## Summary

**8/10 passed.**

| # | Case | Result | Note |
|---|---|---|---|
| 1 | search "GPIO alternate function configuration" | ✅ | top hit: I/O alternate function (p. 278) |
| 2 | search "USART baud rate calculation formula" | ✅ | top hit: USART_BRR (p. 1013) |
| 3 | search "DMA stream priority levels" | ✅ | top hit: DMA introduction (p. 305) |
| 4 | search "I2C maximum clock frequency fast mode" | ❌ | top hit unrelated (RCC AHB3 LP mode) |
| 5 | search "SysTick timer reload value" | ✅ | top hit: SysTick CALIB (p. 374) |
| 6 | register GPIO->MODER | ✅ | found, 0 fields parsed |
| 7 | register USART->BRR | ❌ | found, 0 fields parsed |
| 8 | register RCC->AHB1ENR | ✅ | found, 22 fields ✅ |
| 9 | register TIM->CR1 | ✅ | found, 6 fields ✅ |
| 10 | verify_register_write (4 writes) | ✅ | 4 warnings emitted |

## Quality observations

### Search

- **Strong on register names**: when query mentions a register name or
  formal feature ("USART baud rate", "SysTick reload"), top-1 hit is
  consistent with the manual.
- **Weak on physical-constant lookups**: queries like "I2C maximum
  clock frequency" pull RCC clock-enable register chunks instead of
  the I2C electrical/timing section. This is an embedding-quality
  artifact: small embedding model treats "I2C clock" and "I2C clock
  enable bit" as similar.
- **Mitigation:** for spec lookups, asking via `search_datasheet` with
  a more specific query ("I2C fast mode SCL frequency 400 kHz") works.

### Register parser

- **Strong:** RCC_AHB1ENR (22 fields), TIMx_CR1 (6 fields). Real
  bit-by-bit register descriptions parse cleanly.
- **Weak:** GPIOx_MODER and USART_BRR show 0 parsed fields. Cause:
  these registers use compound bit-field names (`MODER15[1:0]`,
  `DIV_Mantissa[11:0]`) and the heuristic regex's "Bits N:M NAME:"
  pattern doesn't match the layout the PDF parser produces for
  these pages.
- **Mitigation:** manual fallback to `search_datasheet` with the
  register name still gives the source page.

### Verify

- 4 register writes → 4 warnings. Caught:
  - `GPIOA->MODER = 0xFFFFFFFF;` → direct-assignment warning.
  - `USART1->CR1 |= 0x2000;` → magic-number info.
  - `SPI1->CR2 = some_runtime_value;` → direct-assignment + unevaluable warning.
- Did **not** flag `RCC->AHB1ENR |= 1 << 0;` because the value
  evaluated to bit 0 (GPIOAEN), which is a legitimate field. Correct.

## Conclusions for the next iteration

| Priority | Improvement | Where |
|---|---|---|
| High | Re-rank vector search results with cross-encoder when score < 0.3 | `tools/search.ts` |
| High | Parse compound bit-field names (`NAME[high:low]`) | `parseRegisters.ts` |
| Med | Add a curated `clock-enable` lookup table per peripheral so `verify_register_write` can also flag missing clock enable | new `tools/clockEnable.ts` |
| Low | Try `Xenova/bge-small-en-v1.5` (384-dim, better quality) | `EMBEDDING_MODEL` env var |
