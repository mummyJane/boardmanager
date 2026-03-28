# Board Definitions

Board definition JSON files in this folder are the source of truth for firmware-facing board metadata.

## Current Schema

Top-level fields:

- `boardId`: stable identifier used in generated artifact names
- `displayName`: human-readable name
- `revision`: board revision string
- `vendor`: board vendor name
- `productSku`: vendor SKU where known
- `mcu.family`: MCU family such as `ESP32`, `ESP32-S3`, or `STM32`
- `mcu.partNumber`: concrete MCU or module part number
- `capabilities`: host-visible capabilities such as `usb`, `wifi`, `touch`, and `rfid`
- `power`: board-specific power-control notes and key pins
- `io`: list of board-level control and status signals
- `buses`: grouped internal or exposed bus definitions
- `connectors`: physical expansion connector definitions

Each `io` entry includes:

- `name`: board semantic signal name
- `kind`: `digital_input` or `digital_output`
- `logicalFunction`: higher-level purpose of the signal
- `mcuSignal`: MCU signal or GPIO name
- `mcuPin`: package/pad mapping used by the board
- `peripheral`: optional peripheral binding such as an interrupt line or device role
- `activeLevel`: `high` or `low`

## Generation Contract

`project/scripts/generate-board-artifacts.mjs` converts the `io` portion of these JSON files into:

- `project/generated/<boardId>.h`
- `project/generated/<boardId>.c`

Those generated files expose a common descriptor and board-specific init/read/write stubs.

## First Real Board

`m5stack_dial_v1_1.json` is the first concrete board profile built from the official M5Stack Dial documentation and pin map.
