# Known limitations

This is an MVP. Below are the rough edges you will hit and where they come from.

## PDF parsing

- **Multi-column layout occasionally interleaves text.** PDF.js gives us text
  items with X/Y coordinates; we use Y to re-insert newlines, but two-column
  pages can still produce mixed lines. Most register pages are unaffected.
- **Figures, formulas, and code blocks lose structure.** We extract them as
  flat text. For bit-layout diagrams (e.g. the 31-down-to-0 row above each
  register) the visual structure is lost; the bit names are still present
  but no longer aligned.

## Chunking

- **Heading regex misses non-numbered sections.** Anything without an
  `N.N(.N)` prefix is folded into the previous chunk.
- **Cross-section content can leak across chunks** when two register
  descriptions share a page and the second has no numbered heading on
  that page.
- **TOC and index pages** are filtered heuristically (dot-leader ratio,
  ALLCAPS register-name density). A handful of false positives still slip
  through, but they sink to the bottom of vector search results.

## Embeddings

- **Local model is `all-MiniLM-L6-v2` (384-dim).** Decent for register
  search; not as sharp as OpenAI `text-embedding-3-small`. If quality is
  important, swap models in `src/embedder.ts` and re-run `npm run embed`.
- **No re-ranking** of retrieved chunks. Top-K is taken as-is.

## Register parser

- **Coverage is partial.** ~280 registers across 23 peripherals. Not all
  bit fields parse cleanly — the heuristic regex drops "NAME:" / "Reserved"
  detection on some unusual layouts (e.g. compound names like `MODER15[1:0]`
  spread across two lines).
- **Sometimes mislabels real fields as `Reserved`** when the description
  starts with "Reserved" but the bit is actually defined later. Spot-check
  before relying on `get_register_info` for safety-critical decisions.
- **Reset values are taken at face value.** Some registers have
  per-port reset values (GPIOA differs from GPIOB) that are listed as
  bullet points; we take the first.
- **Address offsets only.** Absolute addresses (`0x4002 0000`) are not
  resolved.

## verify_register_write

- **Regex parser, not a real C parser.** It catches:
  - `PERIPH->REG = expr;`
  - `PERIPH->REG |= expr;`
  - `PERIPH->REG &= expr;`
- **Atomic write-1-to-set/clear registers** are exempted from the
  "direct full-word assignment" warning by name list. Currently:
  `BSRR`, `BSRRL`, `BSRRH`, `SWIER`, `EMR`, `IMR_W1`. Direct
  assignment to these is the *correct* idiom — writing 1 acts on a
  bit, 0 is a no-op. Add more atomic-action registers to the list
  in `tools/verify.ts` as you encounter them.
- **Comment lines that contain `PERIPH->REG = ...;` strings** also
  match (the regex doesn't strip C comments). Result: a finding may
  point at a comment line as well as the real code line. Cosmetic
  noise, not a correctness issue.
- **Misses:** struct field writes through pointers, function-style register
  writers (`HAL_GPIO_Init(...)`), bit-band aliases, and any write hidden
  behind a macro.
- **`expr` evaluation is shallow.** Recognises hex literals, decimal
  literals, simple casts, and `(1 << N)`. Anything else (`MASK_A | MASK_B`,
  function calls) falls back to "couldn't statically evaluate".

## Future work

- Better register-table parser using bit-row layout instead of text matching
- Re-rank vector hits with cross-encoder
- Support STM32G4 / STM32H7 / STM32L4 manuals via a config file
- Real Tree-sitter C parser for `verify_register_write`
- `verify_register_write` should also flag missing clock-enable for the
  peripheral (very common bug)
