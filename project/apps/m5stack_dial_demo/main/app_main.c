#include <stdio.h>

#include "m5stack_dial_v1_1.h"
#include "board_agent.h"
#include "board_app_user.h"

#define BOARD_MANAGER_PROJECT_ID "m5stack_dial_demo"
#define BOARD_MANAGER_FW_APP "m5stack_dial_demo"
#define BOARD_MANAGER_FW_VERSION "0.1.0-dev"
#define BOARD_MANAGER_FW_BUILD_ID __DATE__ " " __TIME__

void app_main(void)
{
    board_app_context_t context = {
        .board = &m5stack_dial_v1_1_descriptor,
        .project_id = BOARD_MANAGER_PROJECT_ID,
        .app_id = BOARD_MANAGER_FW_APP,
        .app_version = BOARD_MANAGER_FW_VERSION,
        .build_id = BOARD_MANAGER_FW_BUILD_ID,
    };

    printf("Board Manager dial smoke test starting\n");
    printf("BoardManagerFirmware: app=%s version=%s build=%s board=%s\n",
        BOARD_MANAGER_FW_APP,
        BOARD_MANAGER_FW_VERSION,
        BOARD_MANAGER_FW_BUILD_ID,
        "m5stack_dial_v1_1");
    board_manager_emit_agent_handshake(
        &m5stack_dial_v1_1_descriptor,
        BOARD_MANAGER_FW_APP,
        BOARD_MANAGER_FW_VERSION,
        BOARD_MANAGER_FW_BUILD_ID);
    m5stack_dial_v1_1_init();
    printf("Board init complete for %s using %s\n",
        m5stack_dial_v1_1_descriptor.display_name,
        m5stack_dial_v1_1_descriptor.platform_sdk);

    board_manager_user_app_start(&context);
}
