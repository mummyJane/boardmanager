import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
REPO_ROOT = PROJECT_ROOT.parent
TREE_MODEL_PATH = PROJECT_ROOT / "web-ui" / "data" / "stage4-tree-model.json"


def load_tree_model():
    return json.loads(TREE_MODEL_PATH.read_text(encoding="utf-8"))


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

    def _send_not_found(self, message="not_found"):
        self._send_json(404, {"error": message})

    def log_message(self, format, *args):
        return

    def do_GET(self):
        try:
            parsed = urlparse(self.path)
            query = parse_qs(parsed.query)
            model = load_tree_model()

            if parsed.path == "/health":
                self._send_json(200, {"status": "ok", "runtime": "python"})
                return

            if parsed.path == "/api/stage4/tree":
                self._send_json(200, model)
                return

            if parsed.path == "/api/stage4/modules":
                self._handle_root_collection(model, "modules-root", query)
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
                        "/health",
                        "/api/stage4/tree",
                        "/api/stage4/modules",
                        "/api/stage4/modules/<moduleId>",
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