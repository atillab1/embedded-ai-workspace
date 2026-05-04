/*
 * examples/led-init-clean.c
 *
 * The corrected version of led-init-buggy.c. Should produce a clean
 * MISRA + Datasheet MCP review.
 */

#include <stdint.h>

#define LED4_PIN          13U
#define MODER_OUTPUT_2BIT 0x1U
#define GPIODEN_BIT       3U          /* RCC AHB1ENR bit for GPIOD */

void init_led(void)
{
    /* Clock-enable GPIOD without disturbing other AHB1 peripherals */
    RCC->AHB1ENR |= (1U << GPIODEN_BIT);

    /* Configure PD13 as general-purpose output, leave other pins untouched */
    GPIOD->MODER &= ~(0x3U      << (LED4_PIN * 2U));
    GPIOD->MODER |=  (MODER_OUTPUT_2BIT << (LED4_PIN * 2U));

    /* Drive PD13 high using the atomic Bit Set/Reset register */
    GPIOD->BSRR = (1U << LED4_PIN);
}
