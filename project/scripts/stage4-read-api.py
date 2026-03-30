import argparse
import json
import re
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
REPO_ROOT = PROJECT_ROOT.parent
TREE_MODEL_PATH = PROJECT_ROOT / "web-ui" / "data" / "stage4-tree-model.json"
WEB_APP_ROOT = PROJECT_ROOT / "web-ui" / "app"
DEVICE_MANAGER_DATA_ROOT = PROJECT_ROOT / "device-manager" / "data"
JOB_MANAGER_DATA_ROOT = PROJECT_ROOT / "job-manager" / "data"
JOB_MANAGER_REPORTS_ROOT = PROJECT_ROOT / "job-manager" / "reports"
PARTS_DEVICES_ROOT = PROJECT_ROOT / "parts" / "devices"
HELP_PARTS_ROOT = PROJECT_ROOT / "help" / "parts"
STAGE4_GENERATOR_PATH = PROJECT_ROOT / "scripts" / "generate-stage4-tree-model.mjs"
MODULE_ID_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")


def read_json(file_path, fallback):
    try:
        return json.loads(file_path.read_text(encoding="utf-8"))
    except Exception:
        return fallback


def load_tree_model():
    return json.loads(TREE_MODEL_PATH.read_text(encoding="utf-8"))


def load_static_asset(relative_name):
    asset_path = (WEB_APP_ROOT / relative_name).resolve()
    web_root = WEB_APP_ROOT.resolve()
    if asset_path != web_root and web_root not in asset_path.parents:
        raise FileNotFoundError("static asset outside web root")
    if not asset_path.exists() or not asset_path.is_file():
        raise FileNotFoundError(f"asset '{relative_name}' not found")
    return asset_path


def find_root(model, root_id):
    for root in model.get("roots", []):
        if root.get("nodeId") == root_id:
            return root
    return None


def find_node_by_id(node, node_id):
    if node.get("nodeId") == node_id:
        return node
    for child in node.get("children", []):
        result = find_node_by_id(child, node_id)
        if result is not None:
            return result
    return None


def iter_nodes(node):
    yield node
    for child in node.get("children", []):
        yield from iter_nodes(child)


def normalize_id(prefix, value):
    if value.startswith(prefix):
        return value
    return f"{prefix}{value}"


def load_help_text(relative_path):
    if not relative_path:
        raise FileNotFoundError("help path missing")
    candidate = (REPO_ROOT / relative_path).resolve()
    repo_root = REPO_ROOT.resolve()
    if candidate != repo_root and repo_root not in candidate.parents:
        raise FileNotFoundError("help path outside repo")
    return candidate.read_text(encoding="utf-8"), str(candidate.relative_to(REPO_ROOT)).replace("\\", "/")


def load_inventory():
    return read_json(DEVICE_MANAGER_DATA_ROOT / "inventory.json", {"generatedAt": None, "host": {}, "units": []})


def load_history():
    return read_json(DEVICE_MANAGER_DATA_ROOT / "unit-history.json", {"generatedAt": None, "host": {}, "units": [], "families": [], "conflicts": []})


def load_jobs():
    return read_json(JOB_MANAGER_DATA_ROOT / "jobs.json", {"generatedAt": None, "jobs": [], "nextJobSequence": 1})


def load_validation_reports():
    reports = []
    if not JOB_MANAGER_REPORTS_ROOT.exists():
        return reports
    for file_path in sorted(JOB_MANAGER_REPORTS_ROOT.glob("validation-*.json")):
        report = read_json(file_path, None)
        if report is None:
            continue
        report["__fileName"] = file_path.name
        reports.append(report)
    reports.sort(key=lambda item: item.get("generatedAt") or "", reverse=True)
    return reports


def module_paths(module_id):
    return {
        "part": PARTS_DEVICES_ROOT / f"{module_id}.json",
        "help": HELP_PARTS_ROOT / f"{module_id}.md",
    }


def regenerate_stage4_tree_model():
    result = subprocess.run(
        ["node", str(STAGE4_GENERATOR_PATH)],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout or "stage4 tree generation failed").strip())
    return result.stdout.strip()


