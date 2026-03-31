# Stage 4 Web UI Model

This folder holds the first Stage 4 tree model that the later web interface and service layer will consume.

## Runtime Direction

- the Milestone 4 web server should be Python-based
- existing Node.js scripts may still generate or validate model artifacts during the transition
- the web server should serve stable JSON derived from this model rather than reconstructing tree views ad hoc in the browser

## Current Artifacts

- `data/stage4-tree-model.json`: generated tree snapshot built from the current board, part, project, and help definitions
- `schema/stage4-tree-model.schema.json`: shape definition for the generated tree snapshot

## Tree Structure

The Stage 4 model is rooted in three main areas:

- `modules-root`: reusable modules and device-level catalog entries
- `boards-root`: board assemblies with controller, buses, devices, signals, connectors, and help references
- `projects-root`: deployable board-targeted projects with build and deployment metadata

The current model is intentionally UI-oriented:

- modules are a common catalog abstraction over the current reusable `parts/modules` and `parts/devices` definitions
- boards remain board assemblies with local wiring and configuration
- projects remain board-targeted build/run definitions
- the generated tree preserves source paths and help references so the later Python service can expose both the tree and raw source links

## Generation And Validation

- Generate with `node project/scripts/generate-stage4-tree-model.mjs`
- Validate with `node project/scripts/validate-stage4-tree-model.mjs`
- `validate.ps1` now includes Stage 4 tree-model validation in the standard repo validation flow
## Python Read API

The first Python Stage 4 read-only API is served by:

- `project/scripts/stage4-read-api.py`
- `serve-stage4-read-api.ps1`

Current endpoints:

- `/health`
- `/api/stage4/tree`
- `/api/stage4/modules`
- `/api/stage4/modules/<moduleId>`
- `/api/stage4/module-help/<moduleId>`
- `/api/stage4/module-edit/<moduleId>`
- `POST /api/stage4/module-validate`
- `POST /api/stage4/module-create`
- `POST /api/stage4/module-compose`
- `PUT /api/stage4/modules/<moduleId>`
- `/api/stage4/boards`
- `/api/stage4/boards/<boardId>`
- `/api/stage4/projects`
- `/api/stage4/projects/<projectId>`
- `/api/stage4/help?path=project/help/parts/bm8563.md`
- `/api/stage4/dashboard/inventory`
- `/api/stage4/dashboard/modules`
- `/api/stage4/dashboard/boards`
- `/api/stage4/board-detail/<boardId>`
- `/api/stage4/board-create-candidates`
- `/api/stage4/board-create-guess/<unitId>`
- `POST /api/stage4/board-create-from-unit`
- `/api/stage4/board-create-manual-options`
- `POST /api/stage4/board-create-manual`

The Python API reads the generated tree model and linked help files directly. It is read-only and is intended to be the base for the later full Milestone 4 web server.
## Web Shell

The first served Stage 4 shell is now a static Python-hosted app under `project/web-ui/app`.

Files:

- `project/web-ui/app/index.html`
- `project/web-ui/app/stage4-shell.css`
- `project/web-ui/app/stage4-shell.js`

The shell currently provides top-level navigation for:

- inventory
- modules
- boards
- projects
- jobs
- reports

The shell is intentionally thin at this stage:

- modules, boards, and projects already load from the Python Stage 4 read APIs
- inventory, jobs, and reports are reserved navigation targets that will be filled by the next Stage 4 tasks
The inventory dashboard endpoint merges:

- current Stage 2 inventory data
- Stage 2 history conflict and override state
- recent Stage 3 validation reports
- recent Stage 3 job activity

The module catalog endpoint merges the generated tree model into a module-focused view with vendor counts, role counts, help-reference coverage, composition coverage, and per-module summary rows for the shell Modules tab.

The module-help endpoint returns one module-focused detail payload with linked references, declared high-level API entries, default config, and any local markdown help documents so the shell can render help content without rebuilding it from raw tree nodes.

The first write flow is intentionally narrow: `POST /api/stage4/module-create` accepts a user-defined leaf module payload, writes the new device definition plus its local help page, regenerates the Stage 4 tree, and returns the created module detail back to the shell.

The Modules view now has two narrow write flows:

- `POST /api/stage4/module-create` for user-defined leaf modules
- `POST /api/stage4/module-compose` for user-defined composed modules with child-module rows and module-level default config

Existing composed catalog entries also normalize older composition metadata into child-module rows so the shell can browse them consistently.

The first generic-safe module update layer is now available through:

- `GET /api/stage4/module-edit/<moduleId>` for a write-oriented editable payload
- `PUT /api/stage4/modules/<moduleId>` for guarded updates

