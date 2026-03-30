#include <stdio.h>

#include "p_nucleo_usb001_f072rb_v1.h"
#include "stm32f0xx_hal.h"
#include "board_app_user.h"

int board_manager_user_app_start(const board_app_context_t *context)
{
    printf("Board Manager user app start: project=%s app=%s version=%s build=%s\n",
        context->project_id,
        context->app_id,
        context->app_version,
        context->build_id);

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
