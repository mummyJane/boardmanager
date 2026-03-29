# Board Definitions

Board definition JSON files in this folder are the source of truth for board assembly and local bindings.

## Current Schema

Top-level fields:

- `boardId`: stable identifier used in generated artifact names
- `displayName`: human-readable name
- `revision`: board revision string
- `vendor`: board vendor name
- `productSku`: vendor SKU where known
- `controller.moduleId`: reusable controller module reference
- `capabilities`: host-visible capabilities such as `usb`, `wifi`, `touch`, and `rfid`
- `power`: board-specific power-control notes and key signals
- `signals`: board-local semantic signals mapped onto reusable controller signals
- `buses`: grouped internal or exposed bus definitions with attached part references
- `bootSequence`: ordered setup steps for controller, buses, devices, and signal states
- `connectors`: physical expansion connector definitions
- `sources`: vendor reference URLs that back the board definition

Each `signals` entry includes:

- `name`: board semantic signal name
- `kind`: `digital_input` or `digital_output`
- `logicalFunction`: higher-level purpose of the signal
- `controllerSignal`: reusable controller signal name such as `GPIO46`
- `peripheral`: optional local role or device binding
- `activeLevel`: `high` or `low`

## Reusable Parts

Boards reference reusable parts under `project/parts`.

Typical resolution chain:

- board -> controller module
- controller module -> package
- package -> MCU family
- board buses -> attached device parts

## Generation Contract

`project/scripts/generate-board-artifacts.mjs` resolves a board assembly into:

- `project/generated/<boardId>.h`
- `project/generated/<boardId>.c`

Those generated files expose a common descriptor and board-specific init/read/write stubs using the resolved MCU family, package, platform SDK, and boot sequence.

## Current Concrete Coverage

- `m5stack_dial_v1_1`: M5Stack Dial V1.1
- `m5stack_cores3_gnss_v1`: CoreS3 bench unit with attached GNSS module
- `p_nucleo_usb001_f072rb_v1`: P-NUCLEO-USB001 bench unit based on Nucleo-F072RB
- `esp32_dev_relay_v1` and `stm32_nucleo_io_v1`: generic sample boards retained for generator and platform bring-up

Board-level help pages for the current real boards live under `project/help/boards/`.
