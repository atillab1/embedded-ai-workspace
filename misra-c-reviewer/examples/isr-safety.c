/*
 * isr-safety.c
 * ============
 * Teaching file. Shows the most common Interrupt Service Routine (ISR) bugs
 * in embedded C, paired with a corrected version of the same pattern.
 *
 * MISRA-C:2012 itself does NOT have a chapter dedicated to ISRs. These
 * patterns are extra checks the skill applies on top of MISRA, because
 * ISR-related bugs are responsible for a huge share of real-world embedded
 * failures (lockups, missed events, silent data corruption).
 *
 * How to read this file:
 *   - Each section has a "BAD" example and a "GOOD" example.
 *   - The bug is explained in comments above the BAD code.
 *   - The fix is explained in comments above the GOOD code.
 *   - Code is illustrative, not meant to compile against a specific MCU.
 *     Pretend `EXAMPLE_IRQHandler` is wired to a real interrupt vector.
 */

#include <stdint.h>
#include <stdbool.h>
#include <string.h>

/* Imaginary hardware register — pretend this is a UART data register. */
extern volatile uint8_t HW_UART_DATA;

/* Imaginary "disable/enable interrupts" intrinsics. On real hardware these
 * are CPU instructions (e.g. cpsid i / cpsie i on ARM Cortex-M). */
extern void irq_disable(void);
extern void irq_enable(void);


/* =========================================================================
 * 1. THE `volatile` TRAP
 * =========================================================================
 *
 * If a variable is written by an ISR and read by main code (or vice versa),
 * the compiler does not know that. It may optimize the read away — caching
 * the value in a CPU register and reusing it forever — because from a
 * single-threaded view nothing changes the variable.
 *
 * Symptom: main loop spins forever waiting for a flag that "never" gets set,
 * even though you can see in the debugger that the ISR sets it.
 *
 * Fix: declare any variable shared between ISR and main as `volatile`.
 * `volatile` tells the compiler "always re-read from memory, never cache".
 * --------------------------------------------------------------------------
 */

/* ❌ BAD: missing volatile */
static bool g_data_ready_bad = false;

void example1_main_loop_bad(void)
{
    while (!g_data_ready_bad) {
        /* Compiler may compile this as: load g_data_ready_bad once,
         * then loop forever on the cached register value.
         * The ISR sets it but the loop never sees it. */
    }
}

void EXAMPLE_IRQHandler_bad(void)
{
    g_data_ready_bad = true;
}


/* ✅ GOOD: volatile forces re-read on every access */
static volatile bool g_data_ready = false;

void example1_main_loop_good(void)
{
    while (!g_data_ready) {
        /* Each iteration actually reloads from memory. */
    }
    g_data_ready = false;   /* clear and continue */
}

void EXAMPLE_IRQHandler_good(void)
{
    g_data_ready = true;
}


/* =========================================================================
 * 2. RACE CONDITION ON A MULTI-BYTE SHARED VARIABLE
 * =========================================================================
 *
 * `volatile` is necessary but NOT sufficient. It guarantees fresh reads,
 * not atomicity. On an 8-bit MCU, a 32-bit variable takes 4 instructions
 * to write. If an ISR fires in the middle, main reads a half-updated value
 * (the dreaded "torn read").
 *
 * Symptom: occasional wildly wrong values — a counter showing 0x0000FF00
 * when it should be near 0x00010000. Looks like cosmic rays. Isn't.
 *
 * Fix: protect the multi-byte read/write with a critical section
 * (briefly disable interrupts) so the access is atomic from main's view.
 * --------------------------------------------------------------------------
 */

/* ❌ BAD: 32-bit counter on an 8/16-bit MCU, no critical section */
static volatile uint32_t g_tick_count_bad = 0u;

uint32_t example2_get_ticks_bad(void)
{
    return g_tick_count_bad;   /* may read torn value */
}

void EXAMPLE_TickHandler_bad(void)
{
    g_tick_count_bad++;        /* not atomic on small MCUs */
}


/* ✅ GOOD: brief critical section protects the read */
static volatile uint32_t g_tick_count = 0u;

uint32_t example2_get_ticks_good(void)
{
    uint32_t snapshot;
    irq_disable();
    snapshot = g_tick_count;
    irq_enable();
    return snapshot;
}

void EXAMPLE_TickHandler_good(void)
{
    g_tick_count++;
    /* Inside the ISR, no disable needed — the ISR itself blocks
     * other interrupts of equal or lower priority while it runs. */
}


