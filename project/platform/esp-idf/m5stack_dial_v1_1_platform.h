#ifndef M5STACK_DIAL_V1_1_PLATFORM_H
#define M5STACK_DIAL_V1_1_PLATFORM_H

#include <stdbool.h>

typedef struct {
    bool controller_ready;
    bool internal_i2c_ready;
    bool rtc_present;
    bool touch_present;
    bool rfid_present;
    bool display_spi_ready;
    bool display_command_path_ready;
    bool touch_interrupt_active;
    bool rfid_interrupt_active;
    bool encoder_phase_a;
    bool encoder_phase_b;
} m5stack_dial_v1_1_self_test_t;

void m5stack_dial_v1_1_platform_get_self_test(m5stack_dial_v1_1_self_test_t *result);

#endif
