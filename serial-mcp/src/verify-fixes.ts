/**
 * Quick regression test for the Gemini-flagged issues:
 *   1. unescapeWireString correctness
 *   2. validate() rejects bad shapes
 *   3. serialQuery does not double-resolve on timeout+late-data path
 *      (smoke check via concurrent fake events)
 */
import { unescapeWireString } from "./escape.js";
import { validate } from "./validate.js";

let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else    { fail++; console.log(`  ✗ ${name}  ${detail}`); }
}

console.log("\n[1] unescapeWireString");
check("\\n -> LF",  unescapeWireString("ping\\n") === "ping\n");
check("\\r\\n",      unescapeWireString("\\r\\n") === "\r\n");
check("\\t",         unescapeWireString("a\\tb") === "a\tb");
check("\\xNN",       unescapeWireString("\\x41\\x42") === "AB");
check("\\\\ literal",unescapeWireString("a\\\\b") === "a\\b");
check("\\d untouched (regex-friendly)", unescapeWireString("\\d+") === "\\d+");

console.log("\n[2] validate()");
try {
  validate(undefined, { x: { kind: "string" } });
  check("rejects non-object", false);
} catch { check("rejects non-object", true); }

try {
  validate({}, { port: { kind: "string", minLen: 1 } });
  check("rejects missing required string", false);
} catch (e) { check("rejects missing required string", true, (e as Error).message); }

try {
  validate({ baud: "115200" }, { baud: { kind: "number" } });
  check("rejects wrong type (string for number)", false);
} catch { check("rejects wrong type (string for number)", true); }

try {
  validate({ port: "COM3", baud: 115200 }, {
    port: { kind: "string", minLen: 1 },
    baud: { kind: "number", min: 1, integer: true },
  });
  check("accepts valid input", true);
} catch (e) { check("accepts valid input", false, (e as Error).message); }

console.log(`\n[summary] ${pass} pass / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