/* =========================================================================
 * 3. CALLING printf / sprintf / malloc IN AN ISR
 * =========================================================================
 *
 * Three reasons this is a disaster:
 *
 *   1) SPEED: printf is slow (formatting + I/O). An ISR must finish in
 *      microseconds. A printf can take milliseconds. Other interrupts
 *      back up; real-time deadlines are missed.
 *
 *   2) REENTRANCY: printf uses internal static buffers and locks. If main
 *      code is already inside printf and an ISR calls printf again, the
 *      buffer is corrupted or a deadlock occurs.
 *
 *   3) HEAP: malloc/free walk linked lists and may take locks. Same
 *      reentrancy and timing problems, plus heap fragmentation.
 *
 * Fix: in the ISR, only set a flag or push raw bytes to a ring buffer.
 * Do the formatting and printing in main code where it's safe.
 * --------------------------------------------------------------------------
 */

#define LOG_BUF_SIZE  64u

/* ❌ BAD: formatting and printing inside the ISR */
void EXAMPLE_UartRxHandler_bad(void)
{
    uint8_t byte = HW_UART_DATA;
    /* printf is non-reentrant, slow, and may use malloc internally. */
    /* printf("Received: 0x%02X\n", byte);   <-- DON'T */
    (void)byte;   /* placeholder so the example compiles */
}


/* ✅ GOOD: ISR only buffers, main loop formats */
static volatile uint8_t  g_log_buf[LOG_BUF_SIZE];
static volatile uint8_t  g_log_head = 0u;
static volatile uint8_t  g_log_tail = 0u;

void EXAMPLE_UartRxHandler_good(void)
{
    uint8_t byte = HW_UART_DATA;
    uint8_t next = (uint8_t)((g_log_head + 1u) % LOG_BUF_SIZE);
    if (next != g_log_tail) {           /* drop on overflow rather than block */
        g_log_buf[g_log_head] = byte;
        g_log_head = next;
    }
}

void example3_drain_log_in_main(void)
{
    while (g_log_tail != g_log_head) {
        uint8_t b = g_log_buf[g_log_tail];
        g_log_tail = (uint8_t)((g_log_tail + 1u) % LOG_BUF_SIZE);
        /* Now safe to printf/format/log to file etc. — we're in main. */
        (void)b;
    }
}


/* =========================================================================
 * 4. LONG-RUNNING WORK INSIDE AN ISR
 * =========================================================================
 *
 * An ISR should be measured in microseconds, not milliseconds. Heavy work
 * inside an ISR delays every other interrupt and main code, causing
 * dropped UART bytes, missed timer ticks, jittery control loops.
 *
 * Symptom: system "feels laggy", occasional sensor glitches, watchdog
 * resets under load.
 *
 * Fix: ISR captures the event and signals main. Main does the heavy work.
 * This pattern is called "deferred processing" or "bottom half".
 * --------------------------------------------------------------------------
 */

/* ❌ BAD: filtering math inside the ISR */
static volatile int32_t g_filtered_bad = 0;

void EXAMPLE_AdcHandler_bad(void)
{
    int32_t raw = (int32_t)HW_UART_DATA;   /* pretend this is ADC */
    /* Imagine a 32-tap FIR filter here. Hundreds of multiply-adds.
     * This blocks every other interrupt while it runs. */
    int32_t sum = 0;
    for (int i = 0; i < 32; i++) {
        sum += raw * i;       /* placeholder for real filter math */
    }
    g_filtered_bad = sum;
}


/* ✅ GOOD: ISR only stores the sample, main filters it */
static volatile int32_t g_latest_sample = 0;
static volatile bool    g_sample_pending = false;
static int32_t          g_filtered = 0;   /* main-only, no volatile needed */

void EXAMPLE_AdcHandler_good(void)
{
    g_latest_sample = (int32_t)HW_UART_DATA;
    g_sample_pending = true;
}

void example4_main_filter_step(void)
{
    if (g_sample_pending) {
        int32_t raw;
        irq_disable();
        raw = g_latest_sample;
        g_sample_pending = false;
        irq_enable();

        /* Heavy filtering happens here, in main, where time is plentiful. */
        int32_t sum = 0;
        for (int i = 0; i < 32; i++) {
            sum += raw * i;
        }
        g_filtered = sum;
    }
}


