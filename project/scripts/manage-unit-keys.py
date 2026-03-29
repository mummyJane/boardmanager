import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from datetime import datetime, timezone

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
KEYS_ROOT = REPO_ROOT / "keys"
ROOT_DIR = KEYS_ROOT / "root"
UNITS_DIR = KEYS_ROOT / "units"
UNIT_HISTORY_PATH = REPO_ROOT / "project" / "device-manager" / "data" / "unit-history.json"
INDEX_PATH = KEYS_ROOT / "key-manifest-index.json"


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sanitize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_") or "unit"


def short_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]


def rel(path: Path) -> str:
    return path.relative_to(REPO_ROOT).as_posix()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def load_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return fallback


def save_json(path: Path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def run_openssl(*args):
    subprocess.run(["openssl", *args], cwd=REPO_ROOT, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def ensure_root(args):
    ROOT_DIR.mkdir(parents=True, exist_ok=True)
    private_path = ROOT_DIR / "root-signing-private.pem"
    public_path = ROOT_DIR / "root-signing-public.pem"
    manifest_path = ROOT_DIR / "root-manifest.json"
    existing_manifest = load_json(manifest_path, None)

    if private_path.exists() and public_path.exists() and existing_manifest and not args.rotate_root:
        return existing_manifest

    generation = (existing_manifest or {}).get("generation", 0) + 1
    created_at = now_iso()

    run_openssl("genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:3072", "-out", str(private_path))
    run_openssl("pkey", "-in", str(private_path), "-pubout", "-out", str(public_path))

    manifest = {
        "manifestVersion": 1,
        "rootKeyId": f"root-{short_hash(rel(public_path))}",
        "role": "board-manager-root-signer",
        "algorithm": "RSA-3072",
        "generation": generation,
        "createdAt": created_at,
        "publicKeyPath": rel(public_path),
        "privateKeyPath": rel(private_path),
        "publicKeySha256": sha256_file(public_path),
        "privateKeySha256": sha256_file(private_path),
        "storage": {
            "mode": "local-only",
            "gitIgnored": True,
            "note": "Root signing material is generated and stored locally under keys/."
        },
        "usage": {
            "signs": ["unit-key-payload"],
            "replacesLater": "Board-generated unit keypairs may replace board-manager-generated unit keypairs in later stages."
        }
    }
    save_json(manifest_path, manifest)
    return manifest


def archive_existing_generation(unit_dir: Path, generation: int):
    archive_dir = unit_dir / "archive" / f"generation_{generation:03d}"
    archive_dir.mkdir(parents=True, exist_ok=True)
    for name in [
        "aes-256.key.bin",
        "identity-private.pem",
        "identity-public.pem",
        "unit-key-payload.json",
        "unit-key-payload.sig",
        "manifest.json",
    ]:
        src = unit_dir / name
        if src.exists():
            shutil.move(str(src), str(archive_dir / name))


def load_units(selected_unit: str | None):
    history = load_json(UNIT_HISTORY_PATH, {"units": []})
    units = history.get("units", [])
    if selected_unit:
        units = [unit for unit in units if unit.get("stableKey") == selected_unit]
    return units


def ensure_unit_material(unit, root_manifest, args):
    stable_key = unit["stableKey"]
    unit_slug = f"unit_{short_hash(stable_key)}_{sanitize(stable_key)[:48]}"
    unit_dir = UNITS_DIR / unit_slug
    unit_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = unit_dir / "manifest.json"
    existing_manifest = load_json(manifest_path, None)

    if existing_manifest and not args.rotate:
        return existing_manifest

    if existing_manifest and args.rotate:
        archive_existing_generation(unit_dir, existing_manifest.get("generation", 1))

    generation = (existing_manifest or {}).get("generation", 0) + 1
    created_at = now_iso()

    aes_path = unit_dir / "aes-256.key.bin"
    private_path = unit_dir / "identity-private.pem"
    public_path = unit_dir / "identity-public.pem"
    payload_path = unit_dir / "unit-key-payload.json"
    signature_path = unit_dir / "unit-key-payload.sig"

    aes_bytes = os.urandom(32)
    aes_path.write_bytes(aes_bytes)

    run_openssl("genpkey", "-algorithm", "ED25519", "-out", str(private_path))
    run_openssl("pkey", "-in", str(private_path), "-pubout", "-out", str(public_path))

    payload = {
        "payloadVersion": 1,
        "stableKey": stable_key,
        "boardIds": unit.get("boardIds", []),
        "familyKey": unit.get("familyKey"),
        "profileId": unit.get("profileId"),
        "generation": generation,
        "createdAt": created_at,
        "source": {
            "mode": "board-manager-generated",
            "note": "Later stages may replace this with a board-generated keypair during board setup."
        },
        "aesKey": {
            "keyId": f"aes256-{short_hash(stable_key + '-aes-' + str(generation))}",
            "algorithm": "AES-256",
            "path": rel(aes_path),
            "sha256": sha256_bytes(aes_bytes)
        },
        "identityKeyPair": {
            "keyId": f"ed25519-{short_hash(stable_key + '-ed25519-' + str(generation))}",
            "algorithm": "Ed25519",
            "privateKeyPath": rel(private_path),
            "publicKeyPath": rel(public_path),
            "publicKeySha256": sha256_file(public_path),
            "privateKeySha256": sha256_file(private_path)
        },
        "rootSigner": {
            "rootKeyId": root_manifest["rootKeyId"],
            "algorithm": root_manifest["algorithm"],
            "publicKeyPath": root_manifest["publicKeyPath"],
            "publicKeySha256": root_manifest["publicKeySha256"]
        }
    }
    save_json(payload_path, payload)

    root_private = REPO_ROOT / root_manifest["privateKeyPath"]
    root_public = REPO_ROOT / root_manifest["publicKeyPath"]
    run_openssl("dgst", "-sha256", "-sign", str(root_private), "-out", str(signature_path), str(payload_path))
    verify = subprocess.run(
        ["openssl", "dgst", "-sha256", "-verify", str(root_public), "-signature", str(signature_path), str(payload_path)],
        cwd=REPO_ROOT,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    manifest = {
        "manifestVersion": 1,
        "stableKey": stable_key,
        "boardIds": unit.get("boardIds", []),
        "familyKey": unit.get("familyKey"),
        "profileId": unit.get("profileId"),
        "generation": generation,
        "createdAt": created_at,
        "lastRotatedAt": created_at,
        "state": "active",
        "origin": "board-manager-local",
        "payloadPath": rel(payload_path),
        "payloadSha256": sha256_file(payload_path),
        "payloadSignaturePath": rel(signature_path),
        "payloadSignatureSha256": sha256_file(signature_path),
        "signatureVerification": verify.stdout.strip() or "Verified OK",
        "aesKey": payload["aesKey"],
        "identityKeyPair": payload["identityKeyPair"],
        "rootSigner": payload["rootSigner"],
        "storage": {
            "rootDir": rel(unit_dir),
            "gitIgnored": True,
            "note": "Secret material is stored locally under keys/ and is not committed to git."
        }
    }
    save_json(manifest_path, manifest)
    return manifest


def rebuild_index(root_manifest, unit_manifests):
    index = {
        "manifestVersion": 1,
        "generatedAt": now_iso(),
        "rootSigner": {
            "rootKeyId": root_manifest["rootKeyId"],
            "algorithm": root_manifest["algorithm"],
            "publicKeyPath": root_manifest["publicKeyPath"],
            "publicKeySha256": root_manifest["publicKeySha256"],
        },
        "units": [
            {
                "stableKey": manifest["stableKey"],
                "boardIds": manifest.get("boardIds", []),
                "familyKey": manifest.get("familyKey"),
                "generation": manifest["generation"],
                "state": manifest["state"],
                "manifestPath": rel((UNITS_DIR / f"unit_{short_hash(manifest['stableKey'])}_{sanitize(manifest['stableKey'])[:48]}" / "manifest.json")),
                "payloadPath": manifest["payloadPath"],
                "payloadSignaturePath": manifest["payloadSignaturePath"],
                "aesKeyId": manifest["aesKey"]["keyId"],
                "identityKeyId": manifest["identityKeyPair"]["keyId"],
                "lastRotatedAt": manifest["lastRotatedAt"],
            }
            for manifest in sorted(unit_manifests, key=lambda item: item["stableKey"])
        ],
    }
    save_json(INDEX_PATH, index)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--unit")
    parser.add_argument("--all-units", action="store_true")
    parser.add_argument("--rotate", action="store_true")
    parser.add_argument("--rotate-root", action="store_true")
    parser.add_argument("--ensure-root-only", action="store_true")
    args = parser.parse_args()
    if not args.ensure_root_only and not args.all_units and not args.unit:
        parser.error("Use --all-units, --unit <stableKey>, or --ensure-root-only.")
    return args


def main():
    args = parse_args()
    KEYS_ROOT.mkdir(parents=True, exist_ok=True)
    ROOT_DIR.mkdir(parents=True, exist_ok=True)
    UNITS_DIR.mkdir(parents=True, exist_ok=True)

    root_manifest = ensure_root(args)
    print(f"Root signer ready: {root_manifest['rootKeyId']}")

    if args.ensure_root_only:
        return

    units = load_units(args.unit)
    if not units:
        raise SystemExit("No matching units found in unit-history.json for key generation.")

    manifests = []
    for unit in units:
        manifest = ensure_unit_material(unit, root_manifest, args)
        manifests.append(manifest)
        print(f"Prepared keys for {unit['stableKey']} generation {manifest['generation']}")

    existing_manifests = []
    if INDEX_PATH.exists():
        existing_index = load_json(INDEX_PATH, {"units": []})
        existing_by_key = {entry["stableKey"]: entry for entry in existing_index.get("units", [])}
        for stable_key, entry in existing_by_key.items():
            if any(item["stableKey"] == stable_key for item in manifests):
                continue
            manifest_file = REPO_ROOT / entry["manifestPath"]
            if manifest_file.exists():
                existing_manifests.append(load_json(manifest_file, {}))
    rebuild_index(root_manifest, existing_manifests + manifests)


if __name__ == "__main__":
    main()
