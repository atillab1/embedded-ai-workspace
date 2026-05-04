/**
 * hil-runner: hardware-in-the-loop test runner.
 *
 * Pipeline:
 *   1. flash binary to STM32 via st-flash (or openocd, configurable)
 *   2. open UART serial port
 *   3. for each test case: send command, wait for expected response or timeout
 *   4. emit JUnit XML + console summary, exit non-zero on any failure
 *
 * Designed to run on a self-hosted GitHub Actions runner with the board
 * physically attached, but also works on the developer's laptop.
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { SerialPort } from "serialport";
import { unescapeWireString } from "./escape.js";

interface TestCase {
  name: string;
  send: string;       // string to write to UART (raw, include \n if needed)
  expect: string;     // regex
  timeoutMs?: number;
  delayAfterMs?: number; // pause after this case (useful for visual demos / LEDs)
}

interface TestPlan {
  binary: string;             // absolute path to .bin or .elf
  flasher: "st-flash" | "openocd";
  flashLoadAddress?: string;  // st-flash needs this for .bin (default 0x08000000)
  port: string;               // COM3, /dev/ttyUSB0, etc.
  baud: number;
  resetDelayMs?: number;
  cases: TestCase[];
}

interface CaseResult {
  name: string;
  pass: boolean;
  elapsedMs: number;
  raw: string;
  error?: string;
}

function log(msg: string): void {
  console.log(`[hil] ${msg}`);
}

function runCmd(cmd: string, args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((resolveP) => {
    log(`exec: ${cmd} ${args.join(" ")}`);
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => { out += d.toString(); process.stdout.write(d); });
    child.stderr.on("data", (d) => { out += d.toString(); process.stderr.write(d); });
    child.on("error", (err) => {
      out += `\n[spawn error] ${err.message}\n`;
      resolveP({ code: 127, out });
    });
    child.on("close", (code) => resolveP({ code: code ?? -1, out }));
  });
}

async function listAvailablePorts(): Promise<string> {
  try {
    const ports = await SerialPort.list();
    if (ports.length === 0) return "  (no serial ports detected)";
    return ports
      .map((p) => `  ${p.path.padEnd(8)} ${p.manufacturer ?? ""} ${p.pnpId ?? ""}`.trimEnd())
      .join("\n");
  } catch (e) {
    return `  (could not enumerate ports: ${(e as Error).message})`;
  }
}

async function flash(plan: TestPlan): Promise<void> {
  if (!existsSync(plan.binary)) {
    throw new Error(
      `binary not found: ${plan.binary}\n` +
      `Hint: build your firmware first. In STM32CubeIDE, the .bin lives in <project>/Debug/<project>.bin\n` +
      `      and you must enable Project Properties -> C/C++ Build -> Settings -> MCU Post build steps:\n` +
      `      "Convert to binary file (-O binary)". Update plan.json "binary" path to match.`
    );
  }
  if (plan.flasher === "st-flash") {
    const addr = plan.flashLoadAddress ?? "0x08000000";
    const isBin = plan.binary.endsWith(".bin");
    if (!isBin) {
      throw new Error("st-flash mode expects a .bin file. Convert .elf with arm-none-eabi-objcopy -O binary.");
    }
    const r = await runCmd("st-flash", ["--reset", "write", plan.binary, addr]);
    if (r.code === 127) {
      throw new Error(
        `st-flash not found on PATH.\n` +
        `Hint: download stlink for your OS from https://github.com/stlink-org/stlink/releases\n` +
        `      and add the bin/ directory to PATH. On Windows the v1.7.0 mingw32 build is the\n` +
        `      most reliable (the v1.8.0 win32 build is missing a libusb DLL).\n` +
        `      You also need the ST-Link USB driver from st.com (one-time, OS-level).`
      );
    }
    if (r.code !== 0) throw new Error(`st-flash exited with ${r.code}`);
  } else {
    const r = await runCmd("openocd", [
      "-f", "interface/stlink.cfg",
      "-f", "target/stm32f4x.cfg",
      "-c", `program ${plan.binary} verify reset exit`,
    ]);
    if (r.code === 127) {
      throw new Error("openocd not found on PATH. Install OpenOCD and add it to PATH.");
    }
    if (r.code !== 0) throw new Error(`openocd exited with ${r.code}`);
  }
}

function runCase(plan: TestPlan, c: TestCase): Promise<CaseResult> {
  return new Promise((resolveP) => {
    const start = Date.now();
    let buffer = "";
    let settled = false;
    const timeoutMs = c.timeoutMs ?? 2000;
    const expect = new RegExp(c.expect);

    const port = new SerialPort({ path: plan.port, baudRate: plan.baud, autoOpen: false });

    const finish = (pass: boolean, error?: string) => {
      // First call wins; subsequent timeout/data/error events are ignored.
      if (settled) return;
      settled = true;
      const elapsedMs = Date.now() - start;
      port.removeAllListeners("data");
      port.removeAllListeners("error");
      if (port.isOpen) {
        port.close(() => resolveP({ name: c.name, pass, elapsedMs, raw: buffer, error }));
      } else {
        resolveP({ name: c.name, pass, elapsedMs, raw: buffer, error });
      }
    };

    const timer = setTimeout(() => finish(false, "timeout"), timeoutMs);

    port.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      if (expect.test(buffer)) {
        clearTimeout(timer);
        finish(true);
      }
    });
    port.on("error", (err) => { clearTimeout(timer); finish(false, err.message); });

    port.open((err) => {
      if (err) { clearTimeout(timer); return finish(false, `open: ${err.message}`); }
      // Test plans are JSON, so "\\n" arrives as two chars. Decode to real
      // bytes (LF, CR, etc.) before writing to the UART.
      port.write(unescapeWireString(c.send), (werr) => {
        if (werr) { clearTimeout(timer); finish(false, `write: ${werr.message}`); }
      });
    });
  });
}

function junit(results: CaseResult[]): string {
  const total = results.length;
  const failed = results.filter((r) => !r.pass).length;
  const cases = results
    .map((r) => {
      const time = (r.elapsedMs / 1000).toFixed(3);
      const escapedRaw = r.raw.replace(/[<&]/g, (c) => (c === "<" ? "&lt;" : "&amp;"));
      const failure = r.pass
        ? ""
        : `<failure message="${(r.error ?? "fail").replace(/"/g, "&quot;")}"><![CDATA[${escapedRaw}]]></failure>`;
      return `    <testcase name="${r.name}" time="${time}">${failure}</testcase>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="hil" tests="${total}" failures="${failed}">
${cases}
</testsuite>
`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`hil-runner: hardware-in-the-loop test runner for STM32 boards.

Usage:
  npx tsx src/index.ts <plan.json>     run the HIL pipeline (flash + serial tests)
  npx tsx src/index.ts --list-ports    enumerate serial ports on this machine
  npx tsx src/index.ts --self-test     internal smoke test, no hardware needed
  npx tsx src/index.ts --help          show this message

plan.json fields:
  binary            absolute path to .bin (built by your IDE)
  flasher           "st-flash" or "openocd"
  flashLoadAddress  e.g. "0x08000000" for STM32F4
  port              COM3 / /dev/ttyUSB0 — find via --list-ports or Device Manager
  baud              UART speed (must match firmware), typical 115200
  resetDelayMs      pause after flash before opening serial
  cases[]           name, send, expect (regex), timeoutMs, optional delayAfterMs
`);
    process.exit(0);
  }

  if (args.includes("--list-ports")) {
    log("available serial ports:");
    console.log(await listAvailablePorts());
    process.exit(0);
  }

  if (args.includes("--self-test")) {
    log("self-test: skipping flash, exercising serial path against non-existent port.");
    const fakePlan: TestPlan = {
      binary: "",
      flasher: "st-flash",
      port: "COM999",
      baud: 115200,
      cases: [{ name: "ping", send: "ping\n", expect: "pong", timeoutMs: 200 }],
    };
    const r = await runCase(fakePlan, fakePlan.cases[0]);
    log(`self-test result: ${r.pass ? "PASS" : "FAIL"} (${r.error ?? "no error"})`);
    process.exit(r.pass ? 1 : 0); // we expect this to fail; self-test passes when failure is reported
  }

  const planPath = args[0] ?? resolve(process.cwd(), "tests/plan.json");
  if (!existsSync(planPath)) {
    console.error(`Test plan not found: ${planPath}`);
    process.exit(2);
  }

  let plan: TestPlan;
  try {
    plan = JSON.parse(await readFile(planPath, "utf8")) as TestPlan;
  } catch (e) {
    console.error(`[hil] ERROR: failed to parse ${planPath}: ${(e as Error).message}`);
    console.error(`[hil] Hint: a common cause is trailing commas, missing quotes, or an unescaped backslash.`);
    process.exit(2);
  }
  if (!plan.cases || !Array.isArray(plan.cases)) {
    console.error(`[hil] ERROR: plan.json is missing a "cases" array.`);
    process.exit(2);
  }
  if (!plan.port || !plan.binary) {
    console.error(`[hil] ERROR: plan.json must define both "port" and "binary".`);
    process.exit(2);
  }
  log(`loaded plan with ${plan.cases.length} case(s)`);

  // Preflight: confirm the configured COM/tty actually exists. Catches the
  // most common first-time-setup mistake (wrong COM number in plan.json)
  // before we waste time flashing.
  try {
    const ports = await SerialPort.list();
    const found = ports.find((p) => p.path.toLowerCase() === plan.port.toLowerCase());
    if (!found) {
      console.error(`[hil] ERROR: configured port "${plan.port}" not found.`);
      console.error("[hil] Available ports:");
      console.error(await listAvailablePorts());
      console.error(`[hil] Hint: update plan.json "port" field, or run with --list-ports.`);
      console.error(`[hil]       On Windows, check Device Manager -> Ports (COM & LPT).`);
      console.error(`[hil]       If the board doesn't appear, install the ST-Link USB driver.`);
      process.exit(2);
    }
  } catch (e) {
    log(`warning: could not enumerate ports for preflight (${(e as Error).message}); continuing anyway`);
  }

  log("flashing...");
  await flash(plan);

  if (plan.resetDelayMs) {
    log(`waiting ${plan.resetDelayMs}ms after reset`);
    await new Promise((r) => setTimeout(r, plan.resetDelayMs));
  }

  const results: CaseResult[] = [];
  for (const c of plan.cases) {
    log(`run case: ${c.name}`);
    const r = await runCase(plan, c);
    log(`  -> ${r.pass ? "PASS" : "FAIL"}  ${r.elapsedMs}ms  ${r.error ?? ""}`);
    results.push(r);
    if (c.delayAfterMs && c.delayAfterMs > 0) {
      log(`  (pausing ${c.delayAfterMs}ms before next case)`);
      await new Promise((r) => setTimeout(r, c.delayAfterMs));
    }
  }

  const xml = junit(results);
  await writeFile("hil-results.xml", xml);
  log("wrote hil-results.xml");

  const failed = results.filter((r) => !r.pass).length;
  log(`\nSummary: ${results.length - failed}/${results.length} passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("hil-runner fatal:", err);
  process.exit(2);
});
