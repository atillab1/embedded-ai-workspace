/**
 * Tiny runtime validator for tool arguments. Same shape as serial-mcp's
 * helper — kept duplicated so each MCP package has zero cross-deps.
 */

export type Spec =
  | { kind: "string"; minLen?: number; maxLen?: number }
  | { kind: "number"; min?: number; max?: number; integer?: boolean };

export function validate<T>(args: unknown, schema: Record<string, Spec>): T {
  if (typeof args !== "object" || args === null) {
    throw new Error("tool arguments must be an object");
  }
  const a = args as Record<string, unknown>;
  for (const [key, spec] of Object.entries(schema)) {
    const v = a[key];
    if (spec.kind === "string") {
      if (typeof v !== "string") {
        throw new Error(`argument "${key}" must be a string, got ${typeof v}`);
      }
      if (spec.minLen !== undefined && v.length < spec.minLen) {
        throw new Error(`argument "${key}" too short (min ${spec.minLen})`);
      }
      if (spec.maxLen !== undefined && v.length > spec.maxLen) {
        throw new Error(`argument "${key}" too long (max ${spec.maxLen})`);
      }
    } else {
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
