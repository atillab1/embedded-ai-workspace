# serial-mcp

Model Context Protocol server that exposes UART/serial ports as tools to
Claude. Used by the embedded-AI workspace as the "C" half of the
hardware-in-the-loop stack: Claude can list ports and probe a board over
UART without any extra glue.

## Tools

| Tool | What it does |
|---|---|
| `list_ports` | Enumerates serial devices visible to the host (path, manufacturer, VID:PID, serial number). |
| `serial_query(port, baud, send, expect, timeoutMs?)` | Opens a port, writes `send`, reads until `expect` regex matches or timeout. Closes port. Returns matched/raw/elapsed. |

## Quick start

```bash
npm install
npm run smoke   # lists ports, exercises timeout path on a non-existent port
```

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "serial": {
      "command": "npx",
      "args": ["tsx", "/abs/path/to/serial-mcp/src/index.ts"]
    }
  }
}
```

After a Claude Code restart the tools surface as
`mcp__serial__list_ports` and `mcp__serial__serial_query`.

## Permissions

| Platform | Access requirement |
|---|---|
| Windows | No special setup; user owns the COM port unless another app is holding it |
| Ubuntu/Debian | User must be in `dialout` group: `sudo usermod -aG dialout $USER` then log out / in |
| macOS | No special setup |

## Design notes

- **Single-shot per query.** Port is opened, written to, read from, and
  closed inside `serial_query`. No persistent connection, no shared state
  between tool calls. Simpler, safer for concurrent CI runs.
- **Regex-based match end condition.** `expect` is a plain string parsed
  as a JavaScript regex; pick a pattern that uniquely terminates your
  expected response (e.g. `"OK\\n"` or `"version \\d+\\.\\d+"`).
- **Timeout returns the raw buffer**, so even on failure you can see
  what the device said up to the timeout.

## License

MIT.
