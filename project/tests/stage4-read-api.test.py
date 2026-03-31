from __future__ import annotations

import importlib.util
import json
import threading
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'project' / 'scripts' / 'stage4-read-api.py'

spec = importlib.util.spec_from_file_location('stage4_read_api', SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def fetch_json(base_url: str, path: str) -> dict:
    with urllib.request.urlopen(f"{base_url}{path}", timeout=5) as response:
        assert response.status == 200, (path, response.status)
        return json.load(response)


def main() -> int:
    module.set_debug_trace(enabled=False)
    module.ensure_runtime_ready()
    server = ThreadingHTTPServer(("127.0.0.1", 0), module.Stage4ReadApiHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address
    base_url = f"http://{host}:{port}"
    try:
        health = fetch_json(base_url, "/health")
        assert health["runtime"] == "python"
        assert health["treeAvailable"] is True

        projects = fetch_json(base_url, "/api/stage4/dashboard/projects")
        assert projects["summary"]["projectCount"] >= 1
        assert any(item["projectId"] == "m5stack_dial_demo" for item in projects["projects"])

        reports = fetch_json(base_url, "/api/stage4/dashboard/reports")
        assert reports["summary"]["reportCount"] >= 1
        assert all("reportFile" in item for item in reports["reports"])

        module_help = fetch_json(base_url, "/api/stage4/module-help/bm8563")
        assert module_help["module"]["moduleId"] == "bm8563"
        assert module_help["documents"]

        print("PASS stage4 python api")
        return 0
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


if __name__ == "__main__":
    raise SystemExit(main())
