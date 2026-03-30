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
DEVICE_MANAGER_PROFILES_ROOT = PROJECT_ROOT / "device-manager" / "profiles"
JOB_MANAGER_DATA_ROOT = PROJECT_ROOT / "job-manager" / "data"
JOB_MANAGER_REPORTS_ROOT = PROJECT_ROOT / "job-manager" / "reports"
PARTS_DEVICES_ROOT = PROJECT_ROOT / "parts" / "devices"
HELP_PARTS_ROOT = PROJECT_ROOT / "help" / "parts"
BOARDS_ROOT = PROJECT_ROOT / "boards"
HELP_BOARDS_ROOT = PROJECT_ROOT / "help" / "boards"
GENERATED_ROOT = PROJECT_ROOT / "generated"
STAGE4_GENERATOR_PATH = PROJECT_ROOT / "scripts" / "generate-stage4-tree-model.mjs"
MODULE_ID_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")
INTERFACE_NAME_PATTERN = re.compile(r"^[a-zA-Z][a-zA-Z0-9_\\-]*$")
API_NAME_PATTERN = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]*$")


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


def find_latest_validation_report(board_id=None, stable_unit_id=None):
    for report in load_validation_reports():
        identity = report.get("identity", {})
        if board_id and identity.get("boardId") != board_id:
            continue
        if stable_unit_id and identity.get("stableUnitId") != stable_unit_id:
            continue
        return report
    return None


def build_board_validation_candidates(board_id):
    inventory = load_inventory()
    candidates = []
    for unit in inventory.get("units", []):
        match = unit.get("match") or {}
        override = unit.get("manualOverride") or {}
        effective_board_id = override.get("boardId") or match.get("boardId")
        if effective_board_id != board_id:
            continue
        transport = unit.get("transport") or {}
        observed = unit.get("observed") or {}
        latest_report = find_latest_validation_report(board_id=board_id, stable_unit_id=unit.get("unitId"))
        candidates.append({
            "unitId": unit.get("unitId"),
            "label": (unit.get("annotation") or {}).get("label"),
            "port": transport.get("port"),
            "transportKind": transport.get("kind"),
            "chip": observed.get("chip"),
            "firmwareApp": observed.get("firmwareApp"),
            "latestValidation": None if latest_report is None else {
                "generatedAt": latest_report.get("generatedAt"),
                "overallPass": (latest_report.get("summary") or {}).get("overallPass"),
                "failingCheckCount": (latest_report.get("summary") or {}).get("failingCheckCount"),
                "warningCount": (latest_report.get("summary") or {}).get("warningCount"),
            },
        })
    return sorted(candidates, key=lambda item: (item.get("label") or item.get("unitId") or ""))


def summarize_validation_report(report):
    if report is None:
        return None
    summary = report.get("summary") or {}
    checks = report.get("checks") or []
    failing_checks = []
    for entry in checks:
        if entry.get("pass") is False:
            failing_checks.append({
                "checkId": entry.get("checkId"),
                "title": entry.get("title") or entry.get("checkId"),
                "notes": entry.get("notes") or [],
                "evidence": entry.get("evidence") or {},
            })
    return {
        "generatedAt": report.get("generatedAt"),
        "summary": summary,
        "identity": report.get("identity") or {},
        "health": report.get("health") or {},
        "failingChecks": failing_checks,
        "reportFile": report.get("__fileName"),
    }


def load_profiles():
    profiles = []
    if not DEVICE_MANAGER_PROFILES_ROOT.exists():
        return profiles
    for file_path in sorted(DEVICE_MANAGER_PROFILES_ROOT.glob("*.json")):
        profile = read_json(file_path, None)
        if profile is None:
            continue
        profile["__fileName"] = file_path.name
        profiles.append(profile)
    return profiles


def find_profile_by_id(profile_id):
    for profile in load_profiles():
        if profile.get("profileId") == profile_id:
            return profile
    return None


def find_inventory_unit(unit_id):
    inventory = load_inventory()
    for unit in inventory.get("units", []):
        if unit.get("unitId") == unit_id or (unit.get("identity") or {}).get("stableKey") == unit_id:
            return unit
    raise FileNotFoundError(f"unit '{unit_id}' not found")


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


def normalize_composition_children(composition):
    if not composition:
        return []
    if isinstance(composition, dict) and isinstance(composition.get("children"), list):
        return composition["children"]

    children = []
    if isinstance(composition, dict):
        if composition.get("gnssReceiverPartId"):
            children.append({
                "partId": composition["gnssReceiverPartId"],
                "role": "gnssReceiver",
                "displayName": composition["gnssReceiverPartId"],
                "config": {},
            })
        for key, role in (("imu", "imu"), ("magnetometer", "magnetometer"), ("barometer", "barometer")):
            if composition.get(key):
                children.append({
                    "partId": str(composition[key]).lower(),
                    "role": role,
                    "displayName": composition[key],
                    "config": {},
                })
    return children


def load_module_definition(module_id):
    paths = module_paths(module_id)
    if not paths["part"].exists():
        raise FileNotFoundError(f"module '{module_id}' not found")
    definition = json.loads(paths["part"].read_text(encoding="utf-8"))
    help_text = paths["help"].read_text(encoding="utf-8") if paths["help"].exists() else ""
    return {
        "paths": paths,
        "definition": definition,
        "helpMarkdown": help_text,
    }


def load_board_definition(board_id):
    board_path = PROJECT_ROOT / "boards" / f"{board_id}.json"
    if not board_path.exists():
        raise FileNotFoundError(f"board '{board_id}' not found")
    definition = json.loads(board_path.read_text(encoding="utf-8"))
    help_path = PROJECT_ROOT / "help" / "boards" / f"{board_id}.md"
    help_text = help_path.read_text(encoding="utf-8") if help_path.exists() else ""
    return {
        "path": board_path,
        "definition": definition,
        "helpPath": help_path,
        "helpMarkdown": help_text,
    }


def load_board_definition(board_id):
    board_path = PROJECT_ROOT / "boards" / f"{board_id}.json"
    if not board_path.exists():
        raise FileNotFoundError(f"board '{board_id}' not found")
    definition = json.loads(board_path.read_text(encoding="utf-8"))
    help_path = PROJECT_ROOT / "help" / "boards" / f"{board_id}.md"
    help_text = help_path.read_text(encoding="utf-8") if help_path.exists() else ""
    return {
        "path": board_path,
        "definition": definition,
        "helpPath": help_path,
        "helpMarkdown": help_text,
    }


