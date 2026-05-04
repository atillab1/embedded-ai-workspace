<!--
  directives.md
  =============
  MISRA-C:2012 Directives. Unlike rules, directives are project-level
  guidance — they apply to your process, build system, and documentation,
  not just individual lines of code.

  Loaded by the skill when the user asks about project setup, toolchain
  configuration, or development process.

  Status: SKELETON.
-->

# MISRA-C:2012 Directives (skeleton)

> A directive cannot always be checked by reading the code. It often
> requires looking at the build system, documentation, or development
> process. The skill should advise users on these rather than try to
> "check" them automatically.

## TODO list

### Implementation
- Dir 1.1 — implementation-defined behavior shall be documented and understood

### Compilation and build
- Dir 2.1 — source code shall compile without errors
- Dir 3.1 — all source code shall be traceable to documented requirements

### Code design
- Dir 4.1 — runtime failures shall be minimized
- Dir 4.2 — all use of assembly language shall be documented
- Dir 4.3 — assembly language shall be encapsulated and isolated
- Dir 4.4 — sections of code should not be "commented out"
- Dir 4.5 — identifiers in the same namespace with overlapping visibility should be typographically unambiguous
- Dir 4.6 — `typedef`s indicating size and signedness should be used
- Dir 4.7 — every function with returnable error status shall have its return value tested
- Dir 4.8 — implementation of a structure should be hidden when its pointer is in an interface
- Dir 4.9 — function-like macros should not be used (prefer inline functions)
- Dir 4.10 — header files shall guard against multiple inclusion
- Dir 4.11 — validity of values passed to library functions shall be checked
- Dir 4.12 — dynamic memory allocation shall not be used
- Dir 4.13 — functions accessing a resource shall be called in an appropriate sequence
- Dir 4.14 — validity of values received from external sources shall be checked
- Dir 4.15 — evaluation of floating-point expressions shall not lead to NaN/Inf where unintended

---

**Want to contribute?** Pick a directive, write a short guidance entry,
open a PR.
