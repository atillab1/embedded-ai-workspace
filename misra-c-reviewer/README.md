# MISRA-C:2012 Reviewer Skill

A free, learning-oriented Claude Skill that reviews embedded C code against
**MISRA-C:2012 (Amendment 4, 2023)** plus extra **ISR safety** checks that
MISRA itself doesn't cover.

Built for **embedded students, hobbyists, and junior firmware developers**
who don't have access to commercial MISRA tools (IAR C-STAT, Axivion, LDRA,
PRQA QA-C, Polyspace).

> ⚠️ **Not a certified tool.** This skill is a learning aid and a first-line
> bug catcher. For safety-critical certification work, the official MISRA
> document and a certified static analyzer remain the source of truth.

---

## What it does

Paste a C snippet or point at a file, and the skill will:

1. Walk the code and report MISRA-C:2012 violations grouped by severity
   (Mandatory → Required → Advisory), with **rule number**, **why it
   matters**, and a **concrete fix**.
2. Cross-check any ISR (interrupt) code for the classic embedded bugs
   MISRA doesn't address: missing `volatile`, race conditions, `printf`
   in ISR, long ISR bodies, non-reentrant library calls, DMA cache
   issues.
3. Summarize the top 3 things to fix first.

It will **not** lecture, won't manufacture findings, and won't claim
certification.

---

## Install

### Option 1 — Claude Code (CLI / IDE)

**For all your projects (recommended):**
```bash
mkdir -p ~/.claude/skills ~/.claude/commands
cp -r misra-c-reviewer ~/.claude/skills/
cp misra-c-reviewer/commands/misra.md ~/.claude/commands/
```

**For a single project:**
```bash
mkdir -p .claude/skills .claude/commands
cp -r misra-c-reviewer .claude/skills/
cp misra-c-reviewer/commands/misra.md .claude/commands/
```

Restart Claude Code. The skill activates whenever your prompt looks like
a MISRA review request ("review this for MISRA", "is this ISR safe",
"check this firmware code", etc.).

You can also invoke it explicitly with the slash command:
```
/misra path/to/file.c              # default review
/misra path/to/file.c --strict     # include Required + Advisory rules
/misra path/to/file.c --isr-only   # only ISR safety checks
```

### Option 2 — Claude.ai (web)

1. Create a new **Project** at [claude.ai](https://claude.ai).
2. Upload all files from this folder into **Project knowledge**:
   - `SKILL.md`
   - `references/rules-essential.md`
   - `references/rules-required.md`
   - `references/rules-advisory.md`
   - `references/directives.md`
   - `examples/isr-safety.c`
   - `checklist.md`
3. In **Project instructions**, paste:
   > Use `SKILL.md` as your operating manual when reviewing C code. Load
   > reference files from the `references/` section as the workflow describes.
4. Start a new chat in that project and paste your code.

---

## Repository layout

```
misra-c-reviewer/
├── SKILL.md                       # Skill entry point — Claude reads this first
├── checklist.md                   # Quick pre-merge self-review checklist
├── references/
│   ├── rules-essential.md         # Mandatory + highest-yield Required (~25 rules) ✅
│   ├── rules-required.md          # Remaining Required rules — SKELETON (PRs welcome)
│   ├── rules-advisory.md          # Advisory rules — SKELETON (PRs welcome)
│   └── directives.md              # Directives — SKELETON (PRs welcome)
└── examples/
    ├── isr-safety.c               # ISR safety patterns (bad vs good) ✅
    ├── pointer-violations.c       # TODO
    └── type-violations.c          # TODO
```

---

## Contributing

The `rules-essential.md` file is the curated core — it covers the rules
with the highest real-world bug yield. The other reference files are
skeletons waiting for community contributions.

### How to add a rule

Pick any `TODO` rule in `rules-required.md`, `rules-advisory.md`, or
`directives.md` and write it up using this format:

```markdown
### Rule X.Y (Required)
**Rule:** one-line summary in plain English.

**Why it matters:** 2–3 sentences with a real-world consequence.

**❌ Bad:**
\`\`\`c
/* code that violates the rule */
\`\`\`

**✅ Good:**
\`\`\`c
/* corrected code */
\`\`\`

**Exception:** if there's a legitimate case for deviation, describe it.
```

### Important constraints

- **Do not copy text from the official MISRA-C:2012 document.** It is
  copyrighted. Paraphrase rules in your own words.
- Rule numbers and categories (Mandatory/Required/Advisory) are public
  metadata — use them freely.
- Prefer **real-world bug examples** over toy code. "We had a production
  crash because…" is far more useful than abstract examples.
- Keep explanations accessible to junior developers and students.

### Pull request flow

1. Fork the repo.
2. Add or update entries in the relevant file.
3. Run a quick self-review against `checklist.md` if your PR includes
   any C code.
4. Open a PR with a short description of what rules you added.

---

## Further reading

- **Official MISRA documents:** [misra.org.uk](https://misra.org.uk) — the
  authoritative source. Required reading if you work in safety-critical
  embedded.
- **Barr Group Embedded C Coding Standard** — free, well-written, partially
  overlaps with MISRA. Good companion read.
- **CERT C Coding Standard** — security-focused, complements MISRA's
  safety focus.
- **"Making Embedded Systems" by Elecia White** — best general intro to
  the field for junior developers.

---

## License

MIT. Use it, fork it, ship it.

The MISRA rule numbers and categories referenced in this skill are public
factual metadata; the rule explanations and example code are original
work by the contributors of this repository.