def normalize_leaf_module_payload(payload):
    if not isinstance(payload, dict):
        raise ValueError("module payload must be a JSON object")

    module_id = str(payload.get("moduleId") or "").strip()
    if not MODULE_ID_PATTERN.match(module_id):
        raise ValueError("moduleId must match ^[a-z][a-z0-9_]*$")

    display_name = str(payload.get("displayName") or "").strip()
    if not display_name:
        raise ValueError("displayName is required")

    vendor = str(payload.get("vendor") or "").strip()
    if not vendor:
        raise ValueError("vendor is required")

    interfaces = []
    for value in payload.get("interfaces") or []:
        entry = str(value or "").strip()
        if entry and entry not in interfaces:
            interfaces.append(entry)

    default_config = {}
    raw_default_config = payload.get("defaultConfig") or {}
    if not isinstance(raw_default_config, dict):
        raise ValueError("defaultConfig must be an object")
    for key, value in raw_default_config.items():
        config_key = str(key or "").strip()
        if not config_key:
            continue
        if not isinstance(value, (str, int, float, bool)) and value is not None:
            raise ValueError(f"defaultConfig '{config_key}' must be a scalar value")
        default_config[config_key] = value

    raw_docs = payload.get("docs") or {}
    if not isinstance(raw_docs, dict):
        raise ValueError("docs must be an object")
    website = str(raw_docs.get("website") or "").strip() or None
    datasheet = str(raw_docs.get("datasheet") or "").strip() or None

    api_entries = []
    raw_api = payload.get("api") or []
    if not isinstance(raw_api, list):
        raise ValueError("api must be an array")
    for entry in raw_api:
        if not isinstance(entry, dict):
            raise ValueError("api entries must be objects")
        name = str(entry.get("name") or "").strip()
        description = str(entry.get("description") or "").strip()
        if not name:
            continue
        api_entries.append({"name": name, "description": description})

    help_markdown = str(payload.get("helpMarkdown") or "").strip()

    return {
        "moduleId": module_id,
        "displayName": display_name,
        "vendor": vendor,
        "interfaces": interfaces,
        "defaultConfig": default_config,
        "docs": {
            "website": website,
            "datasheet": datasheet,
            "apiGuide": f"project/help/parts/{module_id}.md",
        },
        "api": api_entries,
        "helpMarkdown": help_markdown,
    }


def build_leaf_module_help_markdown(payload):
    lines = [
        f"# {payload['displayName']}",
        "",
        "## Summary",
        "",
        f"`{payload['moduleId']}` is a user-defined leaf module created through the Board Manager Stage 4 web flow.",
        "",
        "## Interface",
        "",
    ]
    if payload["interfaces"]:
        lines.extend([f"- interface: `{entry}`" for entry in payload["interfaces"]])
    else:
        lines.append("- no interfaces declared yet")

    lines.extend(["", "## Default Config", ""])
    if payload["defaultConfig"]:
        lines.extend([f"- `{key}`: `{value}`" for key, value in payload["defaultConfig"].items()])
    else:
        lines.append("- no default config declared")

    lines.extend(["", "## High-Level API Usage", ""])
    if payload["api"]:
        lines.extend([f"- `{entry['name']}`: {entry['description'] or 'user-defined API entry'}" for entry in payload["api"]])
    else:
        lines.append("- add project-local API notes here")

    lines.extend(["", "## References", ""])
    if payload["docs"]["website"]:
        lines.append(f"- Website: [{payload['displayName']}]({payload['docs']['website']})")
    if payload["docs"]["datasheet"]:
        lines.append(f"- Datasheet: [Reference PDF]({payload['docs']['datasheet']})")
    if not payload["docs"]["website"] and not payload["docs"]["datasheet"]:
        lines.append("- add vendor and datasheet links here")

    return "\n".join(lines) + "\n"


