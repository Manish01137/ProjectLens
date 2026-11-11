"""Tests download_artifacts.py against a fake Google Drive. Run: python test_download_artifacts.py

No network and no real model needed: the fake Drive serves small zips built on the fly.
"""
import io
import json
import os
import sys
import tempfile
import zipfile
from pathlib import Path

import numpy as np

# Point both modules at an empty artifacts dir before importing them.
TMP = Path(tempfile.mkdtemp(prefix="pl-test-"))
os.environ["ARTIFACTS_DIR"] = str(TMP / "service-artifacts")
os.environ.pop("MODEL_DRIVE_FILE_ID", None)
os.environ.pop("GOOGLE_SERVICE_ACCOUNT_JSON", None)
os.environ["ML_ADMIN_TOKEN"] = "test-admin-token"
os.environ["SKIP_DOTENV"] = "1"

import download_artifacts as da  # noqa: E402
from download_artifacts import DriveAccessDenied, DriveUnreachable, RemoteFile  # noqa: E402

da.load_env = lambda: None  # keep the developer's real .env out of the tests


def make_zip(rows: int, emb_rows: int | None = None, folder: str = "", extra: dict | None = None) -> bytes:
    """A zip shaped like projectlens_retriever.zip. The CSV has a multi-line quoted field on purpose."""
    emb_rows = rows if emb_rows is None else emb_rows
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        p = f"{folder}/" if folder else ""
        z.writestr(f"{p}model/config.json", json.dumps({"fake": True}))
        npy = io.BytesIO()
        np.save(npy, np.random.default_rng(0).random((emb_rows, 4), dtype=np.float32))
        z.writestr(f"{p}embeddings.npy", npy.getvalue())
        lines = ["id,title,problem_statement"]
        for i in range(rows):
            lines.append(f'PS{i:05d},Title {i},"Line one of {i}\nline two, with a comma"')
        z.writestr(f"{p}projects.csv", "\n".join(lines) + "\n")
        z.writestr(f"{p}training_report.json", json.dumps({"rows": rows}))
        for name, data in (extra or {}).items():
            z.writestr(name, data)
    return buf.getvalue()


class FakeDrive:
    description = "fake drive"

    def __init__(self, payload: bytes, version: str = "2026-11-10T06:06:56.834Z", error: Exception | None = None):
        self.payload, self.version, self.error = payload, version, error
        self.downloads = 0

    def metadata(self) -> RemoteFile:
        if self.error:
            raise self.error
        return RemoteFile("FILE123", "projectlens_retriever.zip", len(self.payload), self.version)

    def download(self, dest: Path, progress) -> None:
        self.downloads += 1
        dest.write_bytes(self.payload)
        progress(len(self.payload), len(self.payload))


def fresh_root(name: str) -> Path:
    root = TMP / name
    root.mkdir(parents=True)
    return root


def check(cond: bool, msg: str) -> None:
    if not cond:
        print("FAIL:", msg)
        sys.exit(1)
    print("OK:", msg)


# 1. First start: downloads, verifies and records the version
root = fresh_root("a")
drive = FakeDrive(make_zip(25))
r = da.ensure_artifacts(root=root, source=drive)
check(r.status == "downloaded" and r.has_model, "fresh download installs the model")
check((root / "model" / "config.json").exists() and (root / "embeddings.npy").exists() and (root / "projects.csv").exists(),
      "model/, embeddings.npy and projects.csv are in artifacts/")
v = json.loads((root / ".drive_version").read_text())
check(v["version"] == drive.version and v["rows"] == 25, ".drive_version stores modifiedTime and row count")
check(not (root / ".download.zip").exists(), "temporary zip is cleaned up")

# 2. Next start with the same Drive file: skipped
r = da.ensure_artifacts(root=root, source=drive)
check(r.status == "up_to_date" and drive.downloads == 1, "same modifiedTime skips the download")

# 3. Drive file updated (retrained on Colab): downloaded again
drive2 = FakeDrive(make_zip(30), version="2026-11-12T09:00:00.000Z")
r = da.ensure_artifacts(root=root, source=drive2)
check(r.status == "downloaded" and json.loads((root / ".drive_version").read_text())["rows"] == 30,
      "newer modifiedTime triggers a fresh download")

# 4. --force downloads even when up to date
r = da.ensure_artifacts(root=root, source=drive2, force=True)
check(r.status == "downloaded" and drive2.downloads == 2, "force=True always downloads")