def board_paths(board_id):
    return {
        "board": BOARDS_ROOT / f"{board_id}.json",
        "help": HELP_BOARDS_ROOT / f"{board_id}.md",
    }


def write_board_files(board_id, definition, help_markdown):
    paths = board_paths(board_id)
    previous_board = paths["board"].read_text(encoding="utf-8") if paths["board"].exists() else None
    previous_help = paths["help"].read_text(encoding="utf-8") if paths["help"].exists() else None

    try:
        paths["board"].write_text(json.dumps(definition, indent=2) + "\n", encoding="utf-8")
        paths["help"].write_text(help_markdown, encoding="utf-8")
        regenerate_stage4_tree_model()
    except Exception:
        if previous_board is None:
            if paths["board"].exists():
                paths["board"].unlink()
        else:
            paths["board"].write_text(previous_board, encoding="utf-8")

        if previous_help is None:
            if paths["help"].exists():
                paths["help"].unlink()
        else:
            paths["help"].write_text(previous_help, encoding="utf-8")

        regenerate_stage4_tree_model()
        raise


def build_board_write_result(board_id, action):
    refreshed_model = load_tree_model()
    paths = board_paths(board_id)
    return {
        action: {
            "boardId": board_id,
            "boardPath": str(paths["board"].relative_to(REPO_ROOT)).replace("\\", "/"),
            "helpPath": str(paths["help"].relative_to(REPO_ROOT)).replace("\\", "/"),
        },
        "boardCatalog": build_board_catalog_payload(refreshed_model),
        "boardDetail": build_board_detail_payload(refreshed_model, board_id),
        "treeSummary": refreshed_model.get("summary", {}),
    }


def infer_controller_module_id(unit, profile):
    exact = profile.get("exactBoard") if profile else None
    if exact and exact.get("controllerModuleId"):
        return exact.get("controllerModuleId")
    candidates = profile.get("candidateBoards") if profile else []
    if candidates:
        first = candidates[0]
        if first.get("controllerModuleId"):
            return first.get("controllerModuleId")
    chip = ((unit.get("observed") or {}).get("chip") or "").lower()
    if "esp32-s3" in chip:
        return "m5stamps3"
    if "esp32" in chip:
        return "esp32_wroom_32"
    if "stm32f0" in chip or "f072" in chip:
        return "nucleo_f072rb_controller"
    return None


def infer_guess_base_board(unit, profile):
    match = unit.get("match") or {}
    if match.get("boardId"):
        try:
            return load_board_definition(match.get("boardId"))["definition"]
        except FileNotFoundError:
            pass
    exact = profile.get("exactBoard") if profile else None
    if exact and exact.get("boardId"):
        try:
            return load_board_definition(exact.get("boardId"))["definition"]
        except FileNotFoundError:
            pass
    candidates = profile.get("candidateBoards") if profile else []
    for candidate in candidates:
        if candidate.get("boardId"):
            try:
                return load_board_definition(candidate.get("boardId"))["definition"]
            except FileNotFoundError:
                continue
    return None


def normalize_board_create_payload(payload):
    if not isinstance(payload, dict):
        raise ValueError("board payload must be a JSON object")
    board_id = str(payload.get("boardId") or "").strip()
    if not MODULE_ID_PATTERN.match(board_id):
        raise ValueError("boardId must match ^[a-z][a-z0-9_]*$")
    display_name = str(payload.get("displayName") or "").strip()
    if not display_name:
        raise ValueError("displayName is required")
    vendor = str(payload.get("vendor") or "").strip()
    if not vendor:
        raise ValueError("vendor is required")
    revision = str(payload.get("revision") or "").strip() or "1.0"
    unit_id = str(payload.get("unitId") or "").strip()
    if not unit_id:
        raise ValueError("unitId is required")
    return {
        "boardId": board_id,
        "displayName": display_name,
        "vendor": vendor,
        "revision": revision,
        "unitId": unit_id,
    }


def normalize_manual_board_create_payload(payload):
    if not isinstance(payload, dict):
        raise ValueError("board payload must be a JSON object")
    board_id = str(payload.get("boardId") or "").strip()
    if not MODULE_ID_PATTERN.match(board_id):
        raise ValueError("boardId must match ^[a-z][a-z0-9_]*$")
    display_name = str(payload.get("displayName") or "").strip()
    if not display_name:
        raise ValueError("displayName is required")
    vendor = str(payload.get("vendor") or "").strip()
    if not vendor:
        raise ValueError("vendor is required")
    revision = str(payload.get("revision") or "").strip() or "1.0"
    template_board_id = str(payload.get("templateBoardId") or "").strip() or None
    controller_module_id = str(payload.get("controllerModuleId") or "").strip() or None
    if not template_board_id and not controller_module_id:
        raise ValueError("controllerModuleId is required when no template board is selected")
    return {
        "boardId": board_id,
        "displayName": display_name,
        "vendor": vendor,
        "revision": revision,
        "templateBoardId": template_board_id,
        "controllerModuleId": controller_module_id,
    }


def build_manual_board_create_options(model):
    boards_root = find_root(model, "boards-root") or {"children": []}
    modules_root = find_root(model, "modules-root") or {"children": []}
    templates = []
    for node in boards_root.get("children", []):
        metadata = node.get("metadata", {})
        templates.append({
            "boardId": metadata.get("boardId") or node.get("nodeId"),
            "title": node.get("title"),
            "vendor": metadata.get("vendor"),
            "revision": metadata.get("revision"),
            "controllerModuleId": metadata.get("controllerModuleId"),
        })
    templates.sort(key=lambda item: item.get("title") or "")

    controllers = []
    for node in modules_root.get("children", []):
        metadata = node.get("metadata", {})
        if metadata.get("catalogRole") != "controller":
            continue
        controllers.append({
            "moduleId": metadata.get("moduleId"),
            "title": node.get("title"),
            "vendor": metadata.get("vendor"),
            "partType": metadata.get("partType"),
        })
    controllers.sort(key=lambda item: item.get("title") or "")

    return {
        "generatedAt": model.get("generatedAt"),
        "templates": templates,
        "controllers": controllers,
    }