def build_leaf_module_definition(payload):
    init_steps = []
    smoke_checks = []
    if payload["interfaces"]:
        init_steps.append("Initialize or bind the declared module interfaces before higher-level use.")
        smoke_checks.append("Confirm the declared interfaces can be reached through the selected board mapping.")
    if "i2c" in payload["interfaces"] and payload["defaultConfig"].get("i2cAddress"):
        init_steps.append("Probe the configured I2C address before enabling higher-level features.")
        smoke_checks.append("Probe the configured I2C address and confirm the module acknowledges.")
    if not init_steps:
        init_steps.append("Apply any module-local setup required before higher-level use.")
    if not smoke_checks:
        smoke_checks.append("Confirm the module can be reached through its declared interface path.")

    return {
        "partId": payload["moduleId"],
        "partType": "device",
        "displayName": payload["displayName"],
        "vendor": payload["vendor"],
        "origin": "user",
        "interfaces": payload["interfaces"],
        "defaultConfig": payload["defaultConfig"],
        "initContract": {
            "preconditions": [
                "The board-level interface mapping must already be configured before module setup."
            ],
            "steps": init_steps,
        },
        "smokeTest": {
            "checks": smoke_checks,
            "passCriteria": "The module responds on its declared interface path.",
            "failureNotes": [
                "Update the module definition with more specific checks once the hardware behavior is better understood."
            ],
        },
        "api": {
            "highLevel": payload["api"],
        },
        "docs": payload["docs"],
    }


def create_leaf_module(payload):
    normalized = normalize_leaf_module_payload(payload)
    model = load_tree_model()
    modules_root = find_root(model, "modules-root") or {"children": []}
    if find_node_by_id(modules_root, normalize_id("module:", normalized["moduleId"])) is not None:
        raise FileExistsError(f"module '{normalized['moduleId']}' already exists")

    paths = module_paths(normalized["moduleId"])
    if paths["part"].exists() or paths["help"].exists():
        raise FileExistsError(f"module '{normalized['moduleId']}' already exists on disk")

    help_markdown = normalized["helpMarkdown"] or build_leaf_module_help_markdown(normalized)
    definition = build_leaf_module_definition(normalized)

    created = []
    try:
        paths["part"].write_text(json.dumps(definition, indent=2) + "\n", encoding="utf-8")
        created.append(paths["part"])
        paths["help"].write_text(help_markdown, encoding="utf-8")
        created.append(paths["help"])
        regenerate_stage4_tree_model()
    except Exception:
        for file_path in reversed(created):
            if file_path.exists():
                file_path.unlink()
        regenerate_stage4_tree_model()
        raise

    refreshed_model = load_tree_model()
    return {
        "created": {
            "moduleId": normalized["moduleId"],
            "partPath": str(paths["part"].relative_to(REPO_ROOT)).replace("\\", "/"),
            "helpPath": str(paths["help"].relative_to(REPO_ROOT)).replace("\\", "/"),
        },
        "moduleCatalog": build_module_catalog_payload(refreshed_model),
        "moduleHelp": build_module_help_payload(refreshed_model, normalized["moduleId"]),
        "treeSummary": refreshed_model.get("summary", {}),
    }



def build_module_catalog_payload(model):
    modules_root = find_root(model, "modules-root") or {"children": []}
    modules = list(modules_root.get("children", []))

    vendor_counts = {}
    role_counts = {}
    help_backed_count = 0
    composed_count = 0
    module_items = []

    for module in modules:
        metadata = module.get("metadata", {})
        vendor = metadata.get("vendor") or "unknown"
        role = metadata.get("catalogRole") or "unknown"
        vendor_counts[vendor] = vendor_counts.get(vendor, 0) + 1
        role_counts[role] = role_counts.get(role, 0) + 1

        help_refs = [child for child in module.get("children", []) if child.get("nodeKind") == "help-reference"]
        if help_refs:
            help_backed_count += 1
        if metadata.get("supportsComposition"):
            composed_count += 1

        module_items.append({
            "moduleId": metadata.get("moduleId") or module.get("nodeId"),
            "title": module.get("title"),
            "vendor": vendor,
            "catalogRole": role,
            "partType": metadata.get("partType"),
            "interfaceCount": len(metadata.get("interfaces") or []),
            "helpReferenceCount": len(help_refs),
            "supportsComposition": bool(metadata.get("supportsComposition")),
            "sourcePath": module.get("sourcePath"),
            "helpReferences": [
                {
                    "title": child.get("title"),
                    "kind": (child.get("metadata") or {}).get("kind"),
                    "href": (child.get("metadata") or {}).get("href"),
                    "path": (child.get("metadata") or {}).get("path"),
                }
                for child in help_refs
            ]
        })

    module_items.sort(key=lambda item: item.get("title") or "")

    return {
        "generatedAt": model.get("generatedAt"),
        "summary": {
            "moduleCount": len(modules),
            "vendorCount": len(vendor_counts),
            "helpBackedCount": help_backed_count,
            "composedCount": composed_count,
            "roleCounts": role_counts,
            "vendorCounts": dict(sorted(vendor_counts.items(), key=lambda entry: entry[0].lower())),
        },
        "modules": module_items,
    }


def build_module_help_payload(model, module_id):
    modules_root = find_root(model, "modules-root") or {"children": []}
    node = find_node_by_id(modules_root, normalize_id("module:", module_id))
    if node is None:
        raise FileNotFoundError(f"module '{module_id}' not found")

    metadata = node.get("metadata", {})
    help_refs = [child for child in node.get("children", []) if child.get("nodeKind") == "help-reference"]
    documents = []
    for ref in help_refs:
        ref_meta = ref.get("metadata") or {}
        path = ref_meta.get("path")
        if not path:
            continue
        text, normalized_path = load_help_text(path)
        documents.append({
            "title": ref.get("title"),
            "kind": ref_meta.get("kind"),
            "path": normalized_path,
            "markdown": text,
        })

    return {
        "generatedAt": model.get("generatedAt"),
        "module": {
            "moduleId": metadata.get("moduleId") or node.get("nodeId"),
            "title": node.get("title"),
            "vendor": metadata.get("vendor") or "unknown",
            "catalogRole": metadata.get("catalogRole") or "unknown",
            "partType": metadata.get("partType"),
            "interfaces": metadata.get("interfaces") or [],
            "defaultConfig": metadata.get("defaultConfig") or {},
            "supportsComposition": bool(metadata.get("supportsComposition")),
            "sourcePath": node.get("sourcePath"),
            "api": (metadata.get("api") or {}).get("highLevel") or [],
        },
        "references": [
            {
                "title": ref.get("title"),
                "kind": (ref.get("metadata") or {}).get("kind"),
                "href": (ref.get("metadata") or {}).get("href"),
                "path": (ref.get("metadata") or {}).get("path"),
            }
            for ref in help_refs
        ],
        "documents": documents,
    }
def build_inventory_dashboard_payload():
    inventory = load_inventory()
    history = load_history()
    jobs_store = load_jobs()
    reports = load_validation_reports()
    report_by_unit = {}
    for report in reports:
        stable_unit_id = report.get("identity", {}).get("stableUnitId")
        if stable_unit_id and stable_unit_id not in report_by_unit:
            report_by_unit[stable_unit_id] = report

    present_units = list(inventory.get("units", []))
    unresolved_conflicts = [entry for entry in history.get("conflicts", []) if entry.get("status") != "resolved"]
    overrides = [entry for entry in history.get("units", []) if (entry.get("manualOverride") or {}).get("boardId") or (entry.get("manualOverride") or {}).get("familyKey")]
    recent_jobs = sorted(jobs_store.get("jobs", []), key=lambda item: item.get("updatedAt") or item.get("createdAt") or "", reverse=True)[:5]
    recent_reports = reports[:5]

    units_payload = []
    for unit in present_units:
        latest_report = report_by_unit.get(unit.get("unitId")) or report_by_unit.get(unit.get("identity", {}).get("stableKey"))
        match = unit.get("match", {})
        annotation = unit.get("annotation", {})
        observed = unit.get("observed", {})
        transport = unit.get("transport", {})
        units_payload.append({
            "unitId": unit.get("unitId"),
            "boardId": match.get("boardId"),
            "boardMatchStatus": match.get("status"),
            "label": annotation.get("label"),
            "port": transport.get("port"),
            "transportKind": transport.get("kind"),
            "firmwareApp": observed.get("firmwareApp"),
            "firmwareVersion": observed.get("firmwareVersion"),
            "chip": observed.get("chip"),
            "mac": observed.get("mac"),
            "serialNumber": observed.get("serialNumber"),
            "health": None if latest_report is None else {
                "overallPass": latest_report.get("summary", {}).get("overallPass"),
                "failingCheckCount": latest_report.get("summary", {}).get("failingCheckCount"),
                "warningCount": latest_report.get("summary", {}).get("warningCount"),
                "generatedAt": latest_report.get("generatedAt"),
            }
        })

    report_payload = []
    for report in recent_reports:
        identity = report.get("identity", {})
        summary = report.get("summary", {})
        report_payload.append({
            "fileName": report.get("__fileName"),
            "generatedAt": report.get("generatedAt"),
            "boardId": identity.get("boardId"),
            "stableUnitId": identity.get("stableUnitId"),
            "overallPass": summary.get("overallPass"),
            "failingCheckCount": summary.get("failingCheckCount"),
            "warningCount": summary.get("warningCount"),
        })

    conflict_payload = []
    for conflict in unresolved_conflicts[:5]:
        conflict_payload.append({
            "conflictId": conflict.get("conflictId"),
            "status": conflict.get("status"),
            "chosenStableKey": conflict.get("chosenStableKey"),
            "candidateStableKeys": conflict.get("candidateStableKeys", []),
            "detectedAt": conflict.get("detectedAt"),
        })

    job_payload = []
    for job in recent_jobs:
        job_payload.append({
            "jobId": job.get("jobId"),
            "action": job.get("action"),
            "status": job.get("status"),
            "updatedAt": job.get("updatedAt"),
            "boardId": (job.get("resolution") or {}).get("boardId"),
            "unitId": (job.get("resolution") or {}).get("unitId"),
        })

    failing_reports = sum(1 for report in recent_reports if report.get("summary", {}).get("overallPass") is False)
    healthy_units = sum(1 for unit in units_payload if unit.get("health") and unit["health"].get("overallPass") is True)

    return {
        "generatedAt": inventory.get("generatedAt"),
        "host": inventory.get("host", {}),
        "summary": {
            "presentUnitCount": len(present_units),
            "familyCount": len(history.get("families", [])),
            "conflictCount": len(unresolved_conflicts),
            "overrideCount": len(overrides),
            "recentJobCount": len(recent_jobs),
            "recentReportCount": len(recent_reports),
            "failingRecentReportCount": failing_reports,
            "healthyUnitCount": healthy_units,
        },
        "units": units_payload,
        "conflicts": conflict_payload,
        "recentJobs": job_payload,
        "recentReports": report_payload,
    }


class Stage4ReadApiHandler(BaseHTTPRequestHandler):
    server_version = "BoardManagerStage4Python/1.0"

    def _send_json(self, status_code, payload):
        body = json.dumps(payload, indent=2) + "\n"
        encoded = body.encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _send_text(self, status_code, body, content_type="text/plain; charset=utf-8"):
        encoded = body.encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def _send_not_found(self, message="not_found"):
        self._send_json(404, {"error": message})

    def _send_static(self, relative_name):
        asset_path = load_static_asset(relative_name)
        suffix = asset_path.suffix.lower()
        content_type = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
        }.get(suffix, "application/octet-stream")
        self._send_text(200, asset_path.read_text(encoding="utf-8"), content_type)

    def log_message(self, format, *args):
        return

    def _read_json_body(self):
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        if content_length <= 0:
            raise ValueError("request body is required")
        raw = self.rfile.read(content_length)
        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as error:
            raise ValueError(f"invalid JSON body: {error.msg}") from error

    def do_POST(self):
        try:
            parsed = urlparse(self.path)
            if parsed.path == "/api/stage4/module-create":
                payload = self._read_json_body()
                self._send_json(201, create_leaf_module(payload))
                return
            self._send_json(404, {"error": "not_found"})
        except FileExistsError as error:
            self._send_json(409, {"error": "already_exists", "message": str(error)})
        except ValueError as error:
            self._send_json(400, {"error": "invalid_request", "message": str(error)})
        except Exception as error:
            self._send_json(500, {"error": "internal_error", "message": str(error)})

    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            query = parse_qs(parsed.query)
            model = load_tree_model()

            if parsed.path == "/":
                self._send_static("index.html")
                return

            if parsed.path.startswith("/static/"):
                self._send_static(parsed.path.removeprefix("/static/"))
                return

            if parsed.path == "/health":
                self._send_json(200, {"status": "ok", "runtime": "python"})
                return

            if parsed.path == "/api/stage4/dashboard/inventory":
                self._send_json(200, build_inventory_dashboard_payload())
                return

            if parsed.path == "/api/stage4/dashboard/modules":
                self._send_json(200, build_module_catalog_payload(model))
                return

            if parsed.path == "/api/stage4/tree":
                self._send_json(200, model)
                return

            if parsed.path == "/api/stage4/modules":
                self._handle_root_collection(model, "modules-root", query)
                return

            if parsed.path.startswith("/api/stage4/module-help/"):
                module_id = parsed.path.rsplit("/", 1)[-1]
                self._send_json(200, build_module_help_payload(model, module_id))
                return

            if parsed.path == "/api/stage4/boards":
                self._handle_root_collection(model, "boards-root", query)
                return

            if parsed.path == "/api/stage4/projects":
                self._handle_root_collection(model, "projects-root", query)
                return

            if parsed.path.startswith("/api/stage4/modules/"):
                node_id = normalize_id("module:", parsed.path.rsplit("/", 1)[-1])
                self._handle_node_lookup(model, "modules-root", node_id)
                return

            if parsed.path.startswith("/api/stage4/boards/"):
                node_id = normalize_id("board:", parsed.path.rsplit("/", 1)[-1])
                self._handle_node_lookup(model, "boards-root", node_id)
                return

            if parsed.path.startswith("/api/stage4/projects/"):
                node_id = normalize_id("project:", parsed.path.rsplit("/", 1)[-1])
                self._handle_node_lookup(model, "projects-root", node_id)
                return

            if parsed.path == "/api/stage4/help":
                self._handle_help(model, query)
                return

            self._send_json(
                404,
                {
                    "error": "not_found",
                    "endpoints": [
                        "/",
                        "/health",
                        "/api/stage4/dashboard/inventory",
                        "/api/stage4/dashboard/modules",
                        "/api/stage4/tree",
                        "/api/stage4/modules",
                        "/api/stage4/modules/<moduleId>",
                        "/api/stage4/module-help/<moduleId>",
                        "/api/stage4/boards",
                        "/api/stage4/boards/<boardId>",
                        "/api/stage4/projects",
                        "/api/stage4/projects/<projectId>",
                        "/api/stage4/help?path=project/help/parts/bm8563.md",
                        "POST /api/stage4/module-create",
                    ],
                },
            )
        except FileNotFoundError as error:
            self._send_json(404, {"error": "not_found", "message": str(error)})
        except Exception as error:
            self._send_json(500, {"error": "internal_error", "message": str(error)})

    def _handle_root_collection(self, model, root_id, query):
        root = find_root(model, root_id)
        if root is None:
            self._send_not_found("root_not_found")
            return

        include_children = str(query.get("includeChildren", ["true"])[0]).lower() in {"1", "true", "yes"}
        nodes = root.get("children", [])
        if not include_children:
            nodes = [
                {
                    "nodeId": node.get("nodeId"),
                    "nodeKind": node.get("nodeKind"),
                    "title": node.get("title"),
                    "sourcePath": node.get("sourcePath"),
                    "metadata": node.get("metadata", {}),
                }
                for node in nodes
            ]

        self._send_json(
            200,
            {
                "rootId": root_id,
                "title": root.get("title"),
                "count": len(root.get("children", [])),
                "nodes": nodes,
            },
        )

    def _handle_node_lookup(self, model, root_id, node_id):
        root = find_root(model, root_id)
        if root is None:
            self._send_not_found("root_not_found")
            return

        node = find_node_by_id(root, node_id)
        if node is None:
            self._send_not_found("node_not_found")
            return

        self._send_json(200, {"node": node})

    def _handle_help(self, model, query):
        requested_path = query.get("path", [None])[0]
        if not requested_path:
            self._send_json(400, {"error": "missing_path"})
            return

        text, normalized_path = load_help_text(requested_path)
        linked_nodes = []
        for root in model.get("roots", []):
            for node in iter_nodes(root):
                metadata = node.get("metadata", {})
                docs = metadata.get("docs", {})
                if (
                    node.get("sourcePath") == normalized_path
                    or metadata.get("helpGuide") == normalized_path
                    or docs.get("apiGuide") == normalized_path
                ):
                    linked_nodes.append(
                        {
                            "nodeId": node.get("nodeId"),
                            "nodeKind": node.get("nodeKind"),
                            "title": node.get("title"),
                        }
                    )

        self._send_json(
            200,
            {
                "path": normalized_path,
                "linkedNodeCount": len(linked_nodes),
                "linkedNodes": linked_nodes,
                "content": text,
            },
        )


def parse_args():
    parser = argparse.ArgumentParser(description="Board Manager Stage 4 read-only API")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8791)
    return parser.parse_args()


def main():
    args = parse_args()
    server = ThreadingHTTPServer((args.host, args.port), Stage4ReadApiHandler)
    print(f"Board Manager Stage 4 read API listening on http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()