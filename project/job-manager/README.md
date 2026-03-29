# Job Manager

This folder contains the first Milestone 3 job model and persisted job store.

## Scope

- define first-class Stage 3 jobs for `validate`, `build`, `program`, `run`, and `debug`
- persist job requests, current status, selected board or unit, logs, artifacts, and result summaries
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
- `resolution`: the resolved board, unit, family, profile id, transport details, resolution source, presence state, and candidate boards when the request is tied back to Stage 1 and Stage 2 data
- `logs`: paths for captured machine or operator logs
- `artifacts`: paths for output artifacts such as reports, binaries, or debug launch files
- `result`: final summary, optional report path, exit code, and pass result

## CLI Access

Use `job.ps1` as the first local wrapper for the Stage 3 job store.

Examples:

- `./job.ps1 -Command create -Action validate -Board m5stack_dial_v1_1 -Unit mac:c0:4e:30:13:2b:68 -Reason "Pre-flash board check"`
- `./job.ps1 -Command list`
- `./job.ps1 -Command list -Status queued -Format json`
- `./job.ps1 -Command update -Job job-000001 -Status running`

Current resolution behavior:

- `-Unit <stableKey>` resolves the selected current unit to its matched board and family when possible
- `-Board <boardId> -Unit <stableKey>` verifies the unit and board agree before creating the job
- `-Board <boardId>` resolves to a unit only when exactly one present unit currently matches that board; otherwise job creation fails and the operator must choose the stable unit id explicitly

The first pass is intentionally local and dependency-free. Later Milestone 3 tasks will add report payloads, build logs, run logs, debug metadata, and service APIs on top of this store.

## Validation Contracts

Use `generate-validation-contracts.ps1` to regenerate the current board-validation contracts from Stage 1 board and part metadata.

Each generated contract currently defines:

- ordered validation phases driven by `board.bootSequence`
- controller checks first
- bus checks before dependent devices
- signal checks for board-local drive or read access
- device checks derived from reusable part smoke-test contracts
- explicit check metadata, pass criteria, failure notes, and config payloads for later runtime validation and reporting