# 5. A broken upload (row mismatch) never replaces a working model
bad = FakeDrive(make_zip(30, emb_rows=29), version="2026-11-13T00:00:00.000Z")
r = da.ensure_artifacts(root=root, source=bad)
check(r.status == "local_only" and r.has_model and "rows" in r.message, "row mismatch is rejected and the old model kept")
check(json.loads((root / ".drive_version").read_text())["rows"] == 30, "version file still points at the good model")

# 6. Zip with everything inside one folder (as Colab's make_archive produces)
root_b = fresh_root("b")
r = da.ensure_artifacts(root=root_b, source=FakeDrive(make_zip(12, folder="projectlens_retriever")))
check(r.status == "downloaded" and (root_b / "model").is_dir(), "zip with a top-level folder is handled")

# 7. Zip-slip paths are refused
root_c = fresh_root("c")
r = da.ensure_artifacts(root=root_c, source=FakeDrive(make_zip(5, extra={"../evil.txt": "x"})))
check(r.status == "no_model" and not (TMP / "evil.txt").exists(), "unsafe paths in the zip are refused")

# 8. Access denied with no local model → no_model with a helpful message
root_d = fresh_root("d")
denied = FakeDrive(b"", error=DriveAccessDenied("Drive access denied: share the file with sa@proj.iam.gserviceaccount.com (Viewer)"))
r = da.ensure_artifacts(root=root_d, source=denied)
check(r.status == "no_model" and "share the file with sa@" in r.message, "access denied explains which email to share with")

# 9. Drive unreachable but a local model exists → keep serving it
r = da.ensure_artifacts(root=root, source=FakeDrive(b"", error=DriveUnreachable("timed out")))
check(r.status == "local_only" and r.has_model, "Drive unreachable falls back to the local model")

# 10. Nothing configured, nothing local → no_model
r = da.ensure_artifacts(root=fresh_root("e"), source=None, use_env=False)
check(r.status == "no_model" and "MODEL_DRIVE_FILE_ID" in r.message, "no Drive config and no files → no_model")

# 11. A model copied in by hand (nested folder, no .drive_version) is used and never touched
import hashlib  # noqa: E402

def snapshot(d: Path) -> dict:
    return {str(p.relative_to(d)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(d.rglob("*")) if p.is_file()}

root_f = fresh_root("f")
with zipfile.ZipFile(io.BytesIO(make_zip(40, folder="projectlens_retriever"))) as z:
    z.extractall(root_f)
before = snapshot(root_f)
check(da.local_model_dir(root_f) == root_f / "projectlens_retriever", "model inside artifacts/<folder>/ is found")
for err, label in [
    (DriveAccessDenied("Drive access denied: the file is not shared as 'Anyone with the link'"), "denied"),
    (DriveUnreachable("timed out"), "unreachable"),
]:
    d = FakeDrive(make_zip(99), version="2030-01-01T00:00:00.000Z", error=err)
    r = da.ensure_artifacts(root=root_f, source=d)
    check(r.status == "local_only" and r.has_model and d.downloads == 0, f"Drive {label}: uses the hand-copied model, no download")
    check(snapshot(root_f) == before, f"Drive {label}: local files are byte-for-byte unchanged, no .drive_version written")
check("using the local model in" in da.ensure_artifacts(root=root_f, source=FakeDrive(b"", error=DriveAccessDenied("x"))).message,
      "the log says which local model is used")

# 12. The service stays up without a model: /health says no_model, nothing crashes
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402

with TestClient(main.app) as client:
    h = client.get("/health").json()
    check(h["status"] == "no_model" and "message" in h, "/health returns no_model with a message")
    student = {"skills": ["Python"], "interests": [], "level": "Beginner", "weeks": 8, "hardware_ok": False}
    check(client.post("/recommend", json={"profile": student}).status_code == 503, "/recommend answers 503 without a model")
    check(client.post("/intent", json={"text": "hi"}).status_code == 501, "/intent is a 501 stub until the model exists")
    check(client.post("/admin/reload-model").status_code == 401, "/admin/reload-model rejects a missing token")
    check(client.post("/admin/reload-model", headers={"Authorization": "Bearer wrong"}).status_code == 401,
          "/admin/reload-model rejects a wrong token")
    ok = client.post("/admin/reload-model", headers={"Authorization": "Bearer test-admin-token"})
    check(ok.status_code == 200 and ok.json()["status"] == "no_model", "/admin/reload-model runs with the right token")

print("\nAll download_artifacts tests passed")