def build_manual_board_definition(normalized):
    template_board_id = normalized.get("templateBoardId")
    if template_board_id:
        definition = json.loads(json.dumps(load_board_definition(template_board_id)["definition"]))
    else:
        definition = {
            "boardId": normalized["boardId"],
            "displayName": normalized["displayName"],
            "revision": normalized["revision"],
            "vendor": normalized["vendor"],
            "controller": {"moduleId": normalized.get("controllerModuleId")},
            "capabilities": {},
            "signals": [],
            "buses": [],
            "bootSequence": [{"name": "controller", "kind": "module"}],
            "connectors": [],
            "sources": [],
        }
    definition["boardId"] = normalized["boardId"]
    definition["displayName"] = normalized["displayName"]
    definition["revision"] = normalized["revision"]
    definition["vendor"] = normalized["vendor"]
    if not template_board_id:
        definition["controller"] = {"moduleId": normalized.get("controllerModuleId")}
    return definition


def build_manual_board_help_markdown(board_definition, normalized):
    lines = [
        f"# {board_definition.get('displayName')}",
        "",
        "## Summary",
        "",
        f"`{board_definition.get('boardId')}` is a user-created board draft generated through the Stage 4 manual board-create flow.",
        "",
        "## Creation Mode",
        "",
    ]
    if normalized.get("templateBoardId"):
        lines.append(f"- Seeded from template board `{normalized.get('templateBoardId')}`")
    else:
        lines.append(f"- Started from a blank board skeleton with controller module `{normalized.get('controllerModuleId')}`")
    return '\n'.join(lines) + '\n'


def create_board_manual(payload):
    normalized = normalize_manual_board_create_payload(payload)
    paths = board_paths(normalized["boardId"])
    if paths["board"].exists() or paths["help"].exists():
        raise FileExistsError(f"board '{normalized['boardId']}' already exists")
    board_definition = build_manual_board_definition(normalized)
    help_markdown = build_manual_board_help_markdown(board_definition, normalized)
    write_board_files(normalized["boardId"], board_definition, help_markdown)
    return build_board_write_result(normalized["boardId"], "created")


def build_board_guess_payload(unit_id):
    unit = find_inventory_unit(unit_id)
    history = load_history()
    unit_history = next((entry for entry in history.get("units", []) if entry.get("stableKey") == unit.get("unitId")), None)
    profile = find_profile_by_id((unit.get("history") or {}).get("profileId")) or (find_profile_by_id((unit_history or {}).get("profileId")) if unit_history else None)
    base_board = infer_guess_base_board(unit, profile)
    observed = unit.get("observed") or {}
    match = unit.get("match") or {}
    suggested_board_id = f"draft_{(match.get('boardId') or observed.get('firmwareBoard') or unit.get('unitId') or 'board').replace(':', '_').replace('-', '_').lower()}"
    suggested_board_id = re.sub(r'[^a-z0-9_]', '_', suggested_board_id)
    suggested_board_id = re.sub(r'_+', '_', suggested_board_id).strip('_')
    if not suggested_board_id or not suggested_board_id[0].isalpha():
        suggested_board_id = f"draft_{suggested_board_id or 'board'}"

    if base_board is not None:
        draft = json.loads(json.dumps(base_board))
    else:
        draft = {
            "boardId": suggested_board_id,
            "displayName": observed.get("firmwareBoard") or observed.get("chip") or "Discovered Board",
            "revision": "1.0",
            "vendor": (profile.get("exactBoard") or {}).get("vendor") if profile and profile.get("exactBoard") else (profile.get("fingerprint") or {}).get("manufacturer") or "Unknown",
            "controller": {
                "moduleId": infer_controller_module_id(unit, profile)
            },
            "capabilities": {capability: True for capability in (observed.get("agentCapabilities") or [])},
            "signals": [],
            "buses": [],
            "bootSequence": [{"name": "controller", "kind": "module"}],
            "sources": [],
        }

    draft["boardId"] = suggested_board_id
    draft["displayName"] = draft.get("displayName") or observed.get("firmwareBoard") or "Discovered Board"
    draft["revision"] = draft.get("revision") or "1.0"
    draft["vendor"] = draft.get("vendor") or ((profile.get("exactBoard") or {}).get("vendor") if profile else None) or ((profile.get("fingerprint") or {}).get("manufacturer") if profile else None) or "Unknown"
    if not draft.get("controller") or not draft["controller"].get("moduleId"):
        draft["controller"] = {"moduleId": infer_controller_module_id(unit, profile)}
    if not draft.get("capabilities"):
        draft["capabilities"] = {capability: True for capability in (observed.get("agentCapabilities") or [])}

    notes = []
    if match.get("boardId"):
        notes.append(f"Seeded from matched board definition {match.get('boardId')}")
    elif profile and (profile.get("candidateBoards") or []):
        notes.append(f"Seeded from candidate board {(profile.get('candidateBoards') or [])[0].get('boardId')}")
    else:
        notes.append("Seeded from discovery fingerprints without a known board definition")

    return {
        "unit": {
            "unitId": unit.get("unitId"),
            "transport": unit.get("transport"),
            "observed": {
                "chip": observed.get("chip"),
                "mac": observed.get("mac"),
                "serialNumber": observed.get("serialNumber"),
                "firmwareBoard": observed.get("firmwareBoard"),
                "agentCapabilities": observed.get("agentCapabilities") or [],
                "vid": observed.get("vid"),
                "pid": observed.get("pid"),
            },
            "match": match,
            "history": unit.get("history") or {},
        },
        "profile": None if profile is None else {
            "profileId": profile.get("profileId"),
            "status": profile.get("status"),
            "familyKey": profile.get("familyKey"),
            "exactBoard": profile.get("exactBoard"),
            "candidateBoards": profile.get("candidateBoards") or [],
        },
        "guess": {
            "boardId": draft.get("boardId"),
            "displayName": draft.get("displayName"),
            "revision": draft.get("revision"),
            "vendor": draft.get("vendor"),
            "controllerModuleId": (draft.get("controller") or {}).get("moduleId"),
            "notes": notes,
            "boardDefinition": draft,
        },
    }


