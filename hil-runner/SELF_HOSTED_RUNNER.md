# Self-hosted GitHub Actions runner — setup guide

The HIL job in `.github/workflows/hil.yml` targets a runner with labels
`self-hosted` and `stm32f4-disco`. This guide is the recipe for setting
that up on the laptop where the board lives.

## Prerequisites on the host

| Requirement | Why |
|---|---|
| Windows 10/11 or Ubuntu 22.04+ | Works on either |
| Node.js 20+ | hil-runner |
| ARM GCC toolchain (`gcc-arm-none-eabi`) | firmware build |
| `st-flash` from [stlink-tools](https://github.com/stlink-org/stlink) | flashing |
| ST-Link USB driver (Windows) | board enumeration |
| User has access to the COM/tty device | port open without sudo |
| The STM32F4-DISCOVERY board permanently plugged in | obviously |

## Step 1 — Install the runner

In your GitHub repo: **Settings → Actions → Runners → New self-hosted runner**.

Follow GitHub's instructions to download and configure the runner agent.
When prompted for labels, add `stm32f4-disco` so this workflow targets it.

## Step 2 — Install host tools

### Windows

```powershell
# ARM GCC
winget install ArmGNU.GnuToolchainArmEmbeddedAarch32

# stlink (st-flash)
winget install stlink-org.stlink

# ST-Link USB driver — install from
# https://www.st.com/en/development-tools/stsw-link009.html
```

Verify:

```powershell
arm-none-eabi-gcc --version
st-flash --version
```

### Ubuntu

```bash
sudo apt-get update
sudo apt-get install -y gcc-arm-none-eabi make stlink-tools nodejs npm
sudo usermod -aG dialout $USER
# log out / back in for group change
```

## Step 3 — Confirm board connectivity

```bash
st-info --probe       # should show: VID/PID 0483:374B, F4 family
```

## Step 4 — Run the workflow

Push to `main` (or trigger via **Actions → HIL pipeline → Run workflow**).
The `lint` job runs on a hosted ubuntu-latest runner; the `hil` job runs
on your self-hosted runner.

## Step 5 — Watch the lights

If everything is wired:

- The board's red LED should blink during `st-flash --reset write`.
- During UART tests, LED4 (orange, PD13) toggles for the `led on/off` cases.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `st-flash: command not found` on runner | PATH not exported in the agent's environment | Add to runner's `.env` file or `actions-runner/run.sh` |
| `Opening COM7: Access denied` on Windows | Another app (PuTTY, CubeIDE) has the port open | Close it |
| `Opening /dev/ttyUSB0: Permission denied` | User not in dialout group | `sudo usermod -aG dialout $USER` |
| `boot_banner` test times out | Wrong port in `tests/plan.json` or wrong baud | Re-check, also confirm USART2 (PA2/PA3) wiring |
| `unknown_err` test passes locally but fails in CI | The firmware revision differs | Add `make clean` to the build step |

## Cost / energy notes

A self-hosted runner is "always on" — keep that in mind. Options:

- Run the agent on demand with the GitHub Actions runner CLI in
  ephemeral mode (`--ephemeral`), so each job spawns + dies.
- Add a USB-controlled relay so the workflow can power-cycle the
  board between runs (avoids "stuck firmware" between tests).
- For team setups, mount the laptop in a closet with reliable
  power and network; treat it as a tiny lab box.
