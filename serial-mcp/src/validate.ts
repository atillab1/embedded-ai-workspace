/**
 * Tiny runtime validator for tool arguments. Keeps zod out of the dep tree
 * for a server this small, but still rejects bad shapes early with clear
 * errors instead of letting `undefined` propagate into RegExp / SerialPort.
 *
 * Throws Error on first failure; the MCP CallTool handler turns that into
 * an isError response automatically.
 */

export type Spec =
  | { kind: "string"; minLen?: number; maxLen?: number }
  | { kind: "number"; min?: number; max?: number; integer?: boolean }
  | { kind: "regex" }; // string that must compile to a RegExp

export function validate<T>(args: unknown, schema: Record<string, Spec>): T {
  if (typeof args !== "object" || args === null) {
    throw new Error("tool arguments must be an object");
  }
  const a = args as Record<string, unknown>;
  for (const [key, spec] of Object.entries(schema)) {
    const v = a[key];
    if (spec.kind === "string" || spec.kind === "regex") {
      if (typeof v !== "string") {
        throw new Error(`argument "${key}" must be a string, got ${typeof v}`);
      }
      if (spec.kind === "string") {
        if (spec.minLen !== undefined && v.length < spec.minLen) {
          throw new Error(`argument "${key}" too short (min ${spec.minLen})`);
        }
        if (spec.maxLen !== undefined && v.length > spec.maxLen) {
          throw new Error(`argument "${key}" too long (max ${spec.maxLen})`);
        }
      } else {
        try { new RegExp(v); } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`argument "${key}" is not a valid regex: ${msg}`);
        }
      }
    } else if (spec.kind === "number") {
      if (typeof v !== "number" || !Number.isFinite(v)) {
        throw new Error(`argument "${key}" must be a finite number, got ${typeof v}`);
      }
      if (spec.integer && !Number.isInteger(v)) {
        throw new Error(`argument "${key}" must be an integer`);
      }
      if (spec.min !== undefined && v < spec.min) {
        throw new Error(`argument "${key}" below minimum ${spec.min}`);
      }
      if (spec.max !== undefined && v > spec.max) {
        throw new Error(`argument "${key}" above maximum ${spec.max}`);
      }
    }
  }
  return args as T;
}
