# datasheet-mcp

A Model Context Protocol (MCP) server that turns any technical PDF into
queryable tools for Claude. Defaults target the STM32F407 reference manual
(RM0090), but everything is config-driven — point it at your own datasheet,
RFC, or textbook.

## What it does

| Tool | Purpose |
|---|---|
| `search_datasheet(query, k)` | Semantic search across the full document. Returns the most relevant sections with page numbers. |
| `get_register_info(peripheral, register)` | Structured register lookup (address offset, reset value, bit fields). MCU-specific; can be disabled. |
| `verify_register_write(c_code)` | Lints C code that writes to peripheral registers. Flags reserved-bit writes, magic numbers, full-word assignments. |

## Stack

| Layer | Library |
|---|---|
| MCP transport | `@modelcontextprotocol/sdk` (stdio) |
| PDF parsing | `pdfjs-dist` |
| Embedding | `@huggingface/transformers` (local, no API key) |
| Vector DB | `@lancedb/lancedb` (file-based) |
| Runtime | Node.js 20+ / TypeScript / `tsx` |

No paid APIs. Embeddings run on CPU. Total disk: ~120 MB (model + vector DB).

## Quick start

```bash
git clone <this-repo>
cd datasheet-mcp
npm install

# Drop your PDF here:
mkdir -p pdfs && cp /path/to/RM0090.pdf pdfs/RM0090.pdf

# Build the index (one-time, ~90 sec on CPU):
npm run ingest          # PDF -> data/raw-pages.json
npm run chunk           # pages -> data/chunks.json
npm run embed           # chunks -> data/lance-db/   (downloads ~30MB model on first run)
npm run parse-registers # chunks -> data/registers.json

# Smoke test:
npm run smoke
```

Then add to your Claude Code project's `.mcp.json`:

```json
{
  "mcpServers": {
    "datasheet": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/datasheet-mcp/src/index.ts"]
    }
  }
}
```

Restart Claude Code, approve the server, and the tools become available
as `mcp__datasheet__search_datasheet`, etc.

---

## Customize for *your* datasheet

Everything is read from `src/config.ts`, which falls back to environment
variables. Pick the scenario that matches your goal:

| Your goal | Effort | What to change |
|---|---|---|
| Different STM32 family (F1, G4, H7, L4, ...) | 1 minute | `DATASHEET_PDF` env var. Pipeline runs unchanged because ST manuals share format. |
| Different MCU vendor (NXP / TI / Nordic / Renesas) | ~30 minutes | `DATASHEET_PDF` + `DATASHEET_PERIPHERALS` (vendor's peripheral names). Spot-check chunking; tweak heading regex in `config.ts` if your manual doesn't use `8.4.1` numbering. |
| Non-MCU document (RFC, textbook, API spec) | ~5 minutes | `DATASHEET_PDF` + set `DISABLE_REGISTER_TOOLS=1`. Server runs with `search_datasheet` only. |
| Multiple datasheets in one server | ~1 hour | Run multiple instances with different `DATASHEET_TABLE` names; register both in `.mcp.json`. |

Copy `.env.example` to `.env` and edit:

```bash
cp .env.example .env
# Edit .env, then re-run the build pipeline
npm run ingest && npm run chunk && npm run embed && npm run parse-registers
```

### Concrete examples

**STM32G4 user:**
```bash
# .env
DATASHEET_PDF=pdfs/RM0440.pdf
DATASHEET_NAME=STM32G4 reference manual (RM0440)
DATASHEET_SHORT=STM32G4
```

**NXP i.MX RT user:**
```bash
# .env
DATASHEET_PDF=pdfs/IMXRT1060RM.pdf
DATASHEET_NAME=i.MX RT1060 reference manual
DATASHEET_SHORT=iMX-RT1060
DATASHEET_PERIPHERALS=GPIO,LPUART,LPSPI,LPI2C,GPT,FLEXCAN,USDHC,SEMC,DCDC
```

**Indexing an RFC:**
```bash
# .env
DATASHEET_PDF=pdfs/rfc7540.pdf
DATASHEET_NAME=RFC 7540 (HTTP/2)
DATASHEET_SHORT=RFC7540
DATASHEET_DESCRIPTION=HTTP/2 protocol semantics, framing, header compression.
DISABLE_REGISTER_TOOLS=1
```

---

## Smoke test

```bash
npm run smoke
```

Runs all enabled tools against canned inputs without spinning up MCP
transport. Useful for debugging.

## Cost

Zero at runtime. Local embedding model, file-based vector DB.

For higher-quality embeddings, swap `EMBEDDING_MODEL` to e.g.
`Xenova/bge-large-en-v1.5` (~1.3 GB, 1024-dim) or wire in OpenAI
`text-embedding-3-small` (~$0.05 per full ingestion).

## Known limitations

See [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md).

## License

MIT.
