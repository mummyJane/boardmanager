#include "m5stack_cores3_gnss_v1.h"
#include <stddef.h>

void m5stack_cores3_gnss_v1_platform_boot_controller(void);
void m5stack_cores3_gnss_v1_platform_boot_internal_i2c(void);
void m5stack_cores3_gnss_v1_platform_boot_rtc(void);
void m5stack_cores3_gnss_v1_platform_boot_pmu(void);
void m5stack_cores3_gnss_v1_platform_boot_gnss_uart(void);
void m5stack_cores3_gnss_v1_platform_boot_gnss_module(void);
bool m5stack_cores3_gnss_v1_platform_gnss_pps_read(void);

static void m5stack_cores3_gnss_v1_boot_controller(void)
{
    m5stack_cores3_gnss_v1_platform_boot_controller();
}

static void m5stack_cores3_gnss_v1_boot_internal_i2c(void)
{
    m5stack_cores3_gnss_v1_platform_boot_internal_i2c();
}

static void m5stack_cores3_gnss_v1_boot_rtc(void)
{
    m5stack_cores3_gnss_v1_platform_boot_rtc();
}

static void m5stack_cores3_gnss_v1_boot_pmu(void)
{
    m5stack_cores3_gnss_v1_platform_boot_pmu();
}

static void m5stack_cores3_gnss_v1_boot_gnss_uart(void)
{
    m5stack_cores3_gnss_v1_platform_boot_gnss_uart();
}

static void m5stack_cores3_gnss_v1_boot_gnss_module(void)
{
    m5stack_cores3_gnss_v1_platform_boot_gnss_module();
}

static const board_io_descriptor_t m5stack_cores3_gnss_v1_io[] = {
    { "gnss_pps", BOARD_IO_DIGITAL_INPUT, "gnss_pulse_per_second", "GPIO8", "G8", "GNSS_PPS", true },
};

const board_descriptor_t m5stack_cores3_gnss_v1_descriptor = {
    "m5stack_cores3_gnss_v1",
    "M5Stack CoreS3 + GNSS Module",
    "1.0",
    "ESP32-S3",
    "ESP32-S3FN16",
    "esp-idf",
    1,
    m5stack_cores3_gnss_v1_io
};

void m5stack_cores3_gnss_v1_init(void)
{
    /* Boot sequence generated for esp-idf. */
    m5stack_cores3_gnss_v1_boot_controller();
    m5stack_cores3_gnss_v1_boot_internal_i2c();
    m5stack_cores3_gnss_v1_boot_rtc();
    m5stack_cores3_gnss_v1_boot_pmu();
    m5stack_cores3_gnss_v1_boot_gnss_uart();
    m5stack_cores3_gnss_v1_boot_gnss_module();
}

bool m5stack_cores3_gnss_v1_gnss_pps_read(void)
{
    return m5stack_cores3_gnss_v1_platform_gnss_pps_read();
}
