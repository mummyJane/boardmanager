#include "stm32f4xx_hal.h"
#include "stm32_nucleo_io_v1.h"

int main(void)
{
    HAL_Init();
    stm32_nucleo_io_v1_init();
    stm32_nucleo_io_v1_heartbeat_led_set(true);

    for (;;) {
        __WFI();
    }
}
