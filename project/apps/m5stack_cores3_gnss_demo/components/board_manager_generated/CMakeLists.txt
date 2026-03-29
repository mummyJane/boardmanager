set(GENERATED_DIR "${CMAKE_CURRENT_LIST_DIR}/../../../../generated")
set(FIRMWARE_COMMON_DIR "${CMAKE_CURRENT_LIST_DIR}/../../../../firmware-common")
set(PLATFORM_DIR "${CMAKE_CURRENT_LIST_DIR}/../../../../platform/esp-idf")

if(NOT DEFINED BOARD_MANAGER_BOARD)
    set(BOARD_MANAGER_BOARD m5stack_dial_v1_1)
endif()

set(BOARD_MANAGER_GENERATED_SOURCE "${GENERATED_DIR}/${BOARD_MANAGER_BOARD}.c")
set(BOARD_MANAGER_PLATFORM_SOURCE "${PLATFORM_DIR}/${BOARD_MANAGER_BOARD}_platform.c")

if(NOT EXISTS "${BOARD_MANAGER_GENERATED_SOURCE}")
    message(FATAL_ERROR "Generated board source not found: ${BOARD_MANAGER_GENERATED_SOURCE}")
endif()

if(NOT EXISTS "${BOARD_MANAGER_PLATFORM_SOURCE}")
    message(FATAL_ERROR "Platform board source not found: ${BOARD_MANAGER_PLATFORM_SOURCE}")
endif()

set(BOARD_MANAGER_REQUIRES
    esp_driver_gpio
    esp_driver_i2c
    esp_driver_spi
    esp_driver_uart
)

idf_component_register(
    SRCS
        "${BOARD_MANAGER_GENERATED_SOURCE}"
        "${BOARD_MANAGER_PLATFORM_SOURCE}"
    INCLUDE_DIRS
        "${GENERATED_DIR}"
        "${FIRMWARE_COMMON_DIR}"
        "${PLATFORM_DIR}"
    REQUIRES
        ${BOARD_MANAGER_REQUIRES}
)