def build_board_help_markdown(board_definition, guess_payload):
    unit = guess_payload.get("unit") or {}
    observed = unit.get("observed") or {}
    profile = guess_payload.get("profile") or {}
    lines = [
        f"# {board_definition.get('displayName')}",
        "",
        "## Summary",
        "",
        f"`{board_definition.get('boardId')}` is a user-created board draft generated from discovered hardware through the Stage 4 board-create flow.",
        "",
        "## Discovery Evidence",
        "",
        f"- Unit: `{unit.get('unitId')}`",
        f"- Chip: `{observed.get('chip') or 'unknown'}`",
        f"- MAC: `{observed.get('mac') or 'unknown'}`",
        f"- Serial: `{observed.get('serialNumber') or 'unknown'}`",
        f"- Firmware board: `{observed.get('firmwareBoard') or 'unknown'}`",
        "",
        "## Guess Notes",
        "",
    ]
    for note in guess_payload.get("guess", {}).get("notes", []):
        lines.append(f"- {note}")
    if profile:
        lines.extend([
            "",
            "## Profile",
            "",
            f"- Profile: `{profile.get('profileId')}`",
            f"- Status: `{profile.get('status')}`",
            f"- Family key: `{profile.get('familyKey')}`",
        ])
    return '\n'.join(lines) + '\n'


def create_board_from_unit(payload):
    normalized = normalize_board_create_payload(payload)
    guess_payload = build_board_guess_payload(normalized["unitId"])
    board_definition = json.loads(json.dumps(guess_payload["guess"]["boardDefinition"]))
    board_definition["boardId"] = normalized["boardId"]
    board_definition["displayName"] = normalized["displayName"]
    board_definition["vendor"] = normalized["vendor"]
    board_definition["revision"] = normalized["revision"]
    if "sources" not in board_definition:
        board_definition["sources"] = []

    paths = board_paths(normalized["boardId"])
    if paths["board"].exists() or paths["help"].exists():
        raise FileExistsError(f"board '{normalized['boardId']}' already exists")

    help_markdown = build_board_help_markdown(board_definition, guess_payload)
    write_board_files(normalized["boardId"], board_definition, help_markdown)
    return build_board_write_result(normalized["boardId"], "created")


def assert_user_owned_module(module_id):
    loaded = load_module_definition(module_id)
    definition = loaded["definition"]
    if definition.get("origin") != "user":
        raise PermissionError(f"module '{module_id}' is not editable through the Stage 4 write API")
    return loaded


def write_module_files(module_id, definition, help_markdown):
    paths = module_paths(module_id)
    previous_part = paths["part"].read_text(encoding="utf-8") if paths["part"].exists() else None
    previous_help = paths["help"].read_text(encoding="utf-8") if paths["help"].exists() else None
    had_help = paths["help"].exists()

    try:
        paths["part"].write_text(json.dumps(definition, indent=2) + "\n", encoding="utf-8")
        paths["help"].write_text(help_markdown, encoding="utf-8")
        regenerate_stage4_tree_model()
    except Exception:
        if previous_part is None:
            if paths["part"].exists():
                paths["part"].unlink()
        else:
            paths["part"].write_text(previous_part, encoding="utf-8")

        if previous_help is None:
            if paths["help"].exists():
                paths["help"].unlink()
        else:
            paths["help"].write_text(previous_help, encoding="utf-8")

        if not had_help and paths["help"].exists() and previous_help is None:
            paths["help"].unlink()

        regenerate_stage4_tree_model()
        raise


def build_module_write_result(module_id, action):
    refreshed_model = load_tree_model()
    paths = module_paths(module_id)
    return {
        action: {
            "moduleId": module_id,
            "partPath": str(paths["part"].relative_to(REPO_ROOT)).replace("\\", "/"),
            "helpPath": str(paths["help"].relative_to(REPO_ROOT)).replace("\\", "/"),
        },
        "moduleCatalog": build_module_catalog_payload(refreshed_model),
        "moduleHelp": build_module_help_payload(refreshed_model, module_id),
        "treeSummary": refreshed_model.get("summary", {}),
    }


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


def normalize_composed_module_payload(payload):
    normalized = normalize_leaf_module_payload(payload)
    raw_children = payload.get("compositionChildren") or []
    if not isinstance(raw_children, list) or not raw_children:
        raise ValueError("compositionChildren must be a non-empty array")

    children = []
    seen_ids = set()
    for entry in raw_children:
        if not isinstance(entry, dict):
            raise ValueError("compositionChildren entries must be objects")
        child_id = str(entry.get("partId") or entry.get("moduleId") or "").strip()
        if not child_id:
            raise ValueError("each composition child must define partId or moduleId")
        if child_id in seen_ids:
            raise ValueError(f"duplicate composition child '{child_id}'")
        seen_ids.add(child_id)
        role = str(entry.get("role") or "").strip() or None
        display_name = str(entry.get("displayName") or child_id).strip()
        raw_config = entry.get("config") or {}
        if not isinstance(raw_config, dict):
            raise ValueError(f"composition child '{child_id}' config must be an object")
        child_config = {}
        for key, value in raw_config.items():
            config_key = str(key or "").strip()
            if not config_key:
                continue
            if not isinstance(value, (str, int, float, bool)) and value is not None:
                raise ValueError(f"composition child '{child_id}' config '{config_key}' must be a scalar value")
            child_config[config_key] = value
        children.append({
            "partId": child_id,
            "moduleId": child_id,
            "role": role,
            "displayName": display_name,
            "config": child_config,
        })

    normalized["compositionChildren"] = children
    return normalized


def validate_composed_module_children(module_id, children, model):
    modules_root = find_root(model, "modules-root") or {"children": []}
    existing_module_ids = {
        child.get("metadata", {}).get("moduleId")
        for child in modules_root.get("children", [])
    }
    missing = [child["partId"] for child in children if child["partId"] not in existing_module_ids]
    if missing:
        raise ValueError(f"unknown composition child ids: {', '.join(sorted(missing))}")
    if any(child["partId"] == module_id for child in children):
        raise ValueError("compositionChildren cannot include the module being created or updated")


