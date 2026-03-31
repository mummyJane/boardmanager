#include <stdio.h>
#include <stdint.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "m5stack_dial_v1_1.h"
#include "m5stack_dial_v1_1_platform.h"
#include "board_app_user.h"

static const char *status_text(bool value)
{
    return value ? "PASS" : "FAIL";
}

static void print_self_test(const m5stack_dial_v1_1_self_test_t *result)
{
    printf("Dial smoke test summary\n");
    printf("  controller gpio path: %s\n", status_text(result->controller_ready));
    printf("  internal i2c bus: %s\n", status_text(result->internal_i2c_ready));
    printf("  rtc present: %s\n", status_text(result->rtc_present));
    printf("  touch present: %s\n", status_text(result->touch_present));
    printf("  rfid present: %s\n", status_text(result->rfid_present));
    printf("  display spi path: %s\n", status_text(result->display_spi_ready));
    printf("  display command path: %s\n", status_text(result->display_command_path_ready));
    printf("  touch irq active: %s\n", result->touch_interrupt_active ? "YES" : "NO");
    printf("  rfid irq active: %s\n", result->rfid_interrupt_active ? "YES" : "NO");
    printf("  encoder phases: A=%d B=%d\n", result->encoder_phase_a ? 1 : 0, result->encoder_phase_b ? 1 : 0);
}

static void print_i2c_scan(void)
{
    uint8_t addresses[8] = {0};
    const size_t count = m5stack_dial_v1_1_platform_scan_internal_i2c(addresses, 8);

    printf("BoardManagerI2CScan: bus=internal_i2c observed=");
    if (count == 0) {
        printf("none");
    } else {
        for (size_t index = 0; index < count && index < 8; index += 1) {
            if (index > 0) {
                printf(",");
            }
            printf("0x%02X", addresses[index]);
        }
    }
    printf("\n");
}

static void run_visual_and_audio_check(void)
{
    printf("Exercising backlight and buzzer\n");
    m5stack_dial_v1_1_lcd_backlight_set(false);
    vTaskDelay(pdMS_TO_TICKS(250));
    m5stack_dial_v1_1_lcd_backlight_set(true);
    vTaskDelay(pdMS_TO_TICKS(250));
    m5stack_dial_v1_1_buzzer_set(true);
    vTaskDelay(pdMS_TO_TICKS(120));
    m5stack_dial_v1_1_buzzer_set(false);
}

void board_manager_user_app_start(const board_app_context_t *context)
{
    m5stack_dial_v1_1_self_test_t result = {0};

    printf("Board Manager user app start: project=%s app=%s version=%s build=%s\n",
        context->project_id,
        context->app_id,
        context->app_version,
        context->build_id);

    m5stack_dial_v1_1_platform_get_self_test(&result);
    print_self_test(&result);
    print_i2c_scan();
    run_visual_and_audio_check();

    for (;;) {
        m5stack_dial_v1_1_platform_get_self_test(&result);
        print_i2c_scan();
        printf("Live inputs: touch_irq=%d rfid_irq=%d enc_a=%d enc_b=%d\n",
            result.touch_interrupt_active ? 1 : 0,
            result.rfid_interrupt_active ? 1 : 0,
            result.encoder_phase_a ? 1 : 0,
            result.encoder_phase_b ? 1 : 0);
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
