#include <stdio.h>

#include "p_nucleo_usb001_f072rb_v1.h"
#include "stm32f0xx_hal.h"
#include "board_agent.h"
#include "board_app_user.h"

#define BOARD_MANAGER_PROJECT_ID "p_nucleo_usb001_f072rb_demo"
#define BOARD_MANAGER_FW_APP "p_nucleo_usb001_demo"
#define BOARD_MANAGER_FW_VERSION "0.1.0-dev"
#define BOARD_MANAGER_FW_BUILD_ID __DATE__ " " __TIME__

int main(void)
{
    board_app_context_t context = {
        .board = &p_nucleo_usb001_f072rb_v1_descriptor,
        .project_id = BOARD_MANAGER_PROJECT_ID,
        .app_id = BOARD_MANAGER_FW_APP,
        .app_version = BOARD_MANAGER_FW_VERSION,
        .build_id = BOARD_MANAGER_FW_BUILD_ID,
    };

    HAL_Init();
    printf("BoardManagerFirmware: app=%s version=%s build=%s board=%s\n",
        BOARD_MANAGER_FW_APP,
        BOARD_MANAGER_FW_VERSION,
        BOARD_MANAGER_FW_BUILD_ID,
        "p_nucleo_usb001_f072rb_v1");
    board_manager_emit_agent_handshake(
        &p_nucleo_usb001_f072rb_v1_descriptor,
        BOARD_MANAGER_FW_APP,
        BOARD_MANAGER_FW_VERSION,
        BOARD_MANAGER_FW_BUILD_ID);
    p_nucleo_usb001_f072rb_v1_init();

    return board_manager_user_app_start(&context);
}
