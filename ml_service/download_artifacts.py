"""Fetches the trained retriever (projectlens_retriever.zip) from Google Drive into artifacts/.

Runs automatically when the service starts, and on its own:
    python download_artifacts.py            # download only if Drive has a newer file
    python download_artifacts.py --force    # always download

Authentication, chosen by environment variables:
  1. Service account (recommended, keeps the file private)
       GOOGLE_SERVICE_ACCOUNT_JSON=path/to/key.json   MODEL_DRIVE_FILE_ID=<file id>
     Share the zip (or the ProjectLens folder) with the service account's email as Viewer.
  2. Shared link (simplest)
       MODEL_DRIVE_FILE_ID=<file id> and the file shared as "Anyone with the link".

The zip holds model/, embeddings.npy, projects.csv and training_report.json (at the top level or
inside one folder). After download we check that projects.csv and embeddings.npy have the same
number of rows, then swap the files in atomically and record Drive's modifiedTime in
artifacts/.drive_version so the next start can skip the download.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import shutil
import sys
import tempfile
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional, Protocol

HERE = Path(__file__).resolve().parent
ARTIFACTS = Path(os.environ.get("ARTIFACTS_DIR", HERE / "artifacts"))
REQUIRED = ("model", "embeddings.npy", "projects.csv")
OPTIONAL = ("training_report.json",)
VERSION_FILE = ".drive_version"

log = logging.getLogger("projectlens.download")
logging.getLogger("httpx").setLevel(logging.WARNING)


def load_env() -> None:
    """Reads the monorepo's root .env (and ml_service/.env) when python-dotenv is installed."""
    try:
        from dotenv import load_dotenv
    except ImportError:  # pragma: no cover
        return
    for p in (HERE.parent / ".env", HERE / ".env"):
        if p.exists():
            load_dotenv(p, override=False)


# ── Errors ─────────────────────────────────────────────────────────────────────────────────
class DriveAccessDenied(Exception):
    """The file exists but this identity may not read it (or the ID is wrong)."""


class DriveUnreachable(Exception):
    """Network problem or Drive outage."""


class ArtifactsInvalid(Exception):
    """The downloaded zip is missing files or its rows don't match."""


# ── Drive sources ──────────────────────────────────────────────────────────────────────────
@dataclass
class RemoteFile:
    file_id: str
    name: str
    size: Optional[int]
    version: str  # modifiedTime, or a stand-in when Drive does not expose it


Progress = Callable[[int, Optional[int]], None]


class DriveSource(Protocol):
    description: str

    def metadata(self) -> RemoteFile: ...

    def download(self, dest: Path, progress: Progress) -> None: ...


class ServiceAccountSource:
    """Drive API v3 with a service-account key and the read-only scope."""

    SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

    def __init__(self, key_path: str, file_id: str):
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        path = Path(key_path)
        if not path.is_absolute():
            path = (HERE.parent / path) if (HERE.parent / path).exists() else (HERE / path)
        if not path.exists():
            raise DriveAccessDenied(f"service-account key not found at {path}")
        self.creds = service_account.Credentials.from_service_account_file(str(path), scopes=self.SCOPES)
        self.email = self.creds.service_account_email
        self.file_id = file_id
        self.service = build("drive", "v3", credentials=self.creds, cache_discovery=False)
        self.description = f"service account {self.email}"

    def _wrap(self, err: Exception) -> Exception:
        from googleapiclient.errors import HttpError

        if isinstance(err, HttpError) and err.resp.status in (401, 403, 404):
            return DriveAccessDenied(f"Drive access denied: share the file with {self.email} (Viewer)")
        return DriveUnreachable(str(err))

    def metadata(self) -> RemoteFile:
        try:
            m = (
                self.service.files()
                .get(fileId=self.file_id, fields="id,name,size,modifiedTime", supportsAllDrives=True)
                .execute(num_retries=2)
            )
        except Exception as e:  # noqa: BLE001
            raise self._wrap(e) from e
        return RemoteFile(m["id"], m.get("name", "model.zip"), int(m["size"]) if m.get("size") else None, m["modifiedTime"])

    def download(self, dest: Path, progress: Progress) -> None:
        from googleapiclient.http import MediaIoBaseDownload

        try:
            req = self.service.files().get_media(fileId=self.file_id, supportsAllDrives=True)
            with open(dest, "wb") as fh:
                dl = MediaIoBaseDownload(fh, req, chunksize=8 * 1024 * 1024)
                done = False
                while not done:
                    status, done = dl.next_chunk(num_retries=3)
                    if status:
                        progress(int(status.resumable_progress), int(status.total_size or 0) or None)
        except Exception as e:  # noqa: BLE001
            raise self._wrap(e) from e


