import { SerialPort } from "serialport";
import { unescapeWireString } from "../escape.js";

export interface QueryArgs {
  port: string;
  baud: number;
  send: string;
  expect: RegExp;
  timeoutMs: number;
}

export interface QueryResult {
  matched: boolean;
  raw: string;
  match?: string;
  elapsedMs: number;
  error?: string;
}

export function serialQuery(args: QueryArgs): Promise<QueryResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    let buffer = "";
    let port: SerialPort | null = null;
    let settled = false;

    const finish = (result: Omit<QueryResult, "elapsedMs">) => {
      // Guard against double-resolve: timeout firing concurrently with a
      // late "data" or "error" event, or close() emitting after we've
      // already settled. The first call wins.
      if (settled) return;
      settled = true;
      const elapsedMs = Date.now() - start;
      // Stop further events from re-entering finish via close()'s callback.
      port?.removeAllListeners("data");
      port?.removeAllListeners("error");
      if (port?.isOpen) {
        port.close(() => resolve({ ...result, elapsedMs }));
      } else {
        resolve({ ...result, elapsedMs });
      }
    };

    try {
      port = new SerialPort({ path: args.port, baudRate: args.baud, autoOpen: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return resolve({ matched: false, raw: "", elapsedMs: 0, error: `Failed to construct port: ${msg}` });
    }

    const timer = setTimeout(() => {
      finish({ matched: false, raw: buffer, error: "timeout" });
    }, args.timeoutMs);

    port.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const m = buffer.match(args.expect);
      if (m) {
        clearTimeout(timer);
        finish({ matched: true, raw: buffer, match: m[0] });
      }
    });

    port.on("error", (err) => {
      clearTimeout(timer);
      finish({ matched: false, raw: buffer, error: err.message });
    });

    port.open((openErr) => {
      if (openErr) {
        clearTimeout(timer);
        return finish({ matched: false, raw: "", error: `open: ${openErr.message}` });
      }
      // JSON delivers "\\n" as two chars (backslash + n). Convert escape
      // sequences to real bytes before writing to the UART, otherwise the
      // MCU never sees an end-of-line.
      const payload = unescapeWireString(args.send);
      port!.write(payload, (writeErr) => {
        if (writeErr) {
          clearTimeout(timer);
          finish({ matched: false, raw: buffer, error: `write: ${writeErr.message}` });
        }
      });
    });
  });
}

export function formatQueryResult(r: QueryResult): string {
  let out = `[${r.matched ? "MATCHED" : "NO-MATCH"}]  elapsed=${r.elapsedMs}ms\n`;
  if (r.error) out += `error: ${r.error}\n`;
  if (r.match) out += `match: ${JSON.stringify(r.match)}\n`;
  out += `raw (${r.raw.length} bytes):\n${r.raw}`;
  return out;
}
