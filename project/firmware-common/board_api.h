#ifndef BOARD_MANAGER_BOARD_API_H
#define BOARD_MANAGER_BOARD_API_H

#include <stdbool.h>

typedef enum board_io_kind {
    BOARD_IO_DIGITAL_INPUT = 0,
    BOARD_IO_DIGITAL_OUTPUT = 1
} board_io_kind_t;

typedef struct board_io_descriptor {
    const char *name;
    board_io_kind_t kind;
    const char *logical_function;
    const char *mcu_signal;
    const char *mcu_pin;
    const char *peripheral;
    bool active_high;
} board_io_descriptor_t;

typedef struct board_descriptor {
    const char *board_id;
    const char *display_name;
    const char *revision;
    const char *mcu_family;
    const char *mcu_part_number;
    unsigned int io_count;
    const board_io_descriptor_t *io;
} board_descriptor_t;

#endif
