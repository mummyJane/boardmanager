set(GENERATED_DIR "${CMAKE_CURRENT_LIST_DIR}/../../../../generated")
set(FIRMWARE_COMMON_DIR "${CMAKE_CURRENT_LIST_DIR}/../../../../firmware-common")
set(PLATFORM_DIR "${CMAKE_CURRENT_LIST_DIR}/../../../../platform/esp-idf")

idf_component_register(
    SRCS
        "${GENERATED_DIR}/m5stack_dial_v1_1.c"
        "${PLATFORM_DIR}/m5stack_dial_v1_1_platform.c"
    INCLUDE_DIRS
        "${GENERATED_DIR}"
        "${FIRMWARE_COMMON_DIR}"
    REQUIRES
        esp_driver_gpio
        esp_driver_i2c
        esp_driver_spi
)
