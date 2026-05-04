<!--
  rules-essential.md
  ==================
  The high-bug-yield subset of MISRA-C:2012 (with Amendment 4, 2023).
  Loaded by default for every review. Covers:
    - All Mandatory rules relevant to typical embedded code
    - The Required rules that catch the most real-world bugs:
        type model (Rule 10.x), pointer conversions (Rule 11.x),
        side effects (Rule 13.x), control expressions (Rule 14.x),
        return-value misuse (Rule 17.x), pointer arithmetic (Rule 18.x),
        dynamic memory (Rule 21.x).

  Rule numbers and categories (Mandatory/Required/Advisory) are factual
  metadata from the public MISRA index. Rule TEXT below is paraphrased in
  plain language — never copied from the official document, which is
  copyrighted.
-->

# MISRA-C:2012 Essential Rules

Each rule has the format:

> **Rule N.M (Category)**  
> One-line summary in plain English.
>
> **Why it matters:** real-world consequence.
>
> **❌ Bad / ✅ Good** code examples.
>
> **Exception:** when bending the rule is reasonable (if any).

---

## Mandatory Rules

Mandatory means *no deviation allowed, ever*. If you violate one of these, fix the code — there is no documented-exception escape hatch.

---

### Rule 9.1 (Mandatory)
**Don't read a local variable before you've written to it.**

**Why it matters:** in C, an uninitialized local variable contains *whatever garbage was on the stack from the previous function call*. Reading it gives you a random value — sometimes 0, sometimes not, sometimes different every run. This is the #1 source of "works on my machine, fails in production" bugs.

**❌ Bad:**
```c
void compute_speed(void) {
    int sum;                    /* sum holds garbage */
    for (int i = 0; i < 10; i++) {
        sum += sample[i];       /* reading garbage, then adding to it */
    }
    publish(sum);
}
```

**✅ Good:**
```c
void compute_speed(void) {
    int sum = 0;                /* explicitly initialized */
    for (int i = 0; i < 10; i++) {
        sum += sample[i];
    }
    publish(sum);
}
```

**Exception:** none. Always initialize before first read.

---

### Rule 12.5 (Mandatory)
**Don't use `sizeof` on a function parameter that looks like an array.**

**Why it matters:** when you write `void f(int arr[10])`, C secretly converts `arr` into `int *arr` — a pointer. So `sizeof(arr)` inside the function returns the size of a pointer (typically 4 or 8 bytes), not the array. People expect 40 (10 × `sizeof(int)`), get 8, and write loops that read past the end of the array.

**❌ Bad:**
```c
void clear(int arr[10]) {
    for (size_t i = 0; i < sizeof(arr) / sizeof(arr[0]); i++) {
        arr[i] = 0;             /* runs only 2 iterations, not 10! */
    }
}
```

**✅ Good:**
```c
void clear(int *arr, size_t count) {
    for (size_t i = 0; i < count; i++) {
        arr[i] = 0;
    }
}
```

---

### Rule 13.6 (Mandatory)
**The operand of `sizeof` must not have side effects.**

**Why it matters:** `sizeof` is computed at compile time — it does *not* execute its operand. If you put a function call or `++` inside, you'll think it ran but it didn't.

**❌ Bad:**
```c
size_t s = sizeof(buffer[i++]);   /* i is NOT incremented */
```

**✅ Good:**
```c
size_t s = sizeof(buffer[0]);
i++;
```

---

### Rule 17.3 (Mandatory)
**Don't call a function without a visible declaration (no implicit declarations).**

**Why it matters:** old C let you call a function the compiler had never seen, and assumed it returned `int`. If the function actually returned a pointer or a `float`, the result was silently wrong. Modern compilers warn about this; MISRA forbids it outright.

**❌ Bad:**
```c
/* no #include, no prototype */
int main(void) {
    double x = sqrt(2.0);   /* compiler assumes sqrt returns int — wrong */
    return 0;
}
```

**✅ Good:**
```c
#include <math.h>           /* brings in the correct prototype */
int main(void) {
    double x = sqrt(2.0);
    return 0;
}
```

---

