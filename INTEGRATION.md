# MISRA Skill + Datasheet MCP — Integration recipe

End-to-end demo: Claude reviews the same C snippet through both layers
in a single turn, then you flash the corrected version to the board.

## Prerequisites

- MISRA Skill installed at `~/.claude/skills/misra-c-reviewer/`
- Datasheet MCP wired up via `.mcp.json` (see datasheet-mcp/README.md)
- STM32CubeIDE installed
- STM32F4-DISCOVERY board connected (ST-Link visible in Device Manager)

## Step-by-step

### 1. Open the buggy fixture

```
datasheet-mcp/examples/led-init-buggy.c
```

### 2. In Claude Code, run a combined review

Type:

```
Review datasheet-mcp/examples/led-init-buggy.c for MISRA-C compliance
AND verify the register writes against the STM32F407 datasheet. Use
both the misra-c-reviewer skill and the datasheet MCP tools.
```

### 3. Expected output

Claude should produce a single combined review listing:

| Layer | Finding |
|---|---|
| MISRA Skill | Rule 9.1 — `int dummy` unused |
| MISRA Skill | Rule 10.4 — signed/unsigned mix on `led_pin` |
| MISRA Skill | Rule 21.3 — `malloc` in init path |
| Datasheet MCP | `GPIOD->MODER = 0x55555555;` direct-assignment, clobbers all pins |
| Datasheet MCP | `RCC->AHB1ENR = 0x00000008;` direct-assignment, disables every other peripheral |
| Datasheet MCP | `GPIOD->BSRR = (1U << led_pin);` — no warning, correct usage |

### 4. Apply the fix

Replace the file content with `examples/led-init-clean.c`. Re-run the
review — it should come back clean.

### 5. Flash to the board

In STM32CubeIDE:

1. Create a new STM32 Project for STM32F407VGTx.
2. In CubeMX, leave defaults; ensure HSI clock for simplicity.
3. Replace generated `main.c`'s `MX_GPIO_Init` with the body of
   `led-init-clean.c` (renamed) and add `for(;;) { /* idle */ }` loop.
4. Build (`Ctrl+B`).
5. Flash via the green Run button (uses ST-Link).
6. **LED4 (orange, near PD13) should light steadily.**

### 6. Capture demo

For LinkedIn / GitHub README, capture:

- Screenshot of Claude's combined review
- Photo or video of the lit LED on the board

That's the Faz 2 deliverable demo.

## Troubleshooting

| Problem | Fix |
|---|---|
| Claude only invokes one of the two systems | Mention both explicitly: "use BOTH the MISRA skill AND the datasheet MCP tools" |
| Datasheet MCP not connected | Restart Claude Code; check `.mcp.json` path is absolute |
| LED doesn't light | Check that GPIOD clock enable was applied; `RCC->AHB1ENR` bit 3 must be set |
| Build errors on `RCC`/`GPIOD` symbols | Ensure `#include "stm32f4xx.h"` and that CubeMX generated the headers |
