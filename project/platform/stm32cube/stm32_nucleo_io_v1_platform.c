#include "stm32_nucleo_io_v1.h"
#include "stm32f4xx_hal.h"

static void board_gpio_clock_enable(void)
{
    __HAL_RCC_GPIOA_CLK_ENABLE();
    __HAL_RCC_GPIOB_CLK_ENABLE();
    __HAL_RCC_GPIOC_CLK_ENABLE();
}

void stm32_nucleo_io_v1_platform_boot_controller(void)
{
    GPIO_InitTypeDef init = {0};

    board_gpio_clock_enable();

    init.Pin = GPIO_PIN_5;
    init.Mode = GPIO_MODE_OUTPUT_PP;
    init.Pull = GPIO_NOPULL;
    init.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(GPIOA, &init);

    init.Pin = GPIO_PIN_4;
    HAL_GPIO_Init(GPIOB, &init);

    init.Pin = GPIO_PIN_13;
    init.Mode = GPIO_MODE_INPUT;
    init.Pull = GPIO_PULLUP;
    HAL_GPIO_Init(GPIOC, &init);
}

void stm32_nucleo_io_v1_platform_heartbeat_led_set(bool enabled)
{
    HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, enabled ? GPIO_PIN_SET : GPIO_PIN_RESET);
}

void stm32_nucleo_io_v1_platform_fan_enable_set(bool enabled)
{
    HAL_GPIO_WritePin(GPIOB, GPIO_PIN_4, enabled ? GPIO_PIN_SET : GPIO_PIN_RESET);
}

bool stm32_nucleo_io_v1_platform_fault_input_read(void)
{
    return HAL_GPIO_ReadPin(GPIOC, GPIO_PIN_13) == GPIO_PIN_RESET;
}