### Rule 17.4 (Mandatory)
**Every non-void function must return a value on every path.**

**Why it matters:** falling off the end of a non-void function returns garbage to the caller. Same class of bug as Rule 9.1 but at the call boundary.

**❌ Bad:**
```c
int abs_value(int x) {
    if (x >= 0) {
        return x;
    }
    /* no return on the else path — undefined behavior */
}
```

**✅ Good:**
```c
int abs_value(int x) {
    if (x >= 0) {
        return x;
    }
    return -x;
}
```

---

### Rule 19.1 (Mandatory)
**Don't copy or assign an object to itself in a way that overlaps in memory.**

**Why it matters:** `memcpy` and similar functions assume source and destination don't overlap. If they do, the result is undefined — you might corrupt the source while reading it.

**❌ Bad:**
```c
char buf[100];
/* shift everything left by 1 byte using memcpy — overlapping! */
memcpy(buf, buf + 1, 99);
```

**✅ Good:**
```c
memmove(buf, buf + 1, 99);   /* memmove handles overlap correctly */
```

---

### Rule 21.13 (Mandatory)
**Arguments to `<ctype.h>` functions (`isalpha`, `isdigit`, etc.) must be `EOF` or representable as `unsigned char`.**

**Why it matters:** `char` may be signed on some platforms. If you pass a negative `char` (e.g. a byte ≥ 128 in a UTF-8 string), `isalpha` reads off the end of an internal lookup table → undefined behavior, often a crash.

**❌ Bad:**
```c
char c = get_byte();
if (isalpha(c)) { ... }     /* if c is e.g. 0xC3, this is UB */
```

**✅ Good:**
```c
char c = get_byte();
if (isalpha((unsigned char)c)) { ... }
```

---

### Rule 22.2 (Mandatory)
**Only free memory that was allocated by `malloc`/`calloc`/`realloc`, and free it only once.**

**Why it matters:** double-free and freeing-non-heap-memory corrupt the heap and lead to exploitable bugs. Embedded systems often don't have heap protection, so the corruption silently spreads.

**❌ Bad:**
```c
int arr[10];
free(arr);                  /* arr is on the stack, not the heap */

char *p = malloc(16);
free(p);
free(p);                    /* double free */
```

**✅ Good:**
```c
char *p = malloc(16);
if (p != NULL) {
    /* ... use p ... */
    free(p);
    p = NULL;               /* prevents accidental reuse */
}
```

> **Note:** Rule 21.3 below recommends avoiding dynamic memory altogether in embedded code — but if you do use it, 22.2 still applies.

---

## High-Yield Required Rules

Required rules can be deviated from with documented justification. In practice, for student/hobbyist work, treat them as "fix unless you really know why."

---

### Rule 8.13 (Advisory, but treated as essential here)
**A pointer parameter should be `const` if the function doesn't modify what it points to.**

**Why it matters:** `const` documents intent and lets the compiler catch accidental writes. It also lets callers pass `const` data (e.g. string literals) without a cast.

**❌ Bad:**
```c
size_t my_strlen(char *s) {     /* doesn't write to *s, but signature suggests it might */
    size_t n = 0;
    while (s[n] != '\0') n++;
    return n;
}
```

**✅ Good:**
```c
size_t my_strlen(const char *s) {
    size_t n = 0;
    while (s[n] != '\0') n++;
    return n;
}
```

---

### Rule 10.1 (Required) — Operands of operators shall be of an appropriate essential type
**Don't mix incompatible "kinds" of values in arithmetic.**

MISRA groups types into *essential type categories*: Boolean, character, signed, unsigned, enum, floating. Mixing them silently is a bug magnet.

**❌ Bad:**
```c
char c = 'A';
if (c + 1) { ... }              /* char + int? mixing essential types */
```

**✅ Good:**
```c
char c = 'A';
if ((int)c + 1 != 0) { ... }    /* explicit, intent clear */
```

---

### Rule 10.3 (Required) — Don't assign a value to an object of a narrower or different essential type
**Wider/different type going into narrower/different type silently truncates or reinterprets.**