class SharedLinkSource:
    """Public "Anyone with the link" file, fetched with gdown (no credentials)."""

    def __init__(self, file_id: str):
        self.file_id = file_id
        self.description = "shared link"

    def metadata(self) -> RemoteFile:
        # Without credentials Drive does not expose modifiedTime. Use the response's
        # Last-Modified/ETag when present, otherwise the file id (downloads once; use --force
        # or POST /admin/reload-model to refresh).
        import httpx

        url = f"https://drive.usercontent.google.com/download?id={self.file_id}&export=download&confirm=t"
        try:
            with httpx.Client(follow_redirects=True, timeout=20) as c:
                with c.stream("GET", url) as r:
                    if r.status_code in (401, 403, 404):
                        raise DriveAccessDenied(
                            "Drive access denied: set the file to 'Anyone with the link' or use a service account"
                        )
                    ctype = r.headers.get("content-type", "")
                    if "text/html" in ctype:
                        raise DriveAccessDenied(
                            "Drive access denied: the file is not shared as 'Anyone with the link' "
                            "(or use GOOGLE_SERVICE_ACCOUNT_JSON)"
                        )
                    size = int(r.headers["content-length"]) if r.headers.get("content-length") else None
                    stamp = r.headers.get("last-modified") or r.headers.get("etag") or f"link:{self.file_id}:{size}"
        except (DriveAccessDenied, DriveUnreachable):
            raise
        except Exception as e:  # noqa: BLE001
            raise DriveUnreachable(str(e)) from e
        return RemoteFile(self.file_id, "projectlens_retriever.zip", size, stamp)

    def download(self, dest: Path, progress: Progress) -> None:
        import gdown

        try:
            out = gdown.download(id=self.file_id, output=str(dest), quiet=False)
        except Exception as e:  # noqa: BLE001
            msg = str(e)
            if "Permission" in msg or "Cannot retrieve" in msg or "access" in msg.lower():
                raise DriveAccessDenied(f"Drive access denied: {msg.splitlines()[0]}") from e
            raise DriveUnreachable(msg) from e
        if not out or not dest.exists():
            raise DriveAccessDenied("Drive access denied: file is not shared as 'Anyone with the link'")
        progress(dest.stat().st_size, dest.stat().st_size)


def source_from_env() -> Optional[DriveSource]:
    file_id = os.environ.get("MODEL_DRIVE_FILE_ID", "").strip()
    if not file_id:
        return None
    key = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    return ServiceAccountSource(key, file_id) if key else SharedLinkSource(file_id)


# ── Local state ────────────────────────────────────────────────────────────────────────────
def _complete(d: Path) -> bool:
    return (d / "model").is_dir() and any((d / "model").iterdir()) and all((d / f).exists() for f in REQUIRED[1:])


def local_model_dir(root: Path = ARTIFACTS) -> Optional[Path]:
    """Where the model files are: artifacts/ itself, or a single folder inside it
    (unzipping by hand often creates artifacts/projectlens_retriever/). None when absent."""
    if _complete(root):
        return root
    if root.is_dir():
        nested = [d for d in sorted(root.iterdir()) if d.is_dir() and not d.name.startswith(".") and _complete(d)]
        if len(nested) == 1:
            return nested[0]
    return None


def artifacts_complete(root: Path = ARTIFACTS) -> bool:
    return local_model_dir(root) is not None


def local_version(root: Path = ARTIFACTS) -> Optional[dict]:
    try:
        return json.loads((root / VERSION_FILE).read_text())
    except (OSError, ValueError):
        return None


def count_rows(staging: Path) -> tuple[int, int]:
    import numpy as np
    import pandas as pd

    emb = np.load(staging / "embeddings.npy", mmap_mode="r")
    rows = len(pd.read_csv(staging / "projects.csv", low_memory=False, usecols=[0]))
    return rows, int(emb.shape[0])


def find_root(extracted: Path) -> Path:
    """The folder inside the zip that holds model/ (top level or one folder down)."""
    if (extracted / "model").is_dir():
        return extracted
    for child in extracted.iterdir():
        if child.is_dir() and (child / "model").is_dir():
            return child
    raise ArtifactsInvalid("zip does not contain a model/ folder")


def safe_extract(zf: zipfile.ZipFile, dest: Path) -> None:
    dest = dest.resolve()
    for member in zf.infolist():
        target = (dest / member.filename).resolve()
        if dest not in target.parents and target != dest:
            raise ArtifactsInvalid(f"unsafe path in zip: {member.filename}")
    zf.extractall(dest)


