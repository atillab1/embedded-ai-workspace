<!--
  rules-required.md
  =================
  The remaining MISRA-C:2012 Required rules not already covered in
  rules-essential.md. Loaded by the skill when the user asks for a
  thorough review.

  Status: SKELETON. Most rules below are listed by number/title only.
  Contributions welcome — see README.md for the format every entry
  should follow (one-line summary, why it matters, ❌/✅ examples).
-->

# MISRA-C:2012 Required Rules (skeleton)

> **Note:** This file is a placeholder. Required rules already covered in
> `rules-essential.md` (8.13, 9.1, 10.1, 10.3, 10.4, 10.6, 10.8, 11.3,
> 11.8, 13.2, 13.5, 13.6, 14.4, 17.3, 17.4, 17.7, 18.1, 21.3, 22.2) are
> not duplicated here.

## Format expected for each rule
```
### Rule X.Y (Required)
**Rule:** one-line summary in plain English.

**Why it matters:** real-world consequence in 2–3 sentences.

**❌ Bad:**
\`\`\`c
/* violating code */
\`\`\`

**✅ Good:**
\`\`\`c
/* corrected code */
\`\`\`

**Exception:** if any.
```

## TODO list (rule numbers from the public MISRA-C:2012 + AMD4 index)

### Section 1 — A standard C environment
- Rule 1.1 (Required) — program shall fit within translation limits
- Rule 1.2 (Advisory, but listed here for completeness) — language extensions
- Rule 1.3 (Required) — no occurrence of undefined or critical unspecified behavior
- Rule 1.5 (Required) — obsolescent language features

### Section 2 — Unused code
- Rule 2.1 (Required) — no unreachable code
- Rule 2.2 (Required) — no dead code

### Section 3 — Comments
- Rule 3.1 (Required) — character sequences `/*` and `//` not used inside comments
- Rule 3.2 (Required) — line splicing not used in `//` comments

### Section 4 — Character sets and lexical conventions
- Rule 4.1 (Required) — octal/hex escape sequences shall be terminated

### Section 5 — Identifiers
- Rule 5.1 (Required) — external identifiers shall be distinct
- Rule 5.2 (Required) — identifiers in the same scope and namespace shall be distinct
- Rule 5.3 (Required) — no identifier in inner scope hides one in outer scope
- Rule 5.4 (Required) — macro identifiers shall be distinct
- Rule 5.5 (Required) — identifiers shall be distinct from macro names

### Section 6 — Types
- Rule 6.1 (Required) — bit-fields only on appropriate integer types
- Rule 6.2 (Required) — single-bit named bit-fields shall not be signed

### Section 7 — Literals and constants
- Rule 7.1 (Required) — no octal constants
- Rule 7.2 (Required) — `u`/`U` suffix on unsigned integer constants
- Rule 7.3 (Required) — lowercase `l` not used as literal suffix
- Rule 7.4 (Required) — string literal not assigned to non-const-qualified pointer

### Section 8 — Declarations and definitions
- Rule 8.1 (Required) — types shall be explicitly specified
- Rule 8.2 (Required) — function types in prototype form with named parameters
- Rule 8.3 (Required) — declarations of the same object/function shall use compatible types
- Rule 8.4 (Required) — visible declaration before definition for external linkage
- Rule 8.5 (Required) — external object/function declared once in one and only one file
- Rule 8.6 (Required) — identifier with external linkage shall have exactly one definition
- Rule 8.8 (Required) — `static` storage-class on internal-linkage objects/functions
- Rule 8.10 (Required) — inline function shall be declared static
- Rule 8.12 (Required) — enumerator values shall be unique
- Rule 8.14 (Required) — `restrict` type qualifier shall not be used

### Section 9 — Initialization
- Rule 9.2 (Required) — initializer for aggregates/unions shall be enclosed in braces
- Rule 9.3 (Required) — array shall not be partially initialized
- Rule 9.4 (Required) — element of an object shall not be initialized more than once
- Rule 9.5 (Required) — designated initializer used in array with brace-enclosed list

### Section 10 — Essential type model (rest)
- Rule 10.2, 10.5, 10.7 — see official index

### Section 11 — Pointer type conversions (rest)
- Rule 11.1, 11.2, 11.6, 11.7, 11.9

### Section 12 — Expressions
- Rule 12.1 (Advisory) — precedence
- Rule 12.2 (Required) — shift operand within range
- Rule 12.3 (Advisory) — comma operator
- Rule 12.4 (Advisory) — constant expression evaluation
- Rule 12.5 (Mandatory) — see essential

### Section 13 — Side effects (rest)
- Rule 13.1, 13.3, 13.4

### Section 14 — Control statement expressions
- Rule 14.1 (Required) — loop counter shall not be floating
- Rule 14.2 (Required) — `for` loop shall be well-formed
- Rule 14.3 (Required) — controlling expression shall not be invariant

### Section 15 — Control flow
- Rule 15.1–15.7 — `goto`, `break`, `continue`, structured `if/else`, `switch`

### Section 16 — Switch statements
- Rule 16.1–16.7 — switch shape, default placement, no fall-through

### Section 17 — Functions (rest)
- Rule 17.1, 17.2, 17.5, 17.6, 17.8

### Section 18 — Pointers and arrays (rest)
- Rule 18.2, 18.3, 18.5, 18.6, 18.7, 18.8

### Section 19 — Overlapping storage
- Rule 19.1 (Mandatory) — see essential
- Rule 19.2 (Advisory) — `union` shall not be used

### Section 20 — Preprocessor
- Rule 20.1–20.14

### Section 21 — Standard libraries (rest)
- Rule 21.1, 21.2, 21.4–21.12, 21.14–21.18

### Section 22 — Resources (rest)
- Rule 22.1, 22.3, 22.7–22.10

---

**Want to contribute?** Pick any rule above, write it up using the format
shown at the top of this file, and open a PR. Real-world bug examples are
especially valuable.
