# firmware-test

Tiny STM32F407 test firmware that responds to a UART command set used by
`hil-runner`. Designed to be generated through STM32CubeIDE (CubeMX), then
the user pastes in the files from `Core/Src/` and `Core/Inc/`.

## Hardware

- Board: **STM32F4-DISCOVERY** (STM32F407VGT6)
- LED: **PD13** (LED4 orange)
- UART: **USART2** on PA2 (TX) / PA3 (RX), 115200 8N1

USART2 is chosen because the F4-DISCO's onboard ST-Link does **not** forward
a virtual COM port to the target. Wire an external USB-UART adapter:

```
  USB-UART adapter        STM32F4-DISCOVERY
  -----------------       -----------------
       GND  ───────────── GND
       RX   ───────────── PA2 (USART2 TX)
       TX   ───────────── PA3 (USART2 RX)
```

## Command set (what hil-runner expects)

| Command (TX from PC) | Response (RX from MCU) | Effect |
|---|---|---|
| (after reset)        | `FW 0.1 ready\n`        | boot banner |
| `ping\n`             | `pong\n`                | liveness |
| `led on\n`           | `OK\n`                  | PD13 high |
| `led off\n`          | `OK\n`                  | PD13 low  |
| `version\n`          | `FW 0.1\n`              | firmware version |
| (anything else)      | `ERR unknown\n`         | unknown command |

## Build

In CubeMX:

1. New Project → STM32F407VGTx
2. Pinout: PA2/PA3 → USART2 Async, PD13 → GPIO_Output
3. Clock: HSI 16 MHz (default is fine)
4. USART2: 115200 baud, 8 bits, no parity, 1 stop bit
5. Generate code (Toolchain: STM32CubeIDE Makefile)
6. Replace `Core/Src/main.c` with the file in this directory
7. Build (`make` or via CubeIDE)
8. The output `.bin` lands at `build/firmware-test.bin`

## Flash for HIL test

```bash
st-flash --reset write build/firmware-test.bin 0x08000000
```

Then point hil-runner at it:

```bash
# First time only: copy the example plan and edit the binary path / port for your machine
cp tests/plan.example.json tests/plan.json
# Then run:
cd ../hil-runner
npx tsx src/index.ts ../firmware-test/tests/plan.json
```

`plan.json` is gitignored because the binary path is machine-specific.
`plan.example.json` is the template that ships with the repo.
