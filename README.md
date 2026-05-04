# Embedded-AI Workspace

A practical experiment in giving an LLM the tools it needs to be useful for
embedded firmware work — built and dogfooded by a CS student with a real
STM32F4-DISCOVERY board on the desk.

The pipeline answers one question end-to-end:

> *"Did my firmware change break the board?"*

Three loosely-coupled pieces compose into a hardware-in-the-loop review
pipeline. Each is useful on its own; together they let Claude write
register-correct C, run it on real silicon, and report pass/fail.

## The pieces

| Piece | What it gives Claude | Type | Where |
|---|---|---|---|
| **MISRA-C Reviewer** | MISRA-C:2012 + AMD4 rules, ISR / DMA pitfalls | Skill 📜 | [`misra-c-reviewer/`](./misra-c-reviewer/) |
| **Datasheet MCP** | Vector-searches the 1700-page RM0090; structured register lookup; lints register writes | MCP 🔌 | [`datasheet-mcp/`](./datasheet-mcp/) |
| **Serial MCP** | Lists serial ports, sends UART commands, reads responses | MCP 🔌 | [`serial-mcp/`](./serial-mcp/) |
| **HIL Runner** | Glues it all: flashes firmware, drives UART tests, emits JUnit XML | CLI ⚙️ | [`hil-runner/`](./hil-runner/) |
| **Test firmware** | Tiny command-driven STM32F4 firmware for HIL fixtures | Firmware | [`firmware-test/`](./firmware-test/) |
| **CI workflow** | GitHub Actions: build + smoke + HIL on a self-hosted runner | YAML | [`.github/workflows/hil.yml`](./.github/workflows/hil.yml) |

## Skill vs MCP — why both?

A common confusion: aren't these the same thing? They aren't.

- **Skill** = "put on a new hat." Just instructions + reference text.
  Reshapes how Claude *thinks*, but runs zero code. Phase 1 (MISRA) is a
  Skill because reviewing C against a rule set is pure reasoning over text.

- **MCP server** = "extend a long arm into the world." A real running
  process Claude calls when it needs to do something it can't do natively:
  parse a 1700-page PDF, query a vector index, talk to USB hardware.
  Phases 2 and 3 are MCPs because they reach beyond Claude's context
  window — the datasheet would never fit, and a USB UART can't be
  reasoned about, only opened.

Skills shape *behaviour*; MCPs grant *capability*. They compose: the
MISRA Skill tells Claude what to flag, the Datasheet MCP gives it the
ground truth to flag against, and the Serial MCP lets it watch the
result execute on hardware.

> 📊 Visual explainer: [`docs/skill-vs-mcp.html`](./docs/skill-vs-mcp.html)
> — open it in any browser for a side-by-side infographic.

## What can Claude do once everything is wired up?

- *"Review `led-init-buggy.c` for MISRA compliance and verify the register
  writes against the datasheet"* → single combined report citing rule IDs
  and reference-manual page numbers (see [`INTEGRATION.md`](./INTEGRATION.md))
- *"What does bit 17 of GPIOx_AFRH do? Cite the datasheet page"* →
  one-shot structured answer with the exact reset value and bit field
- *"Flash this firmware and run my UART test plan"* → `hil-runner` does
  the flash + UART + assert loop and reports pass/fail
- *"This PR changed the firmware — does the board still respond to `ping`?"*
  → CI workflow runs the same loop on a self-hosted runner and posts
  the JUnit summary back to the PR

## Three phases, three deliverables

| Phase | Goal | Status |
|---|---|---|
| 1 | MISRA-C Skill — domain rules + ISR / DMA examples | ✅ shipped |
| 2 | Datasheet MCP — RM0090 → searchable + structured tools | ✅ shipped |
| 3 | HIL pipeline — Serial MCP + runner + CI on real hardware | ✅ shipped |

Per-phase retrospectives live in each subproject's `RETRO.md` /
`KNOWN_LIMITATIONS.md`.

## Repo layout

