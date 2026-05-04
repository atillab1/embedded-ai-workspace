# hil-runner

Hardware-in-the-loop test runner for STM32 boards. Reads a JSON test plan,
flashes a firmware binary to the MCU, drives a UART, asserts on responses,
emits a JUnit XML report. Designed for both local development and CI on a
self-hosted runner with the board physically attached.

```
plan.json ──▶ flash (st-flash) ──▶ open serial ──▶ for each case:
                                                     send → expect regex → PASS/FAIL
                                                  ──▶ hil-results.xml
```

## What this is and isn't

**Is:** a thin orchestrator that turns "build artifact + plan" into a
pass/fail report. Zero-magic regex matching against UART output.

**Isn't:** a debugger, an SWD/JTAG inspector, or a flash protection tool.
For that use OpenOCD or pyOCD directly.

## First-time setup (Windows)

This is the part that bites everyone the first time. Three things have to
be in place before `hil-runner` can do anything useful:

### 1. ST-Link USB driver (one-time, OS-level)

Plug the board in. Open Device Manager. If you see **STMicroelectronics
STLink Virtual COM Port** under *Ports (COM & LPT)*, you're done.
If you see an unknown device with a yellow ! mark, install the driver from
[ST's website](https://www.st.com/en/development-tools/stsw-link009.html).

### 2. `st-flash` on PATH

Download the `stlink` binaries from the
[stlink-org releases page](https://github.com/stlink-org/stlink/releases).

> **Windows note:** the **v1.7.0** `x86_64-w64-mingw32` build is the most
> reliable. The v1.8.0 `win32` build is missing the libusb DLL and
> exits with `STATUS_DLL_NOT_FOUND` (0xC0000135).

Extract somewhere stable (e.g. `C:\Tools\stlink\`) and add the `bin/`
directory to your User PATH. Verify:

```powershell
st-flash --version
# v1.7.0
st-info --probe
# Found 1 stlink programmers ... chipid: 0x0413 (F4xx)
```

The `libusb: warning [set_composite_interface] ...` lines are harmless —
that's libusb scanning unrelated HID devices (Bluetooth, etc).

### 3. Find your COM port

```bash
npx tsx src/index.ts --list-ports
```

Example output:

```
[hil] available serial ports:
  COM5     wch.cn      USB\VID_1A86&PID_7523\...
  COM7     STMicro...  USB\VID_0483&PID_374B\...
```

The ST-Link's built-in virtual COM port is the `STMicroelectronics`
entry. If your board exposes UART through a separate USB-UART bridge
(CH340, FTDI, CP210x), it'll show up under its own manufacturer.

Update `plan.json` `"port"` to match.

## Linux / macOS

```bash
# Linux (Ubuntu/Debian)
sudo apt install stlink-tools
sudo usermod -a -G dialout $USER  # log out + back in

# macOS
brew install stlink
```

Serial paths look like `/dev/ttyUSB0` or `/dev/cu.usbmodem-XXXX`.

## Quick start

```bash
npm install
npx tsx src/index.ts ../firmware-test/tests/plan.json
```

Or run the self-test (no board required, exits 0 when serial path errors
correctly):

```bash
npm run self-test
```

## CLI

| Command | Effect |
|---|---|
| `npx tsx src/index.ts <plan.json>` | Run the HIL pipeline |
| `npx tsx src/index.ts --list-ports` | Enumerate serial ports |
| `npx tsx src/index.ts --self-test` | Internal smoke test |
| `npx tsx src/index.ts --help` | Show usage |

## Test plan format

```json
{
  "binary": "C:/path/to/firmware.bin",
  "flasher": "st-flash",
  "flashLoadAddress": "0x08000000",
  "port": "COM5",
  "baud": 115200,
  "resetDelayMs": 500,
  "cases": [
    { "name": "ping",   "send": "ping\n",   "expect": "pong",  "timeoutMs": 1000 },
    { "name": "led_on", "send": "led on\n", "expect": "OK",    "timeoutMs": 1000, "delayAfterMs": 4000 }
  ]
}
```

| Field | Required | Meaning |
|---|---|---|
| `binary` | yes | Absolute path to `.bin` (st-flash) or `.elf` (openocd) |
| `flasher` | yes | `"st-flash"` or `"openocd"` |
| `flashLoadAddress` | st-flash only | Default `0x08000000` for STM32 |
| `port` | yes | `COM5`, `/dev/ttyUSB0`, `/dev/cu.usbmodem-…` |
| `baud` | yes | Must match firmware UART config |
| `resetDelayMs` | no | Pause after flash-reset before first serial read |
| `cases[].send` | yes | String written to UART. Supports `\n`, `\r`, `\t`, `\xHH` |
| `cases[].expect` | yes | JavaScript regex matched against accumulated UART buffer |
| `cases[].timeoutMs` | no | Default 2000 ms |
| `cases[].delayAfterMs` | no | Pause before the next case (useful for visible LED demos) |

### Where do I get the .bin?

It's the build output of your firmware, not something hil-runner produces.

| Toolchain | Path pattern |
|---|---|
| STM32CubeIDE | `<workspace>/<project>/Debug/<project>.bin` |
| PlatformIO | `.pio/build/<env>/firmware.bin` |
| Make / CMake | `build/<project>.bin` |

In CubeIDE you must explicitly enable .bin generation:
*Project Properties → C/C++ Build → Settings → MCU Post build steps →
"Convert to binary file (-O binary)"*. Otherwise only `.elf` is produced.

## Output

- **Console:** per-case `PASS` / `FAIL` with elapsed time and timeout reason
- **File:** `hil-results.xml` (JUnit format) — ingested directly by GitHub
  Actions, GitLab CI, Jenkins
- **Exit code:** `0` all green, `1` any case failed, `2` infrastructure
  error (binary not found, port not found, plan malformed, st-flash
  missing, etc.)

## Troubleshooting

**`COM5 not found`**: run `--list-ports`, update `plan.json`. On Windows
also verify in Device Manager that the port appears.

**`st-flash not found on PATH`**: reinstall stlink and re-add the `bin/`
directory to PATH; open a fresh shell.

**`STATUS_DLL_NOT_FOUND` on Windows**: you grabbed the v1.8.0 `win32`
build. Use v1.7.0 `x86_64-w64-mingw32` instead.

**`binary not found`**: rebuild your firmware and double-check the path.
In CubeIDE confirm the `-O binary` post-build step is enabled.

**Boot banner test times out but everything else passes**: the runner
opens the serial port *after* `st-flash --reset`, so any output the
firmware prints in the first ~500 ms is lost. Drop the boot test or
have the firmware re-emit on a periodic timer.

**LED case PASS but no LED**: the firmware acknowledged the command
correctly, but you may be looking at the wrong LED. On STM32F4-DISCOVERY
PD12 = green, **PD13 = orange**, PD14 = red, PD15 = blue.

**Test passes too fast to film**: add `"delayAfterMs": 4000` to the case.

## CI

See [`.github/workflows/hil.yml`](../.github/workflows/hil.yml) for the
self-hosted GitHub Actions integration.
Runner setup: [`SELF_HOSTED_RUNNER.md`](./SELF_HOSTED_RUNNER.md).

## Related

- [`serial-mcp/`](../serial-mcp/) — MCP server for interactive serial
  debugging from a Claude session.
- [`firmware-test/`](../firmware-test/) — the demo firmware exercised by
  the default plan.
- [`datasheet-mcp/`](../datasheet-mcp/) — register-aware code review,
  consumed alongside this runner during development.