def install(zip_path: Path, root: Path, version: dict) -> int:
    """Unzips, validates and atomically swaps artifacts into place. Returns the row count."""
    root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=root, prefix=".staging-") as tmp:
        tmp_path = Path(tmp)
        try:
            with zipfile.ZipFile(zip_path) as zf:
                safe_extract(zf, tmp_path)
        except zipfile.BadZipFile as e:
            raise ArtifactsInvalid("downloaded file is not a valid zip") from e
        src = find_root(tmp_path)
        missing = [f for f in REQUIRED if not (src / f).exists()]
        if missing:
            raise ArtifactsInvalid(f"zip is missing {', '.join(missing)}")
        rows, emb_rows = count_rows(src)
        if rows != emb_rows:
            raise ArtifactsInvalid(f"projects.csv has {rows} rows but embeddings.npy has {emb_rows}")
        for name in REQUIRED + OPTIONAL:
            if not (src / name).exists():
                continue
            target = root / name
            old = root / f".old-{name}"
            if old.exists():
                shutil.rmtree(old) if old.is_dir() else old.unlink()
            if target.exists():
                target.rename(old)
            (src / name).rename(target)
            if old.exists():
                shutil.rmtree(old) if old.is_dir() else old.unlink()
    (root / VERSION_FILE).write_text(json.dumps({**version, "rows": rows, "installed_at": int(time.time())}, indent=2))
    return rows


# ── Main entry ─────────────────────────────────────────────────────────────────────────────
@dataclass
class Result:
    status: str  # up_to_date | downloaded | local_only | no_model
    message: str
    has_model: bool


def ensure_artifacts(
    force: bool = False,
    root: Path = ARTIFACTS,
    source: Optional[DriveSource] = None,
    use_env: bool = True,
) -> Result:
    """Makes sure artifacts/ holds the latest model. Never raises; returns what happened."""
    have = artifacts_complete(root)
    try:
        src = source if source is not None else (source_from_env() if use_env else None)
    except DriveAccessDenied as e:
        src = None
        log.error("%s", e)
    if src is None:
        if have:
            msg = "using the local model (MODEL_DRIVE_FILE_ID not set, Drive check skipped)"
            log.info(msg)
            return Result("local_only", msg, True)
        msg = "no model: set MODEL_DRIVE_FILE_ID (and GOOGLE_SERVICE_ACCOUNT_JSON) or copy the files into ml_service/artifacts/"
        log.error(msg)
        return Result("no_model", msg, False)

    # Any Drive problem leaves local files untouched: nothing is downloaded or deleted before
    # the remote file has been checked, and a bad download never replaces a working model.
    try:
        remote = src.metadata()
    except DriveAccessDenied as e:
        if have:
            msg = f"{e}; using the local model in {local_model_dir(root)} (not downloading)"
            log.warning(msg)
            return Result("local_only", msg, True)
        log.error("%s", e)
        return Result("no_model", str(e), False)
    except DriveUnreachable as e:
        msg = f"Drive unreachable ({e}); " + (f"using the local model in {local_model_dir(root)}" if have else "no local model yet")
        log.warning(msg)
        return Result("local_only" if have else "no_model", msg, have)

    current = local_version(root)
    if have and not force and current and current.get("file_id") == remote.file_id and current.get("version") == remote.version:
        msg = f"model up to date (Drive modifiedTime {remote.version})"
        log.info(msg)
        return Result("up_to_date", msg, True)

    size_mb = f"{remote.size / 1e6:.0f} MB" if remote.size else "the model"
    log.info("downloading %s from Drive via %s...", size_mb, src.description)
    root.mkdir(parents=True, exist_ok=True)
    tmp_zip = root / ".download.zip"
    last = {"t": 0.0}

    def progress(done: int, total: Optional[int]) -> None:
        now = time.time()
        if now - last["t"] >= 2 or (total and done >= total):
            last["t"] = now
            pct = f" ({done * 100 // total}%)" if total else ""
            log.info("  %.0f MB%s", done / 1e6, pct)

    try:
        src.download(tmp_zip, progress)
        rows = install(tmp_zip, root, {"file_id": remote.file_id, "version": remote.version, "name": remote.name})
    except (DriveAccessDenied, DriveUnreachable, ArtifactsInvalid) as e:
        msg = f"download failed: {e}; " + ("keeping the current model" if have else "no model available")
        log.error(msg)
        return Result("local_only" if have else "no_model", msg, have)
    finally:
        tmp_zip.unlink(missing_ok=True)

    msg = f"model downloaded and verified ({rows:,} projects)"
    log.info(msg)
    return Result("downloaded", msg, True)


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--force", action="store_true", help="download even if the local model is up to date")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    load_env()
    res = ensure_artifacts(force=args.force)
    print(f"{res.status}: {res.message}")
    return 0 if res.has_model else 1


if __name__ == "__main__":
    sys.exit(main())
