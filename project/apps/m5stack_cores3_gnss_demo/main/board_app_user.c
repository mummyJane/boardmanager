#include <stdio.h>
#include <stdint.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "m5stack_cores3_gnss_v1.h"
#include "m5stack_cores3_gnss_v1_platform.h"
#include "board_app_user.h"

static void print_i2c_scan(void)
{
    uint8_t addresses[8] = {0};
    const size_t count = m5stack_cores3_gnss_v1_platform_scan_internal_i2c(addresses, 8);

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

void board_manager_user_app_start(const board_app_context_t *context)
{
    printf("Board Manager user app start: project=%s app=%s version=%s build=%s\n",
        context->project_id,
        context->app_id,
        context->app_version,
        context->build_id);
    printf("GNSS PPS input path is mapped as %s on %s\n",
        m5stack_cores3_gnss_v1_descriptor.io[0].name,
        m5stack_cores3_gnss_v1_descriptor.io[0].mcu_signal);
    print_i2c_scan();

    for (;;) {
        print_i2c_scan();
        printf("Live GNSS PPS state: %d\n", m5stack_cores3_gnss_v1_gnss_pps_read() ? 1 : 0);
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}
