/**
 * Datasheet MCP server entry point.
 *
 * Tools (depending on config.enableRegisterTools):
 *   - search_datasheet            (always)
 *   - get_register_info           (when register tools enabled)
 *   - verify_register_write       (when register tools enabled)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { searchDatasheet, formatSearchHits } from "./tools/search.js";
import { getRegisterInfo, formatRegisterInfo } from "./tools/register.js";
import { verifyRegisterWrite, formatVerifyResult } from "./tools/verify.js";
import { config } from "./config.js";
import { validate } from "./validate.js";

const server = new Server(
  { name: "datasheet-mcp", version: "0.3.0" },
  { capabilities: { tools: {} } }
);

interface ToolDef {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

const tools: ToolDef[] = [
  {
    name: "search_datasheet",
    description:
      `Search the ${config.datasheetName} for relevant sections. ` +
      `Topic coverage: ${config.datasheetDescription} ` +
      `Returns the most relevant passages with page numbers. Use whenever the user asks ` +
      `about a topic that is likely covered by this document.`,
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural-language query." },
        k: { type: "number", description: "Number of results (default 5, max 10)." },
      },
      required: ["query"],
    },
  },
];

if (config.enableRegisterTools) {
  tools.push(
    {
      name: "get_register_info",
      description:
        `Look up structured information about a specific ${config.datasheetShortName} register: ` +
        `address offset, reset value, and bit fields. Use when the user asks about a register ` +
        `by name. Falls back to a search hint when not in the curated index.`,
      inputSchema: {
        type: "object",
        properties: {
          peripheral: { type: "string", description: "Peripheral group, e.g. GPIO, USART." },
          register: { type: "string", description: "Register name without prefix, e.g. MODER, CR1." },
        },
        required: ["peripheral", "register"],
      },
    },
    {
      name: "verify_register_write",
      description:
        `Inspect ${config.datasheetShortName} C code for suspicious register writes: reserved-bit ` +
        `writes, full-word assignments, magic numbers, uncommented symbolic values. Returns warnings.`,
      inputSchema: {
        type: "object",
        properties: {
          c_code: { type: "string", description: "The C source snippet to inspect." },
        },
        required: ["c_code"],
      },
    }
  );
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    if (name === "search_datasheet") {
      const a = validate<{ query: string }>(args, {
        query: { kind: "string", minLen: 1, maxLen: 500 },
      });
      const rawK = (args as { k?: unknown }).k;
      const kCandidate = typeof rawK === "number" && Number.isFinite(rawK) ? rawK : 5;
      const k = Math.min(Math.max(kCandidate, 1), 10);
      const hits = await searchDatasheet(a.query, k);
      return { content: [{ type: "text", text: formatSearchHits(hits) }] };
    }

    if (name === "get_register_info" && config.enableRegisterTools) {
      const a = validate<{ peripheral: string; register: string }>(args, {
        peripheral: { kind: "string", minLen: 1, maxLen: 32 },
        register: { kind: "string", minLen: 1, maxLen: 32 },
      });
      const info = await getRegisterInfo(a.peripheral, a.register);
      return { content: [{ type: "text", text: formatRegisterInfo(info) }] };
    }

    if (name === "verify_register_write" && config.enableRegisterTools) {
      const a = validate<{ c_code: string }>(args, {
        c_code: { kind: "string", minLen: 1, maxLen: 50_000 },
      });
      const result = await verifyRegisterWrite(a.c_code);
      return { content: [{ type: "text", text: formatVerifyResult(result) }] };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `Tool error: ${msg}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`datasheet-mcp v0.3.0 running on stdio (${config.datasheetShortName})`);
