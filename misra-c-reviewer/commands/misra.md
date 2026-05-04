---
description: Run a MISRA-C:2012 (AMD4) compliance review on a C file or pasted code, with extra ISR safety checks
argument-hint: [file path | --strict | --isr-only]
---

Use the **misra-c-reviewer** skill to perform a MISRA-C:2012 (Amendment 4, 2023) review.

## Input

`$ARGUMENTS`

## How to interpret the input

Parse `$ARGUMENTS` as follows:

- **If it contains a file path** (e.g. `main.c`, `src/foo.c`, absolute path):
  Read the file and review its full contents.

- **If `--strict` is present**:
  Load `references/rules-required.md` and `references/rules-advisory.md`
  in addition to `rules-essential.md`. Report every violation, including
  style-level issues.

- **If `--isr-only` is present**:
  Skip the general MISRA review. Only run the ISR safety cross-check
  (volatile, race conditions, printf/malloc in ISR, reentrancy, DMA cache).

- **If `$ARGUMENTS` is empty or only contains flags**:
  Ask the user to either provide a file path or paste the code they want
  reviewed. Don't proceed without code to review.

- **If `$ARGUMENTS` looks like raw C code** (contains `{`, `;`, `#include`,
  function signatures, etc.):
  Treat the whole argument as the code to review.

## Workflow

Follow the workflow defined in the skill's `SKILL.md`:

1. Identify scope (file vs snippet, ISR involvement, runtime context).
2. Load `references/rules-essential.md` (or more, if `--strict`).
3. Walk the code and report findings using the standard format:
   `[Rule X.Y — Mandatory/Required/Advisory] <summary>` with Location,
   Why, and Fix sections.
4. Cross-check ISR safety patterns from `examples/isr-safety.c`.
5. Summarize: counts by severity, top 3 things to fix first.

Group findings by severity (Mandatory → Required → Advisory → ISR Safety).
Don't manufacture findings. If the code is clean, say so plainly.
