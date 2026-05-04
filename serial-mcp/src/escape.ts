/**
 * Convert escape sequences in a JSON-supplied string into the bytes the
 * caller actually means.
 *
 * Why this exists: when Claude (or any JSON client) sends `{"send": "ping\n"}`,
 * the runtime string contains the two characters '\\' and 'n', not the
 * single LF byte 0x0A. If we forward that to the UART, the MCU's line
 * reader never sees an end-of-line and the test hangs.
 *
 * We support the common subset that shows up in HIL test plans:
 *   \n  -> 0x0A   newline
 *   \r  -> 0x0D   carriage return
 *   \t  -> 0x09   tab
 *   \0  -> 0x00   null
 *   \\  -> 0x5C   backslash
 *   \xNN -> hex byte
 *
 * Anything else is left as-is (e.g. `\d` keeps `\d` so regex strings
 * survive intact when this helper is misapplied).
 */
export function unescapeWireString(input: string): string {
  return input.replace(/\\(x[0-9A-Fa-f]{2}|.)/g, (_, esc: string) => {
    if (esc === "n") return "\n";
    if (esc === "r") return "\r";
    if (esc === "t") return "\t";
    if (esc === "0") return "\0";
    if (esc === "\\") return "\\";
    if (esc.startsWith("x")) {
      return String.fromCharCode(parseInt(esc.slice(1), 16));
    }
    return "\\" + esc;
  });
}
