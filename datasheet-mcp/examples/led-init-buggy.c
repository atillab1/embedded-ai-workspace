/*
 * examples/led-init-buggy.c
 *
 * Deliberately buggy GPIO init for the STM32F4-DISCOVERY board.
 * Used as a fixture for testing the combined MISRA Skill +
 * Datasheet MCP review flow.
 *
 * Board: STM32F407VGT6 (DISCO-F407VG)
 * LED4 (orange) is connected to PD13.
 *
 * Expected findings when reviewed:
 *
 *   MISRA Skill:
 *     - Rule 9.1   (unused 'int dummy' in init_led)
 *     - Rule 10.4  (signed/unsigned mix in 'led_pin = 13;' compared to (uint32_t)1<<...)
 *     - Rule 21.3  (use of 'malloc' inside an MCU init path)
 *
 *   Datasheet MCP (verify_register_write):
 *     - GPIOD->MODER = 0x55555555;     direct-assignment warning,
 *                                      AND clobbers reset state of all 16 pins
 *     - GPIOD->BSRR  = (1U << 13);     OK on its own (sets PD13)
 *     - RCC->AHB1ENR = 0x00000008;     direct-assignment warning,
 *                                      AND clears every other peripheral's clock-enable bit
 */

#include <stdint.h>
#include <stdlib.h>

#define LED4_PIN  13U

/* MISRA 21.3 violation: dynamic memory in MCU init path */
static uint32_t *boot_buf;

void init_led(void)
{
    int dummy;                      /* MISRA 9.1: never read */
    int led_pin = 13;               /* MISRA 10.4: signed mixed with unsigned below */

    /* Should be |= (1U << 0); current code wipes every other clock enable */
    RCC->AHB1ENR = 0x00000008;

    /* Direct full-word assignment to MODER. Reset value differs per pin;
     * here we set every pin to "01" (general-purpose output). Probably not
     * what the application intends. */
    GPIOD->MODER = 0x55555555;

    /* Set PD13 high — actually correct */
    GPIOD->BSRR  = (1U << led_pin);

    /* MISRA 21.3 */
    boot_buf = (uint32_t *)malloc(64U);
}
