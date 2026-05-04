/**
 * Same as serial-mcp's unescape helper, duplicated so hil-runner has zero
 * cross-package deps. Keep both copies in sync.
 */
export function unescapeWireString(input: string): string {
  return input.replace(/\\(x[0-9A-Fa-f]{2}|.)/g, (_, esc: string) => {
    if (esc === "n") return "\n";
    if (esc === "r") return "\r";
    if (esc === "t") return "\t";
    if (esc === "0") return "\0";
    if (esc === "\\") return "\\";
    if (esc.startsWith("x")) return String.fromCharCode(parseInt(esc.slice(1), 16));
    return "\\" + esc;
  });
}
