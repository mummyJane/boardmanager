#ifndef STM32F0XX_HAL_CONF_H
#define STM32F0XX_HAL_CONF_H

#define HAL_MODULE_ENABLED
#define HAL_CORTEX_MODULE_ENABLED
#define HAL_DMA_MODULE_ENABLED
#define HAL_FLASH_MODULE_ENABLED
#define HAL_GPIO_MODULE_ENABLED
#define HAL_I2C_MODULE_ENABLED
#define HAL_PWR_MODULE_ENABLED
#define HAL_RCC_MODULE_ENABLED
#define HAL_SPI_MODULE_ENABLED

#define HSI_VALUE 8000000U
#define HSE_VALUE 8000000U
#define HSI48_VALUE 48000000U
#define LSI_VALUE 40000U
#define LSE_VALUE 32768U
#define HSE_STARTUP_TIMEOUT 100U
#define LSE_STARTUP_TIMEOUT 5000U
#define VDD_VALUE 3300U
#define TICK_INT_PRIORITY 0x03U
#define USE_RTOS 0U
#define PREFETCH_ENABLE 1U
#define PREREAD_ENABLE 1U
#define USE_HAL_ASSERT 0U

#define assert_param(expr) ((void)0U)

#include "stm32f0xx_hal_rcc.h"
#include "stm32f0xx_hal_gpio.h"
#include "stm32f0xx_hal_cortex.h"
#include "stm32f0xx_hal_dma.h"
#include "stm32f0xx_hal_flash.h"
#include "stm32f0xx_hal_pwr.h"
#include "stm32f0xx_hal_i2c.h"
#include "stm32f0xx_hal_spi.h"

#endif
