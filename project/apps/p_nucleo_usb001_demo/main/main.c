#include <stdio.h>

#include "p_nucleo_usb001_f072rb_v1.h"
#include "stm32f0xx_hal.h"

#define BOARD_MANAGER_FW_APP "p_nucleo_usb001_demo"
#define BOARD_MANAGER_FW_VERSION "0.1.0-dev"
#define BOARD_MANAGER_FW_BUILD_ID __DATE__ " " __TIME__

int main(void)
{
    HAL_Init();
    printf("BoardManagerFirmware: app=%s version=%s build=%s board=%s\n",
        BOARD_MANAGER_FW_APP,
        BOARD_MANAGER_FW_VERSION,
        BOARD_MANAGER_FW_BUILD_ID,
        "p_nucleo_usb001_f072rb_v1");
    p_nucleo_usb001_f072rb_v1_init();
    p_nucleo_usb001_f072rb_v1_heartbeat_led_set(true);

    for (;;) {
        if (p_nucleo_usb001_f072rb_v1_user_button_read()) {
            p_nucleo_usb001_f072rb_v1_buzzer_enable_set(true);
        }
        else {
            p_nucleo_usb001_f072rb_v1_buzzer_enable_set(false);
        }
        __WFI();
    }
}
