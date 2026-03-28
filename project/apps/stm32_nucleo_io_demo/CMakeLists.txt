cmake_minimum_required(VERSION 3.24)
project(stm32_nucleo_io_demo C ASM)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

if(NOT DEFINED BOARD_MANAGER_PROJECT_ROOT)
    get_filename_component(BOARD_MANAGER_PROJECT_ROOT "${CMAKE_CURRENT_LIST_DIR}/../.." ABSOLUTE)
endif()

if(NOT DEFINED BOARD_MANAGER_BOARD)
    set(BOARD_MANAGER_BOARD stm32_nucleo_io_v1)
endif()

if(NOT DEFINED STM32CUBE_F4_ROOT)
    message(FATAL_ERROR "STM32CUBE_F4_ROOT was not provided")
endif()

set(GENERATED_DIR "${BOARD_MANAGER_PROJECT_ROOT}/generated")
set(FIRMWARE_COMMON_DIR "${BOARD_MANAGER_PROJECT_ROOT}/firmware-common")
set(PLATFORM_DIR "${BOARD_MANAGER_PROJECT_ROOT}/platform/stm32cube")
set(APP_DIR "${CMAKE_CURRENT_LIST_DIR}")
set(HAL_DRIVER_DIR "${STM32CUBE_F4_ROOT}/Drivers/STM32F4xx_HAL_Driver")
set(CMSIS_DIR "${STM32CUBE_F4_ROOT}/Drivers/CMSIS")
set(CMSIS_DEVICE_DIR "${CMSIS_DIR}/Device/ST/STM32F4xx")
set(LINKER_SCRIPT "${APP_DIR}/stm32f446retx_flash.ld")

add_executable(${PROJECT_NAME}
    main/main.c
    ${GENERATED_DIR}/stm32_nucleo_io_v1.c
    ${PLATFORM_DIR}/stm32_nucleo_io_v1_platform.c
    ${HAL_DRIVER_DIR}/Src/stm32f4xx_hal.c
    ${HAL_DRIVER_DIR}/Src/stm32f4xx_hal_cortex.c
    ${HAL_DRIVER_DIR}/Src/stm32f4xx_hal_flash.c
    ${HAL_DRIVER_DIR}/Src/stm32f4xx_hal_flash_ex.c
    ${HAL_DRIVER_DIR}/Src/stm32f4xx_hal_gpio.c
    ${HAL_DRIVER_DIR}/Src/stm32f4xx_hal_pwr.c
    ${HAL_DRIVER_DIR}/Src/stm32f4xx_hal_pwr_ex.c
    ${HAL_DRIVER_DIR}/Src/stm32f4xx_hal_rcc.c
    ${HAL_DRIVER_DIR}/Src/stm32f4xx_hal_rcc_ex.c
    ${CMSIS_DEVICE_DIR}/Source/Templates/system_stm32f4xx.c
    ${CMSIS_DEVICE_DIR}/Source/Templates/gcc/startup_stm32f446xx.s
)

target_include_directories(${PROJECT_NAME} PRIVATE
    ${APP_DIR}/main
    ${GENERATED_DIR}
    ${FIRMWARE_COMMON_DIR}
    ${PLATFORM_DIR}
    ${HAL_DRIVER_DIR}/Inc
    ${CMSIS_DIR}/Include
    ${CMSIS_DEVICE_DIR}/Include
)

target_compile_definitions(${PROJECT_NAME} PRIVATE
    USE_HAL_DRIVER
    STM32F446xx
)

target_compile_options(${PROJECT_NAME} PRIVATE
    -mcpu=cortex-m4
    -mthumb
    -ffunction-sections
    -fdata-sections
    -fno-common
    -Wall
    -Wextra
    -Wno-unused-parameter
)

target_link_options(${PROJECT_NAME} PRIVATE
    -mcpu=cortex-m4
    -mthumb
    -Wl,--gc-sections
    -Wl,-Map=${PROJECT_NAME}.map
    -T${LINKER_SCRIPT}
    --specs=nano.specs
    --specs=nosys.specs
)

add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
    COMMAND ${CMAKE_OBJCOPY} -O binary $<TARGET_FILE:${PROJECT_NAME}> ${PROJECT_NAME}.bin
    COMMAND ${CMAKE_SIZE} $<TARGET_FILE:${PROJECT_NAME}>
)
