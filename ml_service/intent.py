"""Model 1: the intent classifier (fine-tuned DistilBERT).

Files come from the Colab notebook ProjectLens_Train_Intent.ipynb, which saves projectlens_intent.zip to Google Drive.
They live in ml_service/artifacts/projectlens_intent/ (config.json, model.safetensors, tokenizer files,
training_report.json). If INTENT_DRIVE_FILE_ID is set and the folder is missing, the zip is downloaded with gdown
(the Drive file must be shared as "anyone with the link").
"""
import json
import logging
import os
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Optional

log = logging.getLogger("projectlens.intent")
HERE = Path(__file__).resolve().parent
ARTIFACTS = Path(os.environ.get("ARTIFACTS_DIR", HERE / "artifacts"))
LABELS = ["greeting", "chitchat", "general_question", "ask_project", "refine_project", "explain_project",
          "profile_update"]


def local_intent_dir(root: Path = ARTIFACTS) -> Optional[Path]:
    """The folder holding the trained classifier, wherever the zip was unpacked under artifacts/."""
    if not root.exists():
        return None
    for report in sorted(root.rglob("training_report.json")):
        d = report.parent
        try:
            labels = json.loads(report.read_text()).get("labels", [])
        except (OSError, json.JSONDecodeError):
            continue
        if "ask_project" in labels and (d / "config.json").exists():
            return d
    return None


def download_intent(file_id: str, root: Path = ARTIFACTS) -> Optional[Path]:
    """Fetches projectlens_intent.zip from Drive into artifacts/projectlens_intent/. Returns the folder or None."""
    import gdown
    dest = root / "projectlens_intent"
    with tempfile.TemporaryDirectory() as tmp:
        zpath = Path(tmp) / "intent.zip"
        if not gdown.download(id=file_id, output=str(zpath), quiet=True):
            return None
        staging = Path(tmp) / "x"
        with zipfile.ZipFile(zpath) as zf:
            for name in zf.namelist():                    # refuse paths that escape the folder
                if Path(name).is_absolute() or ".." in Path(name).parts:
                    raise ValueError(f"unsafe path in zip: {name}")
            zf.extractall(staging)
        reports = list(staging.rglob("training_report.json"))
        if not reports:
            raise ValueError("zip has no training_report.json; is it projectlens_intent.zip?")
        shutil.rmtree(dest, ignore_errors=True)
        root.mkdir(parents=True, exist_ok=True)
        shutil.copytree(reports[0].parent, dest)
    return dest


class IntentClassifier:
    def __init__(self, model_dir: str):
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
        self.torch = torch
        self.tok = AutoTokenizer.from_pretrained(model_dir)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_dir).eval()
        report = json.loads(Path(model_dir, "training_report.json").read_text())
        self.threshold = float(report.get("threshold", 0.6))
        self.fallback = report.get("fallback_intent", "general_question")
        self.max_len = int(report.get("max_len", 48))
        self.report = report
        self.id2label = {int(k): v for k, v in self.model.config.id2label.items()}

    def predict(self, text: str) -> dict:
        with self.torch.no_grad():
            enc = self.tok([text], truncation=True, max_length=self.max_len, return_tensors="pt")
            probs = self.torch.softmax(self.model(**enc).logits[0].float(), -1).tolist()
        scores = {self.id2label[i]: round(p, 4) for i, p in enumerate(probs)}
        top = max(scores, key=scores.get)
        low = scores[top] < self.threshold
        return {"intent": self.fallback if low else top, "confidence": scores[top], "raw_intent": top,
                "low_confidence": low, "scores": scores}


def load_intent() -> dict:
    """Never raises. Returns {"clf": IntentClassifier | None, "intent_message": str}."""
    d = local_intent_dir()
    file_id = os.environ.get("INTENT_DRIVE_FILE_ID", "").strip()
    if d is None and file_id and os.environ.get("SKIP_MODEL_DOWNLOAD") != "1":
        try:
            d = download_intent(file_id)
        except Exception as e:  # noqa: BLE001
            log.warning("intent model download failed: %s", e)
    if d is None:
        return {"clf": None, "intent_message": "intent model not installed (artifacts/projectlens_intent/)"}
    try:
        clf = IntentClassifier(str(d))
    except Exception as e:  # noqa: BLE001
        log.exception("intent model failed to load")
        return {"clf": None, "intent_message": f"intent model present but failed to load: {e}"}
    log.info("intent model loaded from %s (threshold %.2f)", d, clf.threshold)
    return {"clf": clf, "intent_message": "ok"}
