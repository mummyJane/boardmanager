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
- `POST /api/stage4/module-create`
- `POST /api/stage4/module-compose`
- `/api/stage4/boards`
- `/api/stage4/boards/<boardId>`
- `/api/stage4/projects`
- `/api/stage4/projects/<projectId>`
- `/api/stage4/help?path=project/help/parts/bm8563.md`
- `/api/stage4/dashboard/inventory`
- `/api/stage4/dashboard/modules`

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
