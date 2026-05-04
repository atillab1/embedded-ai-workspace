/**
 * firmware-test/main.c
 *
 * Minimal command-driven firmware for the STM32F4-DISCOVERY, used as a
 * fixture by hil-runner.
 *
 * Drop-in replacement for the CubeMX-generated main.c:
 * keep the SystemClock_Config() / MX_GPIO_Init() / MX_USART2_UART_Init()
 * helpers that CubeMX emits, replace the body of main() with the loop here.
 *
 * UART command set is described in the firmware-test/README.md.
 */

#include "main.h"
#include <string.h>
#include <stdint.h>

/* CubeMX-generated handles */
extern UART_HandleTypeDef huart2;

/* Forward declarations from CubeMX template */
void SystemClock_Config(void);
static void MX_GPIO_Init(void);
static void MX_USART2_UART_Init(void);

#define LED4_PIN          GPIO_PIN_13
#define LED4_PORT         GPIOD
#define UART_RX_BUF_SIZE  64U

static const char BANNER[]    = "FW 0.1 ready\n";
static const char REPLY_PONG[]= "pong\n";
static const char REPLY_OK[]  = "OK\n";
static const char REPLY_VER[] = "FW 0.1\n";
static const char REPLY_ERR[] = "ERR unknown\n";

static void uart_write(const char *s)
{
    HAL_UART_Transmit(&huart2, (uint8_t *)s, (uint16_t)strlen(s), 100U);
}

static void led_set(uint8_t on)
{
    HAL_GPIO_WritePin(LED4_PORT, LED4_PIN, on ? GPIO_PIN_SET : GPIO_PIN_RESET);
}

/* Read until '\n' or buffer full, return number of chars (excl. '\n').
 * Blocking. Suitable for a tiny test fixture, NOT for production. */
static uint16_t uart_read_line(char *buf, uint16_t maxLen)
{
    uint16_t n = 0U;
    while (n < (maxLen - 1U)) {
        uint8_t ch;
        if (HAL_UART_Receive(&huart2, &ch, 1U, HAL_MAX_DELAY) != HAL_OK) {
            continue;
        }
        if (ch == '\n') break;
        if (ch == '\r') continue;
        buf[n++] = (char)ch;
    }
    buf[n] = '\0';
    return n;
}

static void handle_command(const char *cmd)
{
    if (strcmp(cmd, "ping") == 0) {
        uart_write(REPLY_PONG);
    } else if (strcmp(cmd, "led on") == 0) {
        led_set(1U);
        uart_write(REPLY_OK);
    } else if (strcmp(cmd, "led off") == 0) {
        led_set(0U);
        uart_write(REPLY_OK);
    } else if (strcmp(cmd, "version") == 0) {
        uart_write(REPLY_VER);
    } else {
        uart_write(REPLY_ERR);
    }
}

int main(void)
{
    HAL_Init();
    SystemClock_Config();
    MX_GPIO_Init();
    MX_USART2_UART_Init();

    uart_write(BANNER);

    char buf[UART_RX_BUF_SIZE];
    for (;;) {
        (void)uart_read_line(buf, UART_RX_BUF_SIZE);
        handle_command(buf);
    }
    /* not reached */
}
