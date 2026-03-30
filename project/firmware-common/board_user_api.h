#ifndef BOARD_MANAGER_BOARD_USER_API_H
#define BOARD_MANAGER_BOARD_USER_API_H

#include "board_api.h"

typedef struct board_app_context {
    const board_descriptor_t *board;
    const char *project_id;
    const char *app_id;
    const char *app_version;
    const char *build_id;
} board_app_context_t;

#endif