**❌ Bad:**
```c
uint16_t small;
uint32_t big = 0x12345678;
small = big;                    /* silently keeps only 0x5678 */
```

**✅ Good:**
```c
uint16_t small = (uint16_t)(big & 0xFFFFu);   /* explicit truncation */
```

---

### Rule 10.4 (Required) — Both operands of an operator shall have the same essential type category
**Same idea as 10.1, applied to binary operators.**

**❌ Bad:**
```c
if (signed_var > unsigned_var) { ... }   /* mixed signedness comparison — classic trap */
```

**✅ Good:**
```c
if ((signed_var >= 0) && ((uint32_t)signed_var > unsigned_var)) { ... }
```

> Why the trap? If `signed_var` is negative, the comparison promotes it to a huge unsigned number and the test gives the *opposite* answer.

---

### Rule 10.6 (Required) — Don't assign a wider value to a narrower object
**Like 10.3 but specifically about width loss.**

**❌ Bad:**
```c
uint8_t status = some_uint32_value;     /* loses upper 24 bits */
```

**✅ Good:**
```c
uint8_t status = (uint8_t)(some_uint32_value & 0xFFu);
```

---

### Rule 10.8 (Required) — Don't cast a composite expression to a different/wider essential type
**`(uint32_t)(a + b)` where `a` and `b` are 16-bit doesn't do what you think.**

The addition happens at 16-bit width *first* and may overflow, *then* the cast widens. Cast each operand first.

**❌ Bad:**
```c
uint16_t a, b;
uint32_t total = (uint32_t)(a + b);     /* a+b can wrap before the cast */
```

**✅ Good:**
```c
uint32_t total = (uint32_t)a + (uint32_t)b;
```

---

### Rule 11.3 (Required) — Don't cast a pointer to a different object type
**Reinterpreting memory as a different type breaks alignment and aliasing rules.**

**❌ Bad:**
```c
uint8_t buffer[4];
uint32_t *p = (uint32_t *)buffer;       /* alignment may be wrong on ARM, MIPS */
uint32_t v = *p;                        /* possible bus fault */
```

**✅ Good:**
```c
uint8_t buffer[4];
uint32_t v;
memcpy(&v, buffer, sizeof v);           /* correct, alignment-safe */
```

---

### Rule 11.4 (Advisory, treated essential) — Avoid casting between integer and pointer
**Stuffing addresses into ints or vice versa is platform-dependent and rarely necessary.**

**❌ Bad:**
```c
uint32_t addr = 0x40021000;
GPIO_Type *gpio = (GPIO_Type *)addr;
```

**✅ Good (when you must talk to memory-mapped registers):**
```c
#define GPIOA_BASE  0x40021000u
volatile GPIO_Type * const gpio = (volatile GPIO_Type *)GPIOA_BASE;
/* the cast is isolated, commented, and used only at the hardware boundary */
```

> **Exception:** memory-mapped I/O is the canonical legitimate use. Document it and isolate it in one place (a `bsp.h` or driver header).

---

### Rule 11.5 (Advisory, treated essential) — Don't cast `void *` to a different object pointer type
**`void *` to `T *` is legal in C but easy to misuse. Each cast is a place a bug can hide.**

**❌ Bad:**
```c
void *raw = get_buffer();
uint32_t *words = (uint32_t *)raw;      /* who guarantees alignment? size? */
```

**✅ Good:** design APIs that return the right type to begin with, or copy out via `memcpy`.

---

### Rule 11.8 (Required) — Don't cast away `const` or `volatile` from a pointer
**`const` and `volatile` are promises. Casting them away silently breaks the promise.**

**❌ Bad:**
```c
void modify(const char *s) {
    char *p = (char *)s;                /* lying about const */
    p[0] = 'X';                         /* may crash if s points to literal */
}
```

**✅ Good:** if you need to write, take a non-const pointer in the signature.

---

### Rule 13.2 (Required) — The order of evaluation of side effects must be unambiguous
**`x = i++ + array[i];` — what's the value of `i` when `array[i]` is read? C doesn't say.**

**❌ Bad:**
```c
int i = 0;
arr[i] = i++;               /* undefined: which i? */
f(g(), h());                /* if g and h share state, order matters and is unspecified */
```

**✅ Good:**
```c
int i = 0;
int tmp = i;
i++;
arr[tmp] = i;               /* explicit, no ambiguity */
```

---

### Rule 13.5 (Required) — Right operand of `&&` or `||` shall not contain side effects
**Short-circuit evaluation may skip the right side. If it has a side effect, your program behaves differently depending on the left side.**

**❌ Bad:**
```c
if (ready() && start_motor()) { ... }   /* if ready() is false, motor never starts.
                                           Was that the intent? Hidden in syntax. */
```

**✅ Good:**
```c
bool r = ready();
bool s = start_motor();
if (r && s) { ... }
```

---

### Rule 14.4 (Required) — Controlling expression of `if` / `while` / `for` shall be essentially Boolean
**`if (x)` is shorthand for `if (x != 0)`. Be explicit.**

**Why it matters:** in embedded C, types like `int`, `pointer`, and `error_code_t` all collapse into "nonzero = true" implicitly. This hides bugs (e.g. an error code where `0` means OK becomes "true = error" when used in `if (err)`, which reads backwards).

**❌ Bad:**
```c
int count = get_count();
if (count) { process(); }       /* "if count..." reads ambiguous */

char *p = malloc(16);
if (!p) { handle_oom(); }       /* relies on pointer-to-bool conversion */
```

**✅ Good:**
```c
if (count != 0) { process(); }
if (p == NULL) { handle_oom(); }
```

---

### Rule 17.7 (Required) — The return value of a non-void function shall be used
**If a function returns an error code, ignoring it is exactly how silent failures happen.**

**❌ Bad:**
```c
fwrite(data, 1, n, fp);         /* what if it wrote fewer bytes? You'll never know. */
```

**✅ Good:**
```c
size_t written = fwrite(data, 1, n, fp);
if (written != n) {
    handle_short_write();
}
```

> If you genuinely don't care, cast to void to make the intent explicit:
> ```c
> (void)printf("debug\n");
> ```

---

### Rule 18.1 (Required) — A pointer resulting from arithmetic on an array pointer shall stay within the array
**Going one past the end is allowed (for loop sentinels). Going further is undefined behavior.**

**❌ Bad:**
```c
int arr[10];
int *p = &arr[12];              /* UB even if you never dereference */
```

**✅ Good:**
```c
int arr[10];
int *p = &arr[10];              /* one-past-end is OK as a sentinel, just don't dereference */
for (int *q = arr; q < p; q++) { ... }
```

---

### Rule 18.4 (Advisory, treated essential) — Don't use `+`, `-`, `+=`, `-=` on pointers
**Prefer array indexing — `arr[i]` is clearer and harder to get wrong than `*(arr + i)`.**

**❌ Bad:**
```c
*(buffer + offset + 4) = value;
```

**✅ Good:**
```c
buffer[offset + 4] = value;
```

---

### Rule 21.3 (Required) — Don't use `malloc`, `calloc`, `realloc`, or `free`
**Dynamic memory in embedded systems leads to fragmentation, unpredictable timing, and runtime out-of-memory failures you can't recover from.**

**Why it matters:** an embedded system may run for years. Heap fragmentation accumulates. A `malloc` that worked yesterday may fail today, in the field, with no operator to restart the device.

**❌ Bad:**
```c
char *buf = malloc(size);       /* might return NULL anytime, fragments heap */
```

**✅ Good:**
```c
static char buf[MAX_SIZE];      /* statically allocated, predictable, never fails */
```

> **Exception:** during initialization (one-time, before real-time work begins) some projects allow allocation. Document and isolate it.

---

## How to apply this file

When reviewing user code:
1. Walk the code top-to-bottom.
2. For each line, mentally check it against the rules above. Don't look for *all* of them on every line — pattern-match: pointer cast → check 11.x; arithmetic → check 10.x; `if` → check 14.4; library call with return → check 17.7.
3. Report findings using the format in `SKILL.md` (Rule, Location, Why, Fix).
4. Don't manufacture findings. If the code is clean, say so.