def validate_module_payload(payload, existing_module_id=None):
    model = load_tree_model()
    modules_root = find_root(model, "modules-root") or {"children": []}
    module_nodes = list(modules_root.get("children", []))
    module_ids = {child.get("metadata", {}).get("moduleId") for child in module_nodes}

    try:
        if payload.get("compositionChildren"):
            normalized = normalize_composed_module_payload(payload)
            module_kind = "composed"
            validate_composed_module_children(normalized["moduleId"], normalized["compositionChildren"], model)
        else:
            normalized = normalize_leaf_module_payload(payload)
            module_kind = "leaf"
    except ValueError as error:
        return {
            "valid": False,
            "moduleKind": "unknown",
            "errors": [str(error)],
            "warnings": [],
            "normalized": None,
        }

    errors = []
    warnings = []

    if existing_module_id is not None and normalized["moduleId"] != existing_module_id:
        errors.append("moduleId in payload must match the module id in the request path")

    if existing_module_id is None and normalized["moduleId"] in module_ids:
        errors.append(f"module '{normalized['moduleId']}' already exists")

    if len(normalized["displayName"]) < 3:
        errors.append("displayName must be at least 3 characters long")

    if len(normalized["vendor"]) < 2:
        errors.append("vendor must be at least 2 characters long")

    invalid_interfaces = [entry for entry in normalized["interfaces"] if not INTERFACE_NAME_PATTERN.match(entry)]
    if invalid_interfaces:
        errors.append(f"interfaces contain invalid names: {', '.join(sorted(invalid_interfaces))}")

    api_names = []
    duplicate_api_names = set()
    for entry in normalized["api"]:
        name = entry["name"]
        if not API_NAME_PATTERN.match(name):
            errors.append(f"api entry '{name}' has an invalid name")
        if name in api_names:
            duplicate_api_names.add(name)
        api_names.append(name)
    if duplicate_api_names:
        errors.append(f"api contains duplicate names: {', '.join(sorted(duplicate_api_names))}")

    docs = normalized["docs"]
    if docs["website"] and not re.match(r"^https?://", docs["website"], re.IGNORECASE):
        errors.append("docs.website must be an absolute http or https URL")
    if docs["datasheet"] and not re.match(r"^https?://", docs["datasheet"], re.IGNORECASE):
        errors.append("docs.datasheet must be an absolute http or https URL")

    help_markdown = normalized["helpMarkdown"]
    if help_markdown and not help_markdown.lstrip().startswith("# "):
        warnings.append("helpMarkdown should start with a top-level '# ' heading")
    if not help_markdown:
        warnings.append("helpMarkdown is empty; a generated help page will be used")

    default_config = normalized["defaultConfig"]
    if "i2c" in normalized["interfaces"] and "i2cAddress" not in default_config and module_kind == "leaf":
        warnings.append("leaf modules using i2c should usually declare defaultConfig.i2cAddress")

    if module_kind == "composed":
        children = normalized["compositionChildren"]
        if len(children) < 2:
            warnings.append("composed modules usually contain more than one child module")
        child_roles = [child.get("role") for child in children if child.get("role")]
        if len(child_roles) != len(set(child_roles)):
            warnings.append("compositionChildren reuse one or more role labels")

    return {
        "valid": len(errors) == 0,
        "moduleKind": module_kind,
        "errors": errors,
        "warnings": warnings,
        "normalized": normalized,
    }


def build_composed_module_help_markdown(payload):
    lines = [
        f"# {payload['displayName']}",
        "",
        "## Summary",
        "",
        f"`{payload['moduleId']}` is a user-defined composed module created through the Board Manager Stage 4 web flow.",
        "",
        "## Child Modules",
        "",
    ]
    for child in payload["compositionChildren"]:
        role = f" ({child['role']})" if child.get("role") else ""
        lines.append(f"- `{child['partId']}`{role}")
    lines.extend(["", "## Interfaces", ""])
    if payload["interfaces"]:
        lines.extend([f"- interface: `{entry}`" for entry in payload["interfaces"]])
    else:
        lines.append("- no top-level interfaces declared yet")
    lines.extend(["", "## High-Level API Usage", ""])
    if payload["api"]:
        lines.extend([f"- `{entry['name']}`: {entry['description'] or 'user-defined API entry'}" for entry in payload["api"]])
    else:
        lines.append("- add project-local composed-module API notes here")
    lines.extend(["", "## References", ""])
    if payload["docs"]["website"]:
        lines.append(f"- Website: [{payload['displayName']}]({payload['docs']['website']})")
    if payload["docs"]["datasheet"]:
        lines.append(f"- Datasheet: [Reference PDF]({payload['docs']['datasheet']})")
    if not payload["docs"]["website"] and not payload["docs"]["datasheet"]:
        lines.append("- add vendor and datasheet links here")
    return "\n".join(lines) + "\n"


def build_composed_module_definition(payload):
    definition = build_leaf_module_definition(payload)
    definition["composition"] = {
        "children": [
            {
                "partId": child["partId"],
                "moduleId": child.get("moduleId") or child["partId"],
                "role": child.get("role"),
                "displayName": child.get("displayName"),
                "config": child.get("config") or {},
            }
            for child in payload["compositionChildren"]
        ]
    }
    return definition


def create_composed_module(payload):
    validation = validate_module_payload(payload)
    if not validation["valid"]:
        raise ValueError("; ".join(validation["errors"]))
    normalized = validation["normalized"]

    paths = module_paths(normalized["moduleId"])
    if paths["part"].exists() or paths["help"].exists():
        raise FileExistsError(f"module '{normalized['moduleId']}' already exists on disk")

    help_markdown = normalized["helpMarkdown"] or build_composed_module_help_markdown(normalized)
    definition = build_composed_module_definition(normalized)
    write_module_files(normalized["moduleId"], definition, help_markdown)
    return build_module_write_result(normalized["moduleId"], "created")


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
    validation = validate_module_payload(payload)
    if not validation["valid"]:
        raise ValueError("; ".join(validation["errors"]))
    normalized = validation["normalized"]

    paths = module_paths(normalized["moduleId"])
    if paths["part"].exists() or paths["help"].exists():
        raise FileExistsError(f"module '{normalized['moduleId']}' already exists on disk")

    help_markdown = normalized["helpMarkdown"] or build_leaf_module_help_markdown(normalized)
    definition = build_leaf_module_definition(normalized)
    write_module_files(normalized["moduleId"], definition, help_markdown)
    return build_module_write_result(normalized["moduleId"], "created")


def build_module_edit_payload(model, module_id):
    loaded = load_module_definition(module_id)
    definition = loaded["definition"]
    node = find_node_by_id(find_root(model, "modules-root") or {"children": []}, normalize_id("module:", module_id))
    composition_children = normalize_composition_children(definition.get("composition"))
    return {
        "generatedAt": model.get("generatedAt"),
        "module": {
            "moduleId": definition.get("partId") or module_id,
            "displayName": definition.get("displayName") or (node or {}).get("title"),
            "vendor": definition.get("vendor") or ((node or {}).get("metadata") or {}).get("vendor"),
            "interfaces": definition.get("interfaces") or [],
            "defaultConfig": definition.get("defaultConfig") or {},
            "docs": definition.get("docs") or {},
            "api": ((definition.get("api") or {}).get("highLevel")) or [],
            "origin": definition.get("origin"),
            "sourcePath": str(loaded["paths"]["part"].relative_to(REPO_ROOT)).replace("\\", "/"),
            "helpPath": str(loaded["paths"]["help"].relative_to(REPO_ROOT)).replace("\\", "/"),
            "helpMarkdown": loaded.get("helpMarkdown") or "",
            "supportsComposition": bool(composition_children),
            "compositionChildren": composition_children,
            "editable": definition.get("origin") == "user",
        },
    }


