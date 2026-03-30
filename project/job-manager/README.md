# Job Manager

This folder contains the first Milestone 3 job model and persisted job store.

## Scope

- define first-class Stage 3 jobs for `validate`, `build`, `program`, `run`, and `debug`
- persist job requests, current status, selected board or unit, logs, artifacts, and result summaries
- resolve jobs against project metadata so one board can host more than one app or deployment profile
- keep the initial store simple and local so later service APIs and the web UI can reuse the same records

## Current Files

- `schema/job-store.schema.json`: JSON schema for the persisted Stage 3 job store
- `data/jobs.json`: local persisted Stage 3 job records

## Job Model

Each job currently records:

- `jobId`: stable local job id such as `job-000001`
- `action`: one of `validate`, `build`, `program`, `run`, or `debug`
- `status`: one of `queued`, `running`, `succeeded`, `failed`, or `canceled`
- `request`: requested board id, unit id, target, firmware target, app id, platform, transport, and free-text reason
- `resolution`: the resolved board, unit, family, profile id, transport details, project id, app metadata, OTA policy, resolution source, presence state, and candidate boards or projects when the request is tied back to Stage 1 and Stage 2 data
- `logs`: paths for captured machine or operator logs
- `artifacts`: paths for output artifacts such as reports, binaries, or debug launch files
- `result`: final summary, optional report path, exit code, and pass result

## CLI Access

Use `job.ps1` as the first local wrapper for the Stage 3 job store.

Examples:

- `./job.ps1 -Command create -Action validate -Board m5stack_dial_v1_1 -Unit mac:c0:4e:30:13:2b:68 -Reason "Pre-flash board check"`
- `./job.ps1 -Command create -Action build -App m5stack_dial_secure_ota -Unit mac:c0:4e:30:13:2b:68 -Reason "Prepare signed secure OTA build"`
- `./job.ps1 -Command list`
- `./job.ps1 -Command list -Status queued -Format json`
- `./job.ps1 -Command update -Job job-000001 -Status running`

Current resolution behavior:

- `-App <projectId|appId>` resolves a concrete project profile first, then inherits its board, app root, firmware family, user-code root, stable API path, and OTA policy
- `-Unit <stableKey>` resolves the selected current unit to its matched board and family when possible
- `-Board <boardId> -Unit <stableKey>` verifies the unit and board agree before creating the job
- `-Board <boardId>` resolves to a unit only when exactly one present unit currently matches that board; otherwise job creation fails and the operator must choose the stable unit id explicitly
- when one board has more than one project profile, the resolution keeps `candidateProjectIds` so later build, run, and update flows can require an explicit project instead of guessing

## User-Code Boundary

Current project metadata now reserves:

- `app.userCodeRoot`: the directory where project-local user logic should live
- `app.stableApi`: the shared header that user code should treat as the stable boundary

Current firmware targets use a simple pattern:

- framework entry file such as `app_main.c` or `main.c`
- shared stable API in `project/firmware-common/board_user_api.h`
- reserved user module in `board_app_user.c` and `board_app_user.h`

That keeps generated board support and host tooling away from the user module while still giving later build, run, and OTA flows one stable place to hook into.

## Validation Contracts

Use `generate-validation-contracts.ps1` to regenerate the current board-validation contracts from Stage 1 board and part metadata.

Each generated contract currently defines:

- ordered validation phases driven by `board.bootSequence`
- controller checks first
- bus checks before dependent devices
- signal checks for board-local drive or read access
- device checks derived from reusable part validation hooks first, then part smoke-test contracts as fallback
- explicit check metadata, pass criteria, failure notes, hook metadata, and config payloads for later runtime validation and reporting

## Validation Runs

Use `validate-board.ps1` to capture current serial validation output from a selected unit and compare any `BoardManagerI2CScan:` lines against the generated validation contract.

Example:

- `./validate-board.ps1 -Board m5stack_dial_v1_1 -Unit mac:c0:4e:30:13:2b:68`

Current behavior:

- the runner resolves the selected unit from Stage 2 inventory data
- it captures serial output from the current transport port
- it parses `BoardManagerI2CScan:` lines by bus name
- it compares configured contract addresses against observed addresses
- it writes a JSON report under `project/job-manager/reports/` with identity, controller facts, firmware facts, signal samples, and health metrics where available
- the command exits non-zero when configured addresses are missing or unexpected addresses are observed

## Validation Report Shape

Current validation reports include:

- identity fields for board, stable unit id, transport, chip, MAC, serial, and firmware identity
- summary fields for overall pass, executed checks, failures, and warnings
- health placeholders for voltages, temperatures, and runner warnings
- ordered phase summaries copied from the contract
- per-check results with pass state, criteria, evidence, and failure notes
- raw captured lines for operator review and later parser improvements
- parsed controller, firmware, identity, and signal facts gathered from the board-agent, firmware, and diagnostic output

## Program Runs

Use `program.ps1` to flash a selected stable unit through the Stage 3 job model.

Example:

- `./program.ps1 -Platform esp32 -App m5stack_dial_demo -Board m5stack_dial_v1_1 -Unit mac:c0:4e:30:13:2b:68`

Current behavior:

- the runner creates a `program` job in `project/job-manager/data/jobs.json`
- it resolves the selected stable unit id to the current transport kind and port from Stage 2 inventory
- it captures flash tool stdout and stderr into a per-job log under `project/job-manager/logs`
- it writes a JSON program report under `project/job-manager/reports`
- it records success or failure, exit code, selected board, selected unit, and resolved transport endpoint in the persisted job record
- ESP32 flashing is wired through `idf.py flash`; STM32 program flow still fails cleanly as scaffolded-not-implemented

## Run Jobs

Use `run.ps1` to capture firmware console output from a selected stable unit through the Stage 3 job model.

Example:

- `./run.ps1 -Platform esp32 -App m5stack_cores3_gnss_demo -Board m5stack_cores3_gnss_v1 -Unit mac:48:27:e2:66:b0:04 -RunTimeoutSeconds 5`

Current behavior:

- the runner creates a `run` job in `project/job-manager/data/jobs.json`
- it resolves the selected stable unit id to the current transport port from Stage 2 inventory
- it captures serial console output for a bounded host-side duration
- it writes a per-job log under `project/job-manager/logs`
- it writes a JSON run report under `project/job-manager/reports`
- it records success or failure, exit code, selected board, selected unit, and captured line count in the persisted job record
- it streams captured console lines to the caller by default and still persists the same output for later web UI or service use

## Debug Jobs

Use `debug.ps1` to prepare reproducible GDB and IDE launch metadata for a selected stable unit.

Example:

- `./debug.ps1 -Platform esp32 -App m5stack_cores3_gnss_demo -Board m5stack_cores3_gnss_v1 -Unit mac:48:27:e2:66:b0:04`

Current behavior:

- the runner creates a `debug` job in `project/job-manager/data/jobs.json`
- it resolves the selected stable unit id to the matched board, project, and current transport details from Stage 2 inventory
- it checks that the build artifacts and symbol file already exist
- it emits an OpenOCD launch command, a GDB launch command, and IDE-friendly metadata
- it writes a per-job log under `project/job-manager/logs`
- it writes a JSON debug report under `project/job-manager/reports`
- it supports the current ESP32 and STM32 families using the local toolchain layout already under `project/`

## Service APIs

The shared HTTP service now exposes Stage 3 job data for the future web UI and remote callers.

Endpoints:

- `GET /api/jobs`
- `GET /api/job-log?job=job-000001`
- `GET /api/job-report?job=job-000001`
- `GET /api/job-artifacts?job=job-000001`

Current behavior:

- `/api/jobs` returns persisted job summaries with optional `job`, `action`, `status`, and `limit` filters
- `/api/job-log` returns the selected log entry plus a text tail for operator and UI views
- `/api/job-report` returns the parsed JSON report payload for the selected job
- `/api/job-artifacts` returns artifact metadata including kind, path, size, and existence

## Tests

Use 	est.ps1 to run the local regression suite.

Current Stage 3 coverage includes:

- validation-style parsing for bus-scan evidence and mismatch reporting
- job-store summary and result assertions
- service-data reads for job lists, log tails, parsed reports, and artifact metadata
- cleanup back to an empty local Stage 3 job store after the test run
