#include <stdio.h>
#include <stdint.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "m5stack_cores3_gnss_v1.h"
#include "m5stack_cores3_gnss_v1_platform.h"
#include "board_agent.h"

#define BOARD_MANAGER_FW_APP "m5stack_cores3_gnss_demo"
#define BOARD_MANAGER_FW_VERSION "0.1.0-dev"
#define BOARD_MANAGER_FW_BUILD_ID __DATE__ " " __TIME__

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

void app_main(void)
{
    printf("Board Manager CoreS3 GNSS bring-up starting\n");
    printf("BoardManagerFirmware: app=%s version=%s build=%s board=%s\n",
        BOARD_MANAGER_FW_APP,
        BOARD_MANAGER_FW_VERSION,
        BOARD_MANAGER_FW_BUILD_ID,
        "m5stack_cores3_gnss_v1");
    board_manager_emit_agent_handshake(
        &m5stack_cores3_gnss_v1_descriptor,
        BOARD_MANAGER_FW_APP,
        BOARD_MANAGER_FW_VERSION,
        BOARD_MANAGER_FW_BUILD_ID);
    m5stack_cores3_gnss_v1_init();
    printf("Board init complete for %s using %s\n",
        m5stack_cores3_gnss_v1_descriptor.display_name,
        m5stack_cores3_gnss_v1_descriptor.platform_sdk);
    printf("GNSS PPS input path is mapped as %s on %s\n",
        m5stack_cores3_gnss_v1_descriptor.io[0].name,
        m5stack_cores3_gnss_v1_descriptor.io[0].mcu_signal);
    print_i2c_scan();

    for (;;) {
        printf("Live GNSS PPS state: %d\n", m5stack_cores3_gnss_v1_gnss_pps_read() ? 1 : 0);
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