```
SkillEmbedded/
├── .github/workflows/hil.yml       CI: lint + HIL job
├── .mcp.example.json               Template — copy to .mcp.json, edit paths
├── INTEGRATION.md                  Recipe: combined MISRA + Datasheet review demo
├── README.md                       (this file)
├── LICENSE                         MIT
│
├── misra-c-reviewer/               Phase 1 — Claude Skill
│   ├── SKILL.md
│   ├── references/
│   ├── examples/
│   ├── checklist.md
│   └── commands/misra.md
│
├── datasheet-mcp/                  Phase 2 — vector-searchable RM0090 + register tools
│   ├── src/
│   │   ├── index.ts                MCP server entry
│   │   ├── config.ts               One place to retarget at any datasheet
│   │   ├── ingest.ts / chunk.ts / embed.ts / parseRegisters.ts
│   │   ├── tools/{search,register,verify}.ts
│   │   ├── smoke.ts / dogfood.ts
│   │   └── embedder.ts
│   ├── examples/{led-init-buggy,led-init-clean}.c
│   ├── pdfs/RM0090.pdf             (gitignored, fetch yourself)
│   └── data/                       (gitignored build artefacts)
│
├── serial-mcp/                     Phase 3a — UART tools for Claude
│   └── src/{index.ts, tools/{listPorts,serialQuery}.ts}
│
├── hil-runner/                     Phase 3b — flash + UART test runner + JUnit
│   ├── src/index.ts
│   ├── tests/plan.example.json
│   └── SELF_HOSTED_RUNNER.md
│
└── firmware-test/                  Phase 3c — STM32F407 fixture (CubeMX-paste)
    ├── Core/Src/main.c
    ├── tests/plan.json
    └── README.md
```

## Quick install (fresh machine)

```bash
git clone <this-repo> SkillEmbedded
cd SkillEmbedded

# 1. MISRA Skill — copy into Claude Code's skills dir
cp -r misra-c-reviewer ~/.claude/skills/
cp misra-c-reviewer/commands/misra.md ~/.claude/commands/

# 2. Datasheet MCP — install + build the index
cd datasheet-mcp
npm install
mkdir -p pdfs && curl -L -o pdfs/RM0090.pdf \
  https://www.st.com/resource/en/reference_manual/dm00031020-...pdf
npm run ingest && npm run chunk && npm run embed && npm run parse-registers
cd ..

# 3. Serial MCP — install
cd serial-mcp && npm install && cd ..

# 4. HIL runner — install
cd hil-runner && npm install && cd ..

# 5. Wire MCPs into Claude Code
cp .mcp.example.json .mcp.json     # then edit absolute paths
```

For the firmware build + flashing (Phase 3 hardware step), see
[`firmware-test/README.md`](./firmware-test/README.md) and
[`hil-runner/README.md`](./hil-runner/README.md). The hil-runner README
covers the Windows first-time-setup gotchas (ST-Link driver, the
v1.7.0 vs v1.8.0 stlink quirk, `--list-ports`).

For the self-hosted CI runner: [`hil-runner/SELF_HOSTED_RUNNER.md`](./hil-runner/SELF_HOSTED_RUNNER.md).

## Design principles applied throughout

1. **Local-first.** Local MiniLM embeddings, file-based LanceDB, local
   serial port, local self-hosted runner. No paid APIs at runtime.
2. **Config-driven, not hard-coded.** `datasheet-mcp` works for any
   STM32 family, any vendor, even RFCs / textbooks via `.env` + `config.ts`.
3. **Each piece useful in isolation.** Use the MISRA Skill without the
   Datasheet MCP. Use Serial MCP for any board-bringup work, not just
   STM32. The HIL runner runs without Claude in the loop.
4. **Honest limits.** Each subproject ships a `KNOWN_LIMITATIONS.md` and
   (for Phase 2) a `RETRO.md` calling out what doesn't work yet.
5. **Errors that teach.** Every failure path in the HIL runner explains
   *why* and *what to do* — designed for the next junior who hits it.

## Hardware footprint

- 1× STM32F4-DISCOVERY (STM32F407VGT6)
- USART2 on PA2/PA3 — either the on-board ST-Link VCP or an external
  USB-UART bridge (CH340, FTDI, CP210x — all work)
- ST-Link USB driver (one-time, OS-level)
- ARM GCC toolchain + `st-flash` v1.7.0 on the host

## License

[MIT](./LICENSE).
