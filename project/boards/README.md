# Board Definitions

Board definition JSON files in this folder are the source of truth for firmware-facing board metadata.

## Current Schema

Top-level fields:

- `boardId`: stable identifier used in generated artifact names
- `displayName`: human-readable name
- `revision`: board revision string
- `mcu.family`: MCU family such as `ESP32` or `STM32`
- `mcu.partNumber`: concrete MCU or module part number
- `capabilities`: host-visible capabilities such as `usb`, `uart`, and `jtag`
- `io`: list of board-level signals

Each `io` entry includes:

- `name`: board semantic signal name
- `kind`: `digital_input` or `digital_output`
- `logicalFunction`: higher-level purpose of the signal
- `mcuSignal`: MCU signal or GPIO name
- `mcuPin`: package/pad mapping used by the board
- `peripheral`: optional peripheral binding such as an EXTI line
- `activeLevel`: `high` or `low`

## Generation Contract

`project/scripts/generate-board-artifacts.mjs` converts these JSON files into:

- `project/generated/<boardId>.h`
- `project/generated/<boardId>.c`

Those generated files expose a common descriptor and board-specific init/read/write stubs.
