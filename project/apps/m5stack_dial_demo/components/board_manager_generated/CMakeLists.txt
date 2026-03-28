set(GENERATED_DIR "${CMAKE_CURRENT_LIST_DIR}/../../../../generated")
set(FIRMWARE_COMMON_DIR "${CMAKE_CURRENT_LIST_DIR}/../../../../firmware-common")

idf_component_register(
    SRCS
        "${GENERATED_DIR}/m5stack_dial_v1_1.c"
    INCLUDE_DIRS
        "${GENERATED_DIR}"
        "${FIRMWARE_COMMON_DIR}"
)
