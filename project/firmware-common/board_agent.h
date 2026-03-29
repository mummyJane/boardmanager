#ifndef BOARD_MANAGER_BOARD_AGENT_H
#define BOARD_MANAGER_BOARD_AGENT_H

#include <stdio.h>

#include "board_api.h"

static inline void board_manager_emit_agent_handshake(
    const board_descriptor_t *descriptor,
    const char *app,
    const char *version,
    const char *build_id)
{
    const char *board_id = descriptor && descriptor->board_id ? descriptor->board_id : "unknown";
    const char *firmware_app = app ? app : "unknown";
    const char *firmware_version = version ? version : "unknown";
    const char *firmware_build = build_id ? build_id : "unknown";

    printf(
        "BoardManagerAgent: board=%s app=%s version=%s capabilities=",
        board_id,
        firmware_app,
        firmware_version);

    if (descriptor && descriptor->capability_count > 0 && descriptor->capabilities) {
        for (unsigned int index = 0; index < descriptor->capability_count; index += 1) {
            if (index > 0) {
                printf(",");
            }
            printf("%s", descriptor->capabilities[index]);
        }
    } else {
        printf("none");
    }

    printf(" build=%s\n", firmware_build);
}

#endif