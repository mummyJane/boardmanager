import argparse
import json
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