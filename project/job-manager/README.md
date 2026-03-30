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
