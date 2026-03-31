#include "p_nucleo_usb001_f072rb_v1.h"
#include "stm32f0xx_hal.h"

static I2C_HandleTypeDef board_i2c1;
static SPI_HandleTypeDef board_spi2;
static bool board_i2c1_ready = false;
static bool board_spi2_ready = false;

static void board_gpio_clock_enable(void)
{
    __HAL_RCC_GPIOA_CLK_ENABLE();
    __HAL_RCC_GPIOB_CLK_ENABLE();
    __HAL_RCC_GPIOC_CLK_ENABLE();
}

static void board_spi2_init(void)
{
    GPIO_InitTypeDef init = {0};

    if (board_spi2_ready) {
        return;
    }

    board_gpio_clock_enable();
    __HAL_RCC_SPI2_CLK_ENABLE();

    init.Pin = GPIO_PIN_13 | GPIO_PIN_14 | GPIO_PIN_15;
    init.Mode = GPIO_MODE_AF_PP;
    init.Pull = GPIO_NOPULL;
    init.Speed = GPIO_SPEED_FREQ_HIGH;
    init.Alternate = GPIO_AF0_SPI2;
    HAL_GPIO_Init(GPIOB, &init);

    board_spi2.Instance = SPI2;
    board_spi2.Init.Mode = SPI_MODE_MASTER;
    board_spi2.Init.Direction = SPI_DIRECTION_2LINES;
    board_spi2.Init.DataSize = SPI_DATASIZE_8BIT;
    board_spi2.Init.CLKPolarity = SPI_POLARITY_LOW;
    board_spi2.Init.CLKPhase = SPI_PHASE_1EDGE;
    board_spi2.Init.NSS = SPI_NSS_SOFT;
    board_spi2.Init.BaudRatePrescaler = SPI_BAUDRATEPRESCALER_16;
    board_spi2.Init.FirstBit = SPI_FIRSTBIT_MSB;
    board_spi2.Init.TIMode = SPI_TIMODE_DISABLE;
    board_spi2.Init.CRCCalculation = SPI_CRCCALCULATION_DISABLE;
    board_spi2.Init.CRCPolynomial = 7;

    if (HAL_SPI_Init(&board_spi2) == HAL_OK) {
        board_spi2_ready = true;
    }
}

static void board_i2c1_init(void)
{
    GPIO_InitTypeDef init = {0};

    if (board_i2c1_ready) {
        return;
    }

    board_gpio_clock_enable();
    __HAL_RCC_I2C1_CLK_ENABLE();

    init.Pin = GPIO_PIN_8 | GPIO_PIN_9;
    init.Mode = GPIO_MODE_AF_OD;
    init.Pull = GPIO_PULLUP;
    init.Speed = GPIO_SPEED_FREQ_HIGH;
    init.Alternate = GPIO_AF1_I2C1;
    HAL_GPIO_Init(GPIOB, &init);

    board_i2c1.Instance = I2C1;
    board_i2c1.Init.Timing = 0x2000090E;
    board_i2c1.Init.OwnAddress1 = 0;
    board_i2c1.Init.AddressingMode = I2C_ADDRESSINGMODE_7BIT;
    board_i2c1.Init.DualAddressMode = I2C_DUALADDRESS_DISABLE;
    board_i2c1.Init.OwnAddress2 = 0;
    board_i2c1.Init.OwnAddress2Masks = I2C_OA2_NOMASK;
    board_i2c1.Init.GeneralCallMode = I2C_GENERALCALL_DISABLE;
    board_i2c1.Init.NoStretchMode = I2C_NOSTRETCH_DISABLE;

    if (HAL_I2C_Init(&board_i2c1) != HAL_OK) {
        return;
    }

    if (HAL_I2CEx_ConfigAnalogFilter(&board_i2c1, I2C_ANALOGFILTER_ENABLE) != HAL_OK) {
        return;
    }

    board_i2c1_ready = true;
}

void p_nucleo_usb001_f072rb_v1_platform_boot_controller(void)
{
    GPIO_InitTypeDef init = {0};

    board_gpio_clock_enable();
    board_spi2_init();

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
    board_i2c1_init();
}

void p_nucleo_usb001_f072rb_v1_platform_boot_usb_pd_controller(void)
{
    if (!board_i2c1_ready) {
        board_i2c1_init();
    }
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
