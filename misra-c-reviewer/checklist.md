<!--
  checklist.md
  ============
  A short, manual self-review checklist embedded developers can run
  before merging a PR or marking firmware code "done". Designed to be
  fast — under 5 minutes for a small change.

  This is not a replacement for the full rules-essential.md review.
  Think of it as the "preflight" — a quick scan for the bug classes
  that account for the majority of real embedded firmware failures.
-->

# Embedded C Pre-Merge Checklist

Run through this before requesting review or merging. Every "no" needs
a fix or a documented reason.

## Memory & types

- [ ] **No `malloc` / `calloc` / `realloc` / `free`** in normal runtime
      code. (Init-only allocation OK if isolated and documented.)
- [ ] **Every local variable is initialized** before its first read.
- [ ] **No mixing of signed and unsigned** in the same comparison or
      arithmetic without an explicit, intentional cast.
- [ ] **No assignment from a wider type to a narrower one** without an
      explicit cast that documents the truncation.
- [ ] **No pointer cast to a different object type** (use `memcpy` for
      type punning).

## Pointers & arrays

- [ ] **No `const` or `volatile` cast away** from a pointer.
- [ ] **No pointer arithmetic that escapes the array bounds** (one-past-
      end is OK as a sentinel; further is undefined behavior).
- [ ] **`sizeof` is never applied to an array function parameter** — it
      gives the pointer size, not the array size.
- [ ] **String literals are pointed to by `const char *`**, never plain
      `char *`.

## Control flow & functions

- [ ] **Every non-void function returns on every path.**
- [ ] **Return values of functions that report errors are checked** (or
      cast to `void` to document the deliberate ignore).
- [ ] **`if` / `while` / `for` conditions are explicitly Boolean** —
      `if (x != 0)`, `if (p == NULL)`, not `if (x)` / `if (!p)`.
- [ ] **No side effects inside `sizeof`, `&&`/`||` right operand, or
      function-argument list with shared state.**

## Interrupts (ISR safety — beyond MISRA)

- [ ] **Every variable shared between ISR and main is `volatile`.**
- [ ] **Multi-byte shared variables are read/written atomically** (brief
      critical section or atomic intrinsic).
- [ ] **No `printf`, `sprintf`, `malloc`, `free`, file I/O, or non-
      reentrant library calls inside any ISR.**
- [ ] **No floating-point math in ISRs** unless the architecture has FPU
      context save/restore configured for interrupts.
- [ ] **ISR body is short** — capture data, set a flag, return. Heavy
      processing happens in main or a lower-priority task.
- [ ] **If DMA is used, cache maintenance is in place** — clean before
      TX, invalidate after RX (on cores with data cache).
- [ ] **No ISR takes a lock that main code also takes** (deadlock risk).

## Project hygiene

- [ ] **Header files have include guards** (`#ifndef X_H` or `#pragma once`).
- [ ] **No code is commented-out** to "save it for later" — delete it,
      git remembers.
- [ ] **Hardware register addresses are isolated** in a single BSP/HAL
      file, not scattered across modules.
- [ ] **All compiler warnings are enabled** (`-Wall -Wextra` at minimum)
      and the build is warning-free.

---

**If 17+ of the above are checked, the code is in good shape for a
junior/student-level embedded review.** Anything unchecked needs either
a fix or a one-line comment in the PR description explaining why it's
acceptable.
