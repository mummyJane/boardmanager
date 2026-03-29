import json
import os
import sqlite3
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DEVICE_MANAGER_ROOT = PROJECT_ROOT / "device-manager"
DATA_ROOT = DEVICE_MANAGER_ROOT / "data"
SCHEMA_PATH = DEVICE_MANAGER_ROOT / "schema" / "device-manager.sqlite.sql"
DB_PATH = DATA_ROOT / "device-manager.sqlite"
TEMP_DB_PATH = DATA_ROOT / "device-manager.sqlite.tmp"


def read_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return fallback


def to_int(value):
    return 0 if value is False or value is None else 1 if value is True else int(value)


def latest(values):
    if isinstance(values, list) and values:
        return values[-1]
    return None


def sync_database():
    inventory = read_json(DATA_ROOT / "inventory.json", {"generatedAt": None, "host": {}, "units": []})
    history = read_json(DATA_ROOT / "unit-history.json", {"generatedAt": None, "host": {}, "units": [], "families": []})
    annotations = read_json(DATA_ROOT / "unit-annotations.json", {"updatedAt": None, "units": []})
    discovery_runs = read_json(DATA_ROOT / "discovery-runs.json", {"generatedAt": None, "host": {}, "runs": []})

    if TEMP_DB_PATH.exists():
        TEMP_DB_PATH.unlink()

    connection = sqlite3.connect(TEMP_DB_PATH)
    try:
        connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))

        connection.execute(
            "INSERT INTO inventory_snapshots (generated_at, host_platform, host_hostname, json_payload) VALUES (?, ?, ?, ?)",
            (
                inventory.get("generatedAt"),
                inventory.get("host", {}).get("platform"),
                inventory.get("host", {}).get("hostname"),
                json.dumps(inventory, indent=2),
            ),
        )
        connection.execute(
            "INSERT INTO unit_history_snapshots (generated_at, host_platform, host_hostname, json_payload) VALUES (?, ?, ?, ?)",
            (
                history.get("generatedAt"),
                history.get("host", {}).get("platform"),
                history.get("host", {}).get("hostname"),
                json.dumps(history, indent=2),
            ),
        )
        connection.execute(
            "INSERT INTO annotation_snapshots (updated_at, json_payload) VALUES (?, ?)",
            (annotations.get("updatedAt"), json.dumps(annotations, indent=2)),
        )

        connection.executemany(
            "INSERT INTO sync_state (dataset, generated_at, record_count, source_path) VALUES (?, ?, ?, ?)",
            [
                ("inventory", inventory.get("generatedAt"), len(inventory.get("units", [])), str(DATA_ROOT / "inventory.json")),
                ("unit_history", history.get("generatedAt"), len(history.get("units", [])), str(DATA_ROOT / "unit-history.json")),
                ("annotations", annotations.get("updatedAt"), len(annotations.get("units", [])), str(DATA_ROOT / "unit-annotations.json")),
                ("discovery_runs", discovery_runs.get("generatedAt"), len(discovery_runs.get("runs", [])), str(DATA_ROOT / "discovery-runs.json")),
            ],
        )

        for unit in history.get("units", []):
            observed = unit.get("observed", {})
            identity = unit.get("identity", {})
            annotation = unit.get("annotation", {})
            connection.execute(
                """
                INSERT INTO units (
                  stable_key, family_key, profile_id, board_id, present, first_seen_at, last_seen_at,
                  last_present_at, last_missing_at, seen_count, missing_count, label, owner, location,
                  purpose, usb_instance, mac, serial_number, present_port, firmware_app,
                  firmware_version, firmware_build_id, firmware_board, firmware_capabilities,
                  agent_line, raw_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    unit.get("stableKey"),
                    unit.get("familyKey"),
                    unit.get("profileId"),
                    latest(unit.get("boardIds")),
                    to_int(unit.get("present") is not False),
                    unit.get("firstSeenAt"),
                    unit.get("lastSeenAt"),
                    unit.get("lastPresentAt"),
                    unit.get("lastMissingAt"),
                    unit.get("seenCount", 0),
                    unit.get("missingCount", 0),
                    annotation.get("label"),
                    annotation.get("owner"),
                    annotation.get("location"),
                    annotation.get("purpose"),
                    identity.get("usbInstance"),
                    identity.get("mac"),
                    identity.get("serialNumber"),
                    unit.get("lastTransport", {}).get("port"),
                    latest(observed.get("firmwareApps")),
                    latest(observed.get("firmwareVersions")),
                    latest(observed.get("firmwareBuildIds")),
                    latest(observed.get("firmwareBoards")),
                    latest(observed.get("agentCapabilitySets")),
                    latest(observed.get("agentLines")),
                    json.dumps(unit, indent=2),
                ),
            )
            for board_id in unit.get("boardIds", []):
                connection.execute("INSERT INTO unit_board_ids (stable_key, board_id) VALUES (?, ?)", (unit.get("stableKey"), board_id))
            for alias in identity.get("aliases", []):
                connection.execute("INSERT INTO unit_aliases (stable_key, alias) VALUES (?, ?)", (unit.get("stableKey"), alias))
            for prior_stable_key in identity.get("priorStableKeys", []):
                connection.execute("INSERT INTO unit_aliases (stable_key, alias) VALUES (?, ?)", (unit.get("stableKey"), prior_stable_key))
            for entry in unit.get("metadataHistory", {}).get("entries", []):
                connection.execute(
                    "INSERT INTO unit_metadata_entries (stable_key, updated_at, owner, location, purpose) VALUES (?, ?, ?, ?, ?)",
                    (unit.get("stableKey"), entry.get("updatedAt"), entry.get("owner"), entry.get("location"), entry.get("purpose")),
                )
            for transition_name, transition in (unit.get("transitions") or {}).items():
                if transition_name and isinstance(transition, dict):
                    connection.execute(
                        "INSERT INTO unit_transitions (stable_key, transition_name, at, state) VALUES (?, ?, ?, ?)",
                        (unit.get("stableKey"), transition_name, transition.get("at"), transition.get("state")),
                    )

        for annotation in annotations.get("units", []):
            connection.execute(
                "INSERT INTO unit_annotations (stable_key, label, owner, location, purpose, updated_at, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    annotation.get("stableKey"),
                    annotation.get("label"),
                    annotation.get("owner"),
                    annotation.get("location"),
                    annotation.get("purpose"),
                    annotation.get("updatedAt"),
                    json.dumps(annotation, indent=2),
                ),
            )

        for family in history.get("families", []):
            fingerprint = family.get("fingerprint", {})
            connection.execute(
                """
                INSERT INTO families (
                  family_key, profile_id, board_id, status, present, first_seen_at, last_seen_at,
                  last_present_at, last_missing_at, present_unit_count, missing_unit_count, seen_count,
                  fingerprint_key, vid, pid, chip_family, chip, description, name, firmware_signature, raw_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    family.get("familyKey"),
                    family.get("profileId"),
                    latest(family.get("boardIds")),
                    family.get("status"),
                    to_int(family.get("present") is not False),
                    family.get("firstSeenAt"),
                    family.get("lastSeenAt"),
                    family.get("lastPresentAt"),
                    family.get("lastMissingAt"),
                    family.get("presentUnitCount", 0),
                    family.get("missingUnitCount", 0),
                    family.get("seenCount", 0),
                    fingerprint.get("fingerprintKey"),
                    fingerprint.get("vid"),
                    fingerprint.get("pid"),
                    fingerprint.get("chipFamily"),
                    fingerprint.get("chip"),
                    fingerprint.get("description"),
                    fingerprint.get("name"),
                    fingerprint.get("firmwareSignature"),
                    json.dumps(family, indent=2),
                ),
            )
            for board_id in family.get("boardIds", []):
                connection.execute("INSERT INTO family_board_ids (family_key, board_id) VALUES (?, ?)", (family.get("familyKey"), board_id))
            for stable_key in family.get("sampleUnitIds", []):
                connection.execute("INSERT INTO family_sample_units (family_key, stable_key) VALUES (?, ?)", (family.get("familyKey"), stable_key))
            for transition_name, transition in (family.get("transitions") or {}).items():
                if transition_name and isinstance(transition, dict):
                    connection.execute(
                        "INSERT INTO family_transitions (family_key, transition_name, at, state) VALUES (?, ?, ?, ?)",
                        (family.get("familyKey"), transition_name, transition.get("at"), transition.get("state")),
                    )

        for run in discovery_runs.get("runs", []):
            connection.execute(
                "INSERT INTO discovery_run_snapshots (run_id, generated_at, host_platform, host_hostname, unit_count, family_count, json_payload) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    run.get("runId"),
                    run.get("generatedAt"),
                    run.get("host", {}).get("platform"),
                    run.get("host", {}).get("hostname"),
                    run.get("unitCount", 0),
                    run.get("familyCount", 0),
                    json.dumps(run, indent=2),
                ),
            )
            for unit in run.get("units", []):
                connection.execute(
                    "INSERT INTO discovery_run_units (run_id, stable_key, board_id, family_key, port, usb_instance, firmware_app, firmware_version, firmware_build_id, firmware_board, firmware_capabilities, agent_line, label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        run.get("runId"),
                        unit.get("stableKey"),
                        unit.get("boardId"),
                        unit.get("familyKey"),
                        unit.get("port"),
                        unit.get("usbInstance"),
                        unit.get("firmwareApp"),
                        unit.get("firmwareVersion"),
                        unit.get("firmwareBuildId"),
                        unit.get("firmwareBoard"),
                        ",".join(unit.get("agentCapabilities", [])) if isinstance(unit.get("agentCapabilities"), list) else unit.get("agentCapabilities"),
                        unit.get("agentLine"),
                        unit.get("label"),
                    ),
                )
            for family in run.get("families", []):
                connection.execute(
                    "INSERT INTO discovery_run_families (run_id, family_key, board_id, present_unit_count) VALUES (?, ?, ?, ?)",
                    (
                        run.get("runId"),
                        family.get("familyKey"),
                        family.get("boardId"),
                        family.get("presentUnitCount", 0),
                    ),
                )

        connection.commit()
    finally:
        connection.close()

    os.replace(TEMP_DB_PATH, DB_PATH)
    print(f"Synced SQLite database to {DB_PATH}")


if __name__ == "__main__":
    sync_database()