/* =========================================================================
 * 5. NON-REENTRANT LIBRARY FUNCTIONS IN AN ISR
 * =========================================================================
 *
 * Some standard library functions keep internal state between calls.
 * Classic examples: strtok (uses a static pointer), rand (static seed),
 * localtime (returns pointer to static struct). If main is mid-call and an
 * ISR calls the same function, the state is trampled and both callers get
 * wrong results.
 *
 * Symptom: very rare, very weird bugs that defy debugging — a string parse
 * that "sometimes" returns wrong tokens.
 *
 * Fix: don't call non-reentrant functions in ISRs. If you must do
 * tokenization in an ISR (you almost certainly shouldn't), use the _r
 * (reentrant) variants like strtok_r where available.
 * --------------------------------------------------------------------------
 */

/* ❌ BAD: strtok inside an ISR */
void EXAMPLE_CmdHandler_bad(void)
{
    static char buf[32];
    /* char *tok = strtok(buf, " ");   <-- non-reentrant, DON'T */
    (void)buf;
}


/* ✅ GOOD: ISR enqueues the raw line; main parses it */
static volatile char g_cmd_line[32];
static volatile bool g_cmd_ready = false;

void EXAMPLE_CmdHandler_good(void)
{
    /* Copy the incoming line into the buffer; set a flag. */
    g_cmd_ready = true;
}

void example5_main_parse(void)
{
    if (g_cmd_ready) {
        char local[32];
        irq_disable();
        memcpy(local, (const void *)g_cmd_line, sizeof local);
        g_cmd_ready = false;
        irq_enable();
        /* Now safely tokenize `local` in main. */
    }
}


/* =========================================================================
 * 6. SHARING DATA WITH DMA WITHOUT MEMORY BARRIERS / CACHE FLUSHES
 * =========================================================================
 *
 * DMA (Direct Memory Access) lets a peripheral move data to/from RAM
 * without the CPU. The CPU and DMA both touch the same memory — but the
 * CPU may have a cached copy (data cache) or pending writes (write buffer).
 * Without explicit synchronization, the CPU and DMA see different values.
 *
 * Symptom: works perfectly with cache disabled; mysteriously corrupts data
 * once you turn the cache on.
 *
 * Fix: before starting a DMA write FROM RAM, clean (flush) the cache so
 * RAM has the latest data. After a DMA read INTO RAM completes, invalidate
 * the cache so the CPU re-fetches fresh data. The exact intrinsics are MCU-
 * specific (SCB_CleanDCache_by_Addr / SCB_InvalidateDCache_by_Addr on Cortex-M7).
 * --------------------------------------------------------------------------
 */

/* Sketch only — real DMA setup is hardware-specific. */

extern void dma_start_tx(const void *src, uint32_t len);
extern void dma_wait_done(void);
extern void cache_clean(const void *addr, uint32_t len);
extern void cache_invalidate(void *addr, uint32_t len);

static uint8_t g_tx_buf[256];
static uint8_t g_rx_buf[256];

/* ❌ BAD: forgetting cache maintenance */
void example6_send_bad(void)
{
    g_tx_buf[0] = 0xAA;
    dma_start_tx(g_tx_buf, sizeof g_tx_buf);
    /* CPU's pending write of 0xAA may still be in the write buffer.
     * DMA reads stale RAM. The peripheral sees the wrong byte. */
}


/* ✅ GOOD: clean before TX, invalidate before reading after RX */
void example6_send_good(void)
{
    g_tx_buf[0] = 0xAA;
    cache_clean(g_tx_buf, sizeof g_tx_buf);   /* push pending writes to RAM */
    dma_start_tx(g_tx_buf, sizeof g_tx_buf);
    dma_wait_done();
}

void example6_receive_good(void)
{
    /* DMA has just filled g_rx_buf */
    cache_invalidate(g_rx_buf, sizeof g_rx_buf);   /* drop stale cached copy */
    /* Now safe to read g_rx_buf */
}


/* =========================================================================
 * SUMMARY CHECKLIST FOR ANY ISR
 * =========================================================================
 *   [ ] Every variable shared with main is `volatile`.
 *   [ ] Multi-byte shared variables are read/written in critical sections
 *       (or use atomic intrinsics).
 *   [ ] No printf, sprintf, malloc, free, file I/O, or floating-point
 *       (unless the ISR has a dedicated FPU context).
 *   [ ] No non-reentrant library calls (strtok, rand, localtime, ...).
 *   [ ] ISR body is short — capture data, set a flag, return.
 *   [ ] Heavy work is deferred to main loop or a lower-priority task.
 *   [ ] If DMA is involved, cache maintenance is in place.
 *   [ ] No ISR takes a lock that main code also takes (deadlock risk).
 * =========================================================================
 */
