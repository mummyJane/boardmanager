PRAGMA journal_mode=DELETE;
PRAGMA foreign_keys=ON;

CREATE TABLE sync_state (
  dataset TEXT PRIMARY KEY,
  generated_at TEXT,
  record_count INTEGER NOT NULL,
  source_path TEXT NOT NULL
);

CREATE TABLE inventory_snapshots (
  generated_at TEXT PRIMARY KEY,
  host_platform TEXT,
  host_hostname TEXT,
  json_payload TEXT NOT NULL
);

CREATE TABLE unit_history_snapshots (
  generated_at TEXT PRIMARY KEY,
  host_platform TEXT,
  host_hostname TEXT,
  json_payload TEXT NOT NULL
);

CREATE TABLE annotation_snapshots (
  updated_at TEXT PRIMARY KEY,
  json_payload TEXT NOT NULL
);

CREATE TABLE discovery_run_snapshots (
  run_id TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  host_platform TEXT,
  host_hostname TEXT,
  unit_count INTEGER NOT NULL,
  family_count INTEGER NOT NULL,
  json_payload TEXT NOT NULL
);

CREATE TABLE units (
  stable_key TEXT PRIMARY KEY,
  family_key TEXT,
  profile_id TEXT,
  board_id TEXT,
  present INTEGER NOT NULL,
  first_seen_at TEXT,
  last_seen_at TEXT,
  last_present_at TEXT,
  last_missing_at TEXT,
  seen_count INTEGER NOT NULL,
  missing_count INTEGER NOT NULL,
  label TEXT,
  owner TEXT,
  location TEXT,
  purpose TEXT,
  usb_instance TEXT,
  mac TEXT,
  serial_number TEXT,
  present_port TEXT,
  firmware_app TEXT,
  firmware_version TEXT,
  firmware_build_id TEXT,
  firmware_board TEXT,
  firmware_capabilities TEXT,
  agent_line TEXT,
  raw_json TEXT NOT NULL
);

CREATE TABLE unit_board_ids (
  stable_key TEXT NOT NULL,
  board_id TEXT NOT NULL,
  PRIMARY KEY (stable_key, board_id),
  FOREIGN KEY (stable_key) REFERENCES units(stable_key) ON DELETE CASCADE
);

CREATE TABLE unit_aliases (
  stable_key TEXT NOT NULL,
  alias TEXT NOT NULL,
  PRIMARY KEY (stable_key, alias),
  FOREIGN KEY (stable_key) REFERENCES units(stable_key) ON DELETE CASCADE
);

CREATE TABLE unit_metadata_entries (
  stable_key TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  owner TEXT,
  location TEXT,
  purpose TEXT,
  PRIMARY KEY (stable_key, updated_at),
  FOREIGN KEY (stable_key) REFERENCES units(stable_key) ON DELETE CASCADE
);

CREATE TABLE unit_transitions (
  stable_key TEXT NOT NULL,
  transition_name TEXT NOT NULL,
  at TEXT,
  state TEXT,
  PRIMARY KEY (stable_key, transition_name),
  FOREIGN KEY (stable_key) REFERENCES units(stable_key) ON DELETE CASCADE
);

CREATE TABLE unit_annotations (
  stable_key TEXT PRIMARY KEY,
  label TEXT,
  owner TEXT,
  location TEXT,
  purpose TEXT,
  updated_at TEXT,
  raw_json TEXT NOT NULL
);

CREATE TABLE families (
  family_key TEXT PRIMARY KEY,
  profile_id TEXT,
  board_id TEXT,
  status TEXT,
  present INTEGER NOT NULL,
  first_seen_at TEXT,
  last_seen_at TEXT,
  last_present_at TEXT,
  last_missing_at TEXT,
  present_unit_count INTEGER NOT NULL,
  missing_unit_count INTEGER NOT NULL,
  seen_count INTEGER NOT NULL,
  fingerprint_key TEXT,
  vid TEXT,
  pid TEXT,
  chip_family TEXT,
  chip TEXT,
  description TEXT,
  name TEXT,
  firmware_signature TEXT,
  raw_json TEXT NOT NULL
);

CREATE TABLE family_board_ids (
  family_key TEXT NOT NULL,
  board_id TEXT NOT NULL,
  PRIMARY KEY (family_key, board_id),
  FOREIGN KEY (family_key) REFERENCES families(family_key) ON DELETE CASCADE
);

CREATE TABLE family_sample_units (
  family_key TEXT NOT NULL,
  stable_key TEXT NOT NULL,
  PRIMARY KEY (family_key, stable_key),
  FOREIGN KEY (family_key) REFERENCES families(family_key) ON DELETE CASCADE
);

CREATE TABLE family_transitions (
  family_key TEXT NOT NULL,
  transition_name TEXT NOT NULL,
  at TEXT,
  state TEXT,
  PRIMARY KEY (family_key, transition_name),
  FOREIGN KEY (family_key) REFERENCES families(family_key) ON DELETE CASCADE
);

CREATE TABLE discovery_run_units (
  run_id TEXT NOT NULL,
  stable_key TEXT NOT NULL,
  board_id TEXT,
  family_key TEXT,
  port TEXT,
  usb_instance TEXT,
  firmware_app TEXT,
  firmware_version TEXT,
  firmware_build_id TEXT,
  firmware_board TEXT,
  firmware_capabilities TEXT,
  agent_line TEXT,
  label TEXT,
  PRIMARY KEY (run_id, stable_key),
  FOREIGN KEY (run_id) REFERENCES discovery_run_snapshots(run_id) ON DELETE CASCADE
);

CREATE TABLE discovery_run_families (
  run_id TEXT NOT NULL,
  family_key TEXT NOT NULL,
  board_id TEXT,
  present_unit_count INTEGER NOT NULL,
  PRIMARY KEY (run_id, family_key),
  FOREIGN KEY (run_id) REFERENCES discovery_run_snapshots(run_id) ON DELETE CASCADE
);

CREATE INDEX idx_units_family_key ON units(family_key);
CREATE INDEX idx_units_present ON units(present);
CREATE INDEX idx_units_board_id ON units(board_id);
CREATE INDEX idx_families_present ON families(present);
CREATE INDEX idx_discovery_run_units_stable_key ON discovery_run_units(stable_key);
CREATE INDEX idx_discovery_run_families_family_key ON discovery_run_families(family_key);
