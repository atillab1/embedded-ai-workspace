/**
 * serial-mcp: MCP server that exposes UART/serial ports to Claude.
 *
 * Tools:
 *   - list_ports                       — enumerate available serial devices
 *   - serial_query(port, baud, send,
 *                  expect, timeoutMs)  — open port, write `send`, read until
 *                                        `expect` regex matches OR timeout
 *
 * Designed for hardware-in-the-loop tests: send a command, expect a
 * response, return the captured text. Single-shot — port is opened
 * and closed for each query so concurrent test runs don't share state.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { listPorts, formatPorts } from "./tools/listPorts.js";
import { serialQuery, formatQueryResult } from "./tools/serialQuery.js";
import { validate } from "./validate.js";

const server = new Server(
  { name: "serial-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_ports",
      description:
        "List all serial/UART ports currently visible to the host. Returns device path (Windows: COM3 etc.; Unix: /dev/ttyUSB0 etc.), manufacturer, and product ID. Use before serial_query when the user has not specified a port.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "serial_query",
      description:
        "Open a serial port, write a string, and read until either a regex pattern is matched or a timeout elapses. Closes the port afterwards. Use this to send commands to an MCU running a test firmware and capture its response.",
      inputSchema: {
        type: "object",
        properties: {
          port: { type: "string", description: "Port path, e.g. 'COM3' or '/dev/ttyUSB0'." },
          baud: { type: "number", description: "Baud rate, e.g. 115200." },
          send: { type: "string", description: "Data to write. Backslash escapes are decoded server-side: \\n -> LF, \\r -> CR, \\t -> tab, \\xNN -> hex byte. To send a literal backslash use \\\\." },
          expect: { type: "string", description: "Regex pattern to wait for in the response. Use '.+' to read whatever comes." },
          timeoutMs: { type: "number", description: "Read timeout in ms. Default 2000." },
        },
        required: ["port", "baud", "send", "expect"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    if (name === "list_ports") {
      const ports = await listPorts();
      return { content: [{ type: "text", text: formatPorts(ports) }] };
    }
    if (name === "serial_query") {
      // Reject bad shapes up front: an undefined `expect` would produce
      // /undefined/ and a missing `port` would crash SerialPort.
      const a = validate<{ port: string; baud: number; send: string; expect: string; timeoutMs?: number }>(args, {
        port: { kind: "string", minLen: 1 },
        baud: { kind: "number", min: 1, integer: true },
        send: { kind: "string" },
        expect: { kind: "regex" },
      });
      const timeoutMs = typeof (args as { timeoutMs?: unknown }).timeoutMs === "number"
        ? (args as { timeoutMs: number }).timeoutMs
        : 2000;
      const result = await serialQuery({
        port: a.port,
        baud: a.baud,
        send: a.send,
        expect: new RegExp(a.expect),
        timeoutMs,
      });
      return { content: [{ type: "text", text: formatQueryResult(result) }] };
    }
    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `Tool error: ${msg}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("serial-mcp v0.1.0 running on stdio");
