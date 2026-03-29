#include "p_nucleo_usb001_f072rb_v1.h"
#include "stm32f0xx_hal.h"

int main(void)
{
    HAL_Init();
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