def update_leaf_module(module_id, payload):
    loaded = assert_user_owned_module(module_id)
    validation = validate_module_payload(payload, existing_module_id=module_id)
    if not validation["valid"]:
        raise ValueError("; ".join(validation["errors"]))
    normalized = validation["normalized"]
    help_markdown = normalized["helpMarkdown"] or build_leaf_module_help_markdown(normalized)
    definition = build_leaf_module_definition(normalized)
    write_module_files(module_id, definition, help_markdown)
    return build_module_write_result(module_id, "updated")


def update_composed_module(module_id, payload):
    assert_user_owned_module(module_id)
    validation = validate_module_payload(payload, existing_module_id=module_id)
    if not validation["valid"]:
        raise ValueError("; ".join(validation["errors"]))
    normalized = validation["normalized"]
    help_markdown = normalized["helpMarkdown"] or build_composed_module_help_markdown(normalized)
    definition = build_composed_module_definition(normalized)
    write_module_files(module_id, definition, help_markdown)
    return build_module_write_result(module_id, "updated")



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

    composition_children = normalize_composition_children(metadata.get("composition"))
    if not composition_children:
        composition_children = [
            {
                "partId": (child.get("metadata") or {}).get("partId") or (child.get("metadata") or {}).get("moduleId"),
                "moduleId": (child.get("metadata") or {}).get("moduleId") or (child.get("metadata") or {}).get("partId"),
                "role": (child.get("metadata") or {}).get("role"),
                "displayName": child.get("title"),
                "config": (child.get("metadata") or {}).get("config") or {},
            }
            for child in node.get("children", [])
            if child.get("nodeKind") == "module-reference"
        ]

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
            "compositionChildren": composition_children,
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
def build_board_catalog_payload(model):
    boards_root = find_root(model, "boards-root") or {"children": []}
    boards = list(boards_root.get("children", []))

    vendor_counts = {}
    help_backed_count = 0
    board_items = []
    total_bus_count = 0
    total_signal_count = 0
    total_connector_count = 0

    for board in boards:
        metadata = board.get("metadata", {})
        vendor = metadata.get("vendor") or "unknown"
        vendor_counts[vendor] = vendor_counts.get(vendor, 0) + 1

        buses = [child for child in board.get("children", []) if child.get("nodeKind") == "bus"]
        signals = [child for child in board.get("children", []) if child.get("nodeKind") == "signal"]
        connectors = [child for child in board.get("children", []) if child.get("nodeKind") == "connector"]
        help_refs = [child for child in board.get("children", []) if child.get("nodeKind") == "help-reference"]

        if help_refs:
            help_backed_count += 1

        total_bus_count += len(buses)
        total_signal_count += len(signals)
        total_connector_count += len(connectors)

        board_items.append({
            "boardId": metadata.get("boardId") or board.get("nodeId"),
            "title": board.get("title"),
            "vendor": vendor,
            "revision": metadata.get("revision"),
            "controllerModuleId": metadata.get("controllerModuleId"),
            "capabilityKeys": metadata.get("capabilityKeys") or [],
            "projectIds": metadata.get("projectIds") or [],
            "busCount": len(buses),
            "signalCount": len(signals),
            "connectorCount": len(connectors),
            "helpReferenceCount": len(help_refs),
            "sourcePath": board.get("sourcePath"),
        })

    board_items.sort(key=lambda item: item.get("title") or "")

    return {
        "generatedAt": model.get("generatedAt"),
        "summary": {
            "boardCount": len(boards),
            "vendorCount": len(vendor_counts),
            "helpBackedCount": help_backed_count,
            "totalBusCount": total_bus_count,
            "totalSignalCount": total_signal_count,
            "totalConnectorCount": total_connector_count,
            "vendorCounts": dict(sorted(vendor_counts.items(), key=lambda entry: entry[0].lower())),
        },
        "boards": board_items,
    }


