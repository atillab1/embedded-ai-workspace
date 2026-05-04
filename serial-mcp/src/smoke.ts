/**
 * Smoke test — does not require a connected board. Lists ports and
 * exercises the timeout path of serial_query against a non-existent port.
 */
import { listPorts, formatPorts } from "./tools/listPorts.js";
import { serialQuery, formatQueryResult } from "./tools/serialQuery.js";

async function main() {
  console.log("=== list_ports ===");
  const ports = await listPorts();
  console.log(formatPorts(ports));

  console.log("\n=== serial_query (expected error / timeout) ===");
  const r = await serialQuery({
    port: ports[0]?.path ?? "COM999",
    baud: 115200,
    send: "ping\n",
    expect: /pong/,
    timeoutMs: 500,
  });
  console.log(formatQueryResult(r));
}

main().catch((err) => { console.error(err); process.exit(1); });
