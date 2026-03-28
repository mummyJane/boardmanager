## Source of truth
- Read `notes/codex/10-spec.md` before planning or coding.
- Treat `notes/codex/10-spec.md` as the feature spec unless the user explicitly overrides it.

## Planning and task tracking
- Use `notes/codex/20-plan.md` for milestone planning.
- Read and Update `notes/codex/30-tasks.md` as tasks are completed.
- after each run the everything should be check in and tagged, `Task_<task_name>_<try at task>`

## Context
- Read and update `notes/codex/40-context.md` this is the full context

## Work log
- Append major decisions, commands run, failures, and fixes to `notes/codex/50-work-log.md`.

## Validation
- After each milestone, run the documented tests and record results in `notes/codex/50-work-log.md`.

## decisions
- all decision you make should be logged in `notes/codex/60-decisions.md`

## Spec updates
- if you think there should be a change in the spec or releases put them with a time and date, and why you think a change is needed in `notes/codex/70-spec-update.md`

## document
- if `Foam Central Workspace Helper` is able document all script code etc under the project in Foam Central.

## install script
- for each mile stone there should be a tag in the git repo
- an install script should be in the folder `install` with the tag name in name of the script
- an install script should take a system from any state (normally a new system) to a working state for the release
- there should be a script labelled latest to install the latest version

## update script
- an update script that will take the current setup to newer version
- the update script will be stored in a folder `update`
- the script will be name with the release name in it.
- there will be a script with the tag latest to bring the unit to the latest release
- there will be script to bring a unit to the latest test version.

## project
- the project files with be stored in the `project` folder

## keys
- signing and encription keys will be stored in the `keys` folder