def build_board_detail_payload(model, board_id):
    boards_root = find_root(model, "boards-root") or {"children": []}
    node = find_node_by_id(boards_root, normalize_id("board:", board_id))
    if node is None:
        raise FileNotFoundError(f"board '{board_id}' not found")

    metadata = node.get("metadata", {})
    loaded = load_board_definition(board_id)
    board = loaded["definition"]

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

    module_instances = []
    if board.get("controller", {}).get("moduleId"):
        module_instances.append({
            "instanceId": "controller",
            "moduleId": board["controller"].get("moduleId"),
            "role": "controller",
            "busName": None,
            "config": {},
        })

    buses = []
    for bus in board.get("buses", []) or []:
        bus_devices = []
        for device in bus.get("devices", []) or []:
            entry = {
                "instanceId": device.get("instanceId"),
                "moduleId": device.get("partId"),
                "busName": bus.get("name"),
                "config": device.get("config") or {},
            }
            module_instances.append({**entry, "role": "device"})
            bus_devices.append(entry)
        buses.append({
            "name": bus.get("name"),
            "kind": bus.get("kind"),
            "controllerPeripheral": bus.get("controllerPeripheral"),
            "lines": bus.get("lines") or {},
            "devices": bus_devices,
        })

    generated_artifacts = []
    for suffix in (".h", ".c"):
        artifact = GENERATED_ROOT / f"{board_id}{suffix}"
        if artifact.exists():
            generated_artifacts.append(str(artifact.relative_to(REPO_ROOT)).replace("\\", "/"))

    return {
        "generatedAt": model.get("generatedAt"),
        "board": {
            "boardId": metadata.get("boardId") or board_id,
            "title": node.get("title"),
            "vendor": metadata.get("vendor") or board.get("vendor"),
            "revision": metadata.get("revision") or board.get("revision"),
            "controllerModuleId": metadata.get("controllerModuleId") or board.get("controller", {}).get("moduleId"),
            "capabilityKeys": metadata.get("capabilityKeys") or [],
            "projectIds": metadata.get("projectIds") or [],
            "sourcePath": node.get("sourcePath"),
            "generatedArtifacts": generated_artifacts,
        },
        "moduleInstances": module_instances,
        "buses": buses,
        "signals": board.get("signals") or [],
        "connectors": board.get("connectors") or [],
        "bootSequence": board.get("bootSequence") or [],
        "validation": {
            "candidates": build_board_validation_candidates(board_id),
            "latest": summarize_validation_report(find_latest_validation_report(board_id=board_id)),
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




def build_board_edit_payload(model, board_id):
    detail = build_board_detail_payload(model, board_id)
    loaded = load_board_definition(board_id)
    definition = loaded["definition"]
    modules_root = find_root(model, "modules-root") or {"children": []}
    controller_options = []
    module_options = []

    for node in modules_root.get("children", []):
        metadata = node.get("metadata", {})
        entry = {
            "moduleId": metadata.get("moduleId"),
            "title": node.get("title"),
            "vendor": metadata.get("vendor"),
            "catalogRole": metadata.get("catalogRole"),
            "partType": metadata.get("partType"),
        }
        module_options.append(entry)
        if metadata.get("catalogRole") == "controller":
            controller_options.append(entry)

    controller_options.sort(key=lambda item: item.get("title") or "")
    module_options.sort(key=lambda item: item.get("title") or "")

    return {
        "generatedAt": model.get("generatedAt"),
        "board": {
            "boardId": definition.get("boardId") or board_id,
            "displayName": definition.get("displayName") or detail["board"]["title"],
            "vendor": definition.get("vendor"),
            "revision": definition.get("revision"),
            "productSku": definition.get("productSku"),
            "controllerModuleId": (definition.get("controller") or {}).get("moduleId"),
            "capabilities": definition.get("capabilities") or {},
            "power": definition.get("power") or {},
            "signals": definition.get("signals") or [],
            "buses": definition.get("buses") or [],
            "connectors": definition.get("connectors") or [],
            "bootSequence": definition.get("bootSequence") or [],
            "sources": definition.get("sources") or [],
            "sourcePath": str(loaded["path"].relative_to(REPO_ROOT)).replace("\\", "/"),
            "helpPath": str(loaded["helpPath"].relative_to(REPO_ROOT)).replace("\\", "/"),
            "helpMarkdown": loaded.get("helpMarkdown") or "",
            "editable": True,
        },
        "options": {
            "controllers": controller_options,
            "modules": module_options,
        },
    }


def normalize_board_update_payload(payload, existing_board_id=None):
    if not isinstance(payload, dict):
        raise ValueError("board payload must be a JSON object")
    board_id = str(payload.get("boardId") or existing_board_id or "").strip()
    if not MODULE_ID_PATTERN.match(board_id):
        raise ValueError("boardId must match ^[a-z][a-z0-9_]*$")
    if existing_board_id and board_id != existing_board_id:
        raise ValueError("boardId cannot be changed during board update")
    display_name = str(payload.get("displayName") or "").strip()
    if not display_name:
        raise ValueError("displayName is required")
    vendor = str(payload.get("vendor") or "").strip()
    if not vendor:
        raise ValueError("vendor is required")
    revision = str(payload.get("revision") or "").strip() or "1.0"
    controller_module_id = str(payload.get("controllerModuleId") or "").strip()
    if not controller_module_id:
        raise ValueError("controllerModuleId is required")

    def ensure_object(name):
        value = payload.get(name)
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise ValueError(f"{name} must be a JSON object")
        return value

    def ensure_array(name):
        value = payload.get(name)
        if value is None:
            return []
        if not isinstance(value, list):
            raise ValueError(f"{name} must be a JSON array")
        return value

    sources = []
    for source in ensure_array("sources"):
        text = str(source).strip()
        if text:
            sources.append(text)

    return {
        "boardId": board_id,
        "displayName": display_name,
        "vendor": vendor,
        "revision": revision,
        "productSku": str(payload.get("productSku") or "").strip(),
        "controllerModuleId": controller_module_id,
        "capabilities": ensure_object("capabilities"),
        "power": ensure_object("power"),
        "signals": ensure_array("signals"),
        "buses": ensure_array("buses"),
        "connectors": ensure_array("connectors"),
        "bootSequence": ensure_array("bootSequence"),
        "sources": sources,
        "helpMarkdown": str(payload.get("helpMarkdown") or "").strip(),
    }


def build_updated_board_definition(existing_definition, normalized):
    definition = json.loads(json.dumps(existing_definition))
    definition["boardId"] = normalized["boardId"]
    definition["displayName"] = normalized["displayName"]
    definition["vendor"] = normalized["vendor"]
    definition["revision"] = normalized["revision"]
    if normalized.get("productSku"):
        definition["productSku"] = normalized["productSku"]
    elif "productSku" in definition:
        definition.pop("productSku", None)
    definition["controller"] = {"moduleId": normalized["controllerModuleId"]}
    definition["capabilities"] = normalized["capabilities"]
    definition["power"] = normalized["power"]
    definition["signals"] = normalized["signals"]
    definition["buses"] = normalized["buses"]
    definition["connectors"] = normalized["connectors"]
    definition["bootSequence"] = normalized["bootSequence"]
    definition["sources"] = normalized["sources"]
    return definition


def update_board(board_id, payload):
    loaded = load_board_definition(board_id)
    normalized = normalize_board_update_payload(payload, existing_board_id=board_id)
    definition = build_updated_board_definition(loaded["definition"], normalized)
    help_markdown = normalized["helpMarkdown"] or loaded.get("helpMarkdown") or ""
    write_board_files(board_id, definition, help_markdown)
    return build_board_write_result(board_id, "updated")

def run_board_validation(payload):
    if not isinstance(payload, dict):
        raise ValueError("validation payload must be a JSON object")
    board_id = str(payload.get("boardId") or "").strip()
    unit_id = str(payload.get("unitId") or "").strip()
    if not board_id:
        raise ValueError("boardId is required")
    if not unit_id:
        raise ValueError("unitId is required")
    seconds = int(payload.get("seconds") or 4)
    if seconds < 1 or seconds > 30:
        raise ValueError("seconds must be between 1 and 30")

    unit = find_inventory_unit(unit_id)
    port = ((unit.get("transport") or {}).get("port") or "").strip()
    if not port:
        raise ValueError(f"unit '{unit_id}' does not expose a serial port for validation")

    result = subprocess.run(
        [
            "node",
            str(PROJECT_ROOT / "scripts" / "run-stage3-validation.mjs"),
            "--board",
            board_id,
            "--unit",
            unit_id,
            "--port",
            port,
            "--seconds",
            str(seconds),
        ],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        check=False,
    )

    stdout_text = (result.stdout or "").strip()
    stderr_text = (result.stderr or "").strip()
    payload_data = None
    if stdout_text:
        try:
            payload_data = json.loads(stdout_text)
        except json.JSONDecodeError:
            payload_data = None

    if payload_data is None:
        message = stderr_text or stdout_text or f"validation runner exited with code {result.returncode}"
        raise RuntimeError(message)

    report_path = Path(payload_data.get("reportPath") or "")
    if not report_path.exists():
        raise FileNotFoundError("validation report was not written")
    report = read_json(report_path, None)
    if report is None:
        raise RuntimeError("validation report could not be parsed")
    report["__fileName"] = report_path.name

    return {
        "executed": {
            "boardId": board_id,
            "unitId": unit_id,
            "port": port,
            "seconds": seconds,
            "exitCode": result.returncode,
        },
        "latest": summarize_validation_report(report),
        "raw": payload_data,
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
            if parsed.path == "/api/stage4/module-validate":
                payload = self._read_json_body()
                self._send_json(200, validate_module_payload(payload))
                return
            if parsed.path == "/api/stage4/board-create-from-unit":
                payload = self._read_json_body()
                self._send_json(201, create_board_from_unit(payload))
                return
            if parsed.path == "/api/stage4/board-create-manual":
                payload = self._read_json_body()
                self._send_json(201, create_board_manual(payload))
                return
            if parsed.path == "/api/stage4/board-validate":
                payload = self._read_json_body()
                self._send_json(200, run_board_validation(payload))
                return
            if parsed.path == "/api/stage4/module-create":
                payload = self._read_json_body()
                self._send_json(201, create_leaf_module(payload))
                return
            if parsed.path == "/api/stage4/module-compose":
                payload = self._read_json_body()
                self._send_json(201, create_composed_module(payload))
                return
            self._send_json(404, {"error": "not_found"})
        except FileExistsError as error:
            self._send_json(409, {"error": "already_exists", "message": str(error)})
        except ValueError as error:
            self._send_json(400, {"error": "invalid_request", "message": str(error)})
        except PermissionError as error:
            self._send_json(403, {"error": "forbidden", "message": str(error)})
        except FileNotFoundError as error:
            self._send_json(404, {"error": "not_found", "message": str(error)})
        except Exception as error:
            self._send_json(500, {"error": "internal_error", "message": str(error)})

    def do_PUT(self):
        try:
            parsed = urlparse(self.path)
            if parsed.path.startswith("/api/stage4/modules/"):
                module_id = parsed.path.rsplit("/", 1)[-1]
                payload = self._read_json_body()
                if payload.get("compositionChildren"):
                    self._send_json(200, update_composed_module(module_id, payload))
                else:
                    self._send_json(200, update_leaf_module(module_id, payload))
                return
            if parsed.path.startswith("/api/stage4/boards/"):
                board_id = parsed.path.rsplit("/", 1)[-1]
                payload = self._read_json_body()
                self._send_json(200, update_board(board_id, payload))
                return
            self._send_json(404, {"error": "not_found"})
        except ValueError as error:
            self._send_json(400, {"error": "invalid_request", "message": str(error)})
        except PermissionError as error:
            self._send_json(403, {"error": "forbidden", "message": str(error)})
        except FileNotFoundError as error:
            self._send_json(404, {"error": "not_found", "message": str(error)})
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

            if parsed.path == "/api/stage4/dashboard/boards":
                self._send_json(200, build_board_catalog_payload(model))
                return

            if parsed.path == "/api/stage4/board-create-candidates":
                inventory = load_inventory()
                candidates = []
                for unit in inventory.get("units", []):
                    candidates.append({
                        "unitId": unit.get("unitId"),
                        "label": (unit.get("annotation") or {}).get("label"),
                        "port": (unit.get("transport") or {}).get("port"),
                        "boardId": (unit.get("match") or {}).get("boardId"),
                        "chip": (unit.get("observed") or {}).get("chip"),
                        "firmwareBoard": (unit.get("observed") or {}).get("firmwareBoard"),
                    })
                self._send_json(200, {"generatedAt": inventory.get("generatedAt"), "units": candidates})
                return

            if parsed.path == "/api/stage4/board-create-manual-options":
                self._send_json(200, build_manual_board_create_options(model))
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

            if parsed.path.startswith("/api/stage4/board-detail/"):
                board_id = parsed.path.rsplit("/", 1)[-1]
                self._send_json(200, build_board_detail_payload(model, board_id))
                return

            if parsed.path.startswith("/api/stage4/board-create-guess/"):
                unit_id = parsed.path.rsplit("/", 1)[-1]
                self._send_json(200, build_board_guess_payload(unit_id))
                return

            if parsed.path.startswith("/api/stage4/module-edit/"):
                module_id = parsed.path.rsplit("/", 1)[-1]
                self._send_json(200, build_module_edit_payload(model, module_id))
                return

            if parsed.path.startswith("/api/stage4/board-edit/"):
                board_id = parsed.path.rsplit("/", 1)[-1]
                self._send_json(200, build_board_edit_payload(model, board_id))
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
                        "/api/stage4/dashboard/boards",
                        "/api/stage4/board-create-candidates",
                        "/api/stage4/board-create-manual-options",
                        "/api/stage4/tree",
                        "/api/stage4/modules",
                        "/api/stage4/modules/<moduleId>",
                        "/api/stage4/module-help/<moduleId>",
                        "/api/stage4/board-detail/<boardId>",
                        "/api/stage4/board-edit/<boardId>",
                        "/api/stage4/board-create-guess/<unitId>",
                        "/api/stage4/module-edit/<moduleId>",
                        "POST /api/stage4/module-validate",
                        "POST /api/stage4/board-create-from-unit",
                        "POST /api/stage4/board-create-manual",
                        "POST /api/stage4/board-validate",
                        "/api/stage4/boards",
                        "/api/stage4/boards/<boardId>",
                        "/api/stage4/projects",
                        "/api/stage4/projects/<projectId>",
                        "/api/stage4/help?path=project/help/parts/bm8563.md",
                        "POST /api/stage4/module-create",
                        "POST /api/stage4/module-compose",
                        "PUT /api/stage4/modules/<moduleId>",
                        "PUT /api/stage4/boards/<boardId>",
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
