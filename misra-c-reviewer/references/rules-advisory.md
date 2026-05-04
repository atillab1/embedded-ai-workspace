<!--
  rules-advisory.md
  =================
  MISRA-C:2012 Advisory rules. Loaded by the skill only when the user
  asks for a strict / style-level review.

  Status: SKELETON. Contributions welcome.
-->

# MISRA-C:2012 Advisory Rules (skeleton)

> Advisory rules are recommendations. Deviation is acceptable with sound
> engineering judgment — but they often catch real readability and
> maintainability issues, especially in shared codebases.

> **Note:** A few Advisory rules with very high practical value (8.13,
> 11.4, 11.5, 18.4) are already covered in `rules-essential.md` and not
> repeated here.

## Format expected for each rule
See `rules-required.md` — same format.

## TODO list

- Rule 1.2 — language extensions should not be used
- Rule 2.3 — types should not be unused
- Rule 2.4 — tag identifiers should not be unused
- Rule 2.5 — macros should not be unused
- Rule 2.6 — labels should not be unused
- Rule 2.7 — function parameters should not be unused
- Rule 4.2 — trigraphs should not be used
- Rule 5.9 — internal-linkage identifiers should be distinct
- Rule 8.7 — functions/objects should not have external linkage if only used in one file
- Rule 8.9 — object should be defined at block scope if only used in one function
- Rule 8.11 — array size should be specified explicitly even when initializer present
- Rule 11.4 (covered in essential)
- Rule 11.5 (covered in essential)
- Rule 12.1 — operator precedence should be made explicit
- Rule 12.3 — comma operator should not be used
- Rule 12.4 — constant unsigned integer overflow in expressions
- Rule 15.5 — function should have a single point of exit
- Rule 17.5 — function argument with array type should match declared size
- Rule 17.8 — function parameter should not be modified
- Rule 18.4 (covered in essential)
- Rule 18.5 — declarations should contain no more than two levels of pointer nesting
- Rule 19.2 — union keyword should not be used
- Rule 20.1 — `#include` directives should only be preceded by other preprocessor directives or comments

---

**Want to contribute?** Pick a rule, write it up with `❌ Bad` / `✅ Good`
examples, open a PR.
