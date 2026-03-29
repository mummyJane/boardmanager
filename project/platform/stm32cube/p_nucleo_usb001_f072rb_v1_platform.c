#include "p_nucleo_usb001_f072rb_v1.h"
#include "stm32f0xx_hal.h"

static void board_gpio_clock_enable(void)
{
    __HAL_RCC_GPIOA_CLK_ENABLE();
    __HAL_RCC_GPIOB_CLK_ENABLE();
    __HAL_RCC_GPIOC_CLK_ENABLE();
}

void p_nucleo_usb001_f072rb_v1_platform_boot_controller(void)
{
    GPIO_InitTypeDef init = {0};

    board_gpio_clock_enable();

    init.Pin = GPIO_PIN_5 | GPIO_PIN_6 | GPIO_PIN_7;
    init.Mode = GPIO_MODE_OUTPUT_PP;
    init.Pull = GPIO_NOPULL;
    init.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(GPIOA, &init);

    init.Pin = GPIO_PIN_8;
    init.Mode = GPIO_MODE_INPUT;
    init.Pull = GPIO_PULLUP;
    HAL_GPIO_Init(GPIOA, &init);

    init.Pin = GPIO_PIN_13;
    init.Mode = GPIO_MODE_INPUT;
    init.Pull = GPIO_PULLUP;
    HAL_GPIO_Init(GPIOC, &init);
}

void p_nucleo_usb001_f072rb_v1_platform_boot_usbpd_i2c(void)
{
}

void p_nucleo_usb001_f072rb_v1_platform_boot_usb_pd_controller(void)
{
}

void p_nucleo_usb001_f072rb_v1_platform_heartbeat_led_set(bool enabled)
{
    HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, enabled ? GPIO_PIN_SET : GPIO_PIN_RESET);
}

void p_nucleo_usb001_f072rb_v1_platform_vconn_enable_set(bool enabled)
{
    HAL_GPIO_WritePin(GPIOA, GPIO_PIN_6, enabled ? GPIO_PIN_SET : GPIO_PIN_RESET);
}

void p_nucleo_usb001_f072rb_v1_platform_buzzer_enable_set(bool enabled)
{
    HAL_GPIO_WritePin(GPIOA, GPIO_PIN_7, enabled ? GPIO_PIN_SET : GPIO_PIN_RESET);
}

bool p_nucleo_usb001_f072rb_v1_platform_board_detect_read(void)
{
    return HAL_GPIO_ReadPin(GPIOA, GPIO_PIN_8) == GPIO_PIN_RESET;
}

bool p_nucleo_usb001_f072rb_v1_platform_user_button_read(void)
{
    return HAL_GPIO_ReadPin(GPIOC, GPIO_PIN_13) == GPIO_PIN_RESET;
}