Module validation now has a dedicated preflight endpoint:

- `POST /api/stage4/module-validate`

Validation behavior:

- validates both leaf-module and composed-module payloads
- returns `valid`, `errors`, `warnings`, `moduleKind`, and the normalized payload shape
- is reused by create and update flows before any files are written

Safety rules:

- only modules with `origin: user` are editable through the update API
- catalog-owned modules remain readable but reject write attempts
- successful writes always regenerate the Stage 4 tree before returning updated module data

The Boards view now consumes two board-focused read contracts:

- `/api/stage4/dashboard/boards` for the board catalog summary
- `/api/stage4/board-detail/<boardId>` for one board assembly detail payload

The board detail payload includes module instances, buses, signals, connectors, boot order, generated board artifact paths, references, and linked local help markdown.

The first board-create flow is discovery-assisted:

- `/api/stage4/board-create-candidates` lists current discovered units that can seed a draft
- `/api/stage4/board-create-guess/<unitId>` returns the first-guess board definition based on match/profile evidence
- `POST /api/stage4/board-create-from-unit` writes a new board definition and local help page, then regenerates the Stage 4 tree

The first guess clones an exact or candidate board definition when possible, and otherwise falls back to a minimal generic board skeleton based on the observed chip family.

The first manual board-create flow supports two modes:

- blank-board creation with a selected controller module
- template-backed creation cloned from an existing board definition

The manual options endpoint returns available board templates plus controller-module choices for the blank-board path.

- `/api/stage4/board-edit/<boardId>` returns the persisted board-definition fields plus controller/module options for the Boards-tab editor.
- `PUT /api/stage4/boards/<boardId>` updates the board definition and local help markdown, then regenerates the Stage 4 tree.
- The Boards tab now includes a first board editor for board-local metadata, controller selection, capabilities, power, signals, buses, connectors, boot sequence, sources, and help markdown.

- `POST /api/stage4/board-validate` runs the existing Stage 3 board validation flow for a selected board/unit pair and returns the latest summarized report.
- Board detail payloads now include attached-unit validation candidates, the latest validation summary, and failing-check details so the Boards tab can show mismatches directly.

- `/api/stage4/dashboard/projects` returns the aggregated project catalog used by the Projects tab.
- `/api/stage4/project-detail/<projectId>` returns the selected-project detail payload for board target, app roots, firmware target, deployment policy, OTA policy, security classification, and override maps.


The Projects tab now has a first create/edit flow through the Python service:

- `/api/stage4/project-edit-options` returns board choices plus firmware/security/OTA option lists for the form.
- `/api/stage4/project-edit/<projectId>` returns a write-oriented project payload for the selected project.
- `POST /api/stage4/project-validate` validates a project payload before write and returns normalized shape, errors, and warnings.
- `POST /api/stage4/project-create` creates a user-owned project definition and scaffolds minimal app-root files when needed.
- `PUT /api/stage4/projects/<projectId>` updates an existing user-owned project definition safely.

The first project editor supports:

- selected board target
- app layout and stable API path
- firmware family and entrypoint
- OTA transports, signing, encryption, and security classification
- explicit code-root metadata for SDK code, third-party component code, and module code
- part and signal override maps

Safety rules:

- only `origin: user` projects are editable through the update API
- catalog projects remain readable but reject write attempts
- create/update flows regenerate the Stage 4 tree before returning refreshed payloads
- create/update flows keep the repo-validation contract intact by scaffolding the minimal reserved user-code files when a new project app root does not exist yet


The Jobs tab now has a first launch/monitor flow through the Python service:

- `/api/stage4/dashboard/jobs` returns recent Stage 3 job summaries plus project and unit choices for the Jobs tab.
- `POST /api/stage4/job-launch` launches one of the existing Stage 3 actions: `build`, `program`, `run`, or `debug`.

The Jobs tab now also consumes:

- `/api/stage4/job-detail/<jobId>` for the selected job summary plus linked log/report/artifact payloads
- `/api/stage4/job-log/<jobId>` for bounded log-tail reads
- `/api/stage4/job-report/<jobId>` for the parsed job report JSON
- `/api/stage4/job-artifacts/<jobId>` for artifact path and existence metadata

Current behavior:

- build uses the selected project and board target, and may optionally carry a selected stable unit id
- program, run, and debug require a selected stable unit id
- the Python service delegates to the existing top-level PowerShell Stage 3 runners rather than reimplementing tool orchestration
- the Jobs tab currently shows recent job summary state; deeper log, report, and artifact views remain the next Stage 4 task
