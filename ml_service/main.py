"""ProjectLens ML service.

Run locally:   uvicorn main:app --reload --port 8000
Docs:          http://localhost:8000/docs

On start it fetches the trained model from Google Drive when needed (download_artifacts.py).
"""
import hmac
import logging
import os
import threading
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json

from fastapi import Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import download_artifacts
import generator
import intent as intent_model
from recommender import Recommender

if os.environ.get("SKIP_DOTENV") != "1":
    download_artifacts.load_env()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("projectlens.ml")

state = {}
reload_lock = threading.Lock()


def load_model(force_download: bool = False) -> dict:
    """Makes sure the artifacts are current, then loads them. Never raises."""
    if os.environ.get("SKIP_MODEL_DOWNLOAD") == "1":
        res = download_artifacts.Result("local_only", "Drive check skipped (SKIP_MODEL_DOWNLOAD=1)",
                                        download_artifacts.artifacts_complete())
    else:
        res = download_artifacts.ensure_artifacts(force=force_download)
    if not res.has_model:
        return {"rec": None, "message": res.message, "download": res.status}
    try:
        model_dir = download_artifacts.local_model_dir()
        rec = Recommender(str(model_dir))  # load the model once, not on every request
    except Exception as e:  # noqa: BLE001
        log.exception("could not load the model")
        return {"rec": None, "message": f"model files present but failed to load: {e}", "download": res.status}
    log.info("model loaded from %s: %s projects indexed", model_dir, f"{len(rec.meta):,}")
    return {"rec": rec, "message": res.message, "download": res.status}


@asynccontextmanager
async def lifespan(app: FastAPI):
    state.update(load_model())
    state.update(intent_model.load_intent() if os.environ.get("SKIP_INTENT_MODEL") != "1"
                 else {"clf": None, "intent_message": "skipped"})
    yield


app = FastAPI(title="ProjectLens ML service", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["*"], allow_headers=["*"], expose_headers=["X-Applied-Filters"],
)


class Profile(BaseModel):
    skills: List[str] = Field(..., min_length=1, examples=[["Python", "Machine Learning", "React"]])
    interests: List[str] = Field(default_factory=list, examples=[["Healthcare"]])
    level: Optional[str] = Field(None, examples=["Intermediate"])
    weeks: Optional[int] = Field(None, ge=1, le=52, examples=[12])
    hardware_ok: bool = True


class RecommendRequest(BaseModel):
    profile: Profile
    message: str = ""
    k: int = Field(5, ge=1, le=10)
    exclude_core_ids: List[str] = Field(default_factory=list, description="Core problems already shown to this student")
    explore: float = Field(0.3, ge=0, le=1, description="0 = always the strongest matches, 1 = more surprise")
    diversity: float = Field(0.3, ge=0, le=0.9, description="Higher = ideas more different from each other")
    seed: Optional[int] = None
    domains: Optional[List[str]] = Field(None, description="Only these domains (exact names). Default: read from message")
    approaches: Optional[List[str]] = Field(None, description="Preferred approaches, e.g. ['Mobile App']. Default: from message")
    levels: Optional[List[str]] = Field(None, description="Allowed levels. Default: 'easier'/'harder' in message")


class Project(BaseModel):
    id: str
    core_problem_id: str
    title: str
    problem_statement: str
    domain: str
    approach: str
    project_type: str
    tech_stack: str
    level: str
    duration_weeks: Optional[float]
    matched_skills: List[str]
    match_score: float
    source: str


@app.get("/health")
def health():
    rec = state.get("rec")
    if rec is None and "message" in state:
        return {"status": "no_model", "projects_indexed": 0, "intent_model": state.get("clf") is not None,
                "message": state["message"] + ". See README > Connect Google Drive."}
    clf = state.get("clf")
    return {"status": "ok" if rec else "loading", "projects_indexed": len(rec.meta) if rec else 0,
            "intent_model": clf is not None,
            "intent_version": clf.report.get("version") if clf else None}


@app.post("/recommend", response_model=List[Project])
def recommend(req: RecommendRequest, response: Response):
    """Applied filters (domains, approaches, levels, weeks, hardware, relaxed) are returned in the
    X-Applied-Filters header as JSON, so the UI can say e.g. "Showing Healthcare projects"."""
    rec = state.get("rec")
    if rec is None:
        raise HTTPException(503, state.get("message", "Model is loading"))
    out, applied = rec.recommend_with_filters(req.profile.model_dump(), req.message, req.k, req.exclude_core_ids,
                                              req.explore, req.diversity, req.seed,
                                              req.domains, req.approaches, req.levels)
    response.headers["X-Applied-Filters"] = json.dumps(applied)
    if out.empty:
        raise HTTPException(404, "No projects left for this profile; clear the seen list or relax filters",
                            headers={"X-Applied-Filters": json.dumps(applied)})
    return [Project(id=r.id, core_problem_id=r.core_problem_id, title=r.title, problem_statement=r.problem_statement,
                    domain=r.domain, approach=r.approach, project_type=r.project_type, tech_stack=r.tech_stack,
                    level=r.level, duration_weeks=None if r.duration_weeks != r.duration_weeks else r.duration_weeks,
                    matched_skills=r.matched_skills, match_score=round(float(r.rel), 4), source=r.source)
            for r in out.itertuples()]


class IntentRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)


@app.post("/understand")
def understand(req: IntentRequest, level: Optional[str] = None):
    """What the ranking would read from a message: domains, approaches, levels, weeks, hardware."""
    from ranking import understand_request
    return understand_request(req.text, {"level": level} if level else {})


@app.post("/intent")
def intent(req: IntentRequest):
    """Model 1. Returns {"intent", "confidence", "raw_intent", "low_confidence", "scores"}.
    Below the confidence threshold (0.60) intent is "general_question", so a wrong guess never forces project cards.
    Answers 501 when the model is not installed; the website then uses its own rules."""
    clf = state.get("clf")
    if clf is None:
        return JSONResponse(status_code=501, content={"detail": state.get("intent_message", "Intent model not installed")})
    return clf.predict(req.text)


class GenerateRequest(RecommendRequest):
    k: int = Field(3, ge=1, le=5)


@app.post("/generate")
def generate(req: GenerateRequest, response: Response):
    """Model 3. Writes NEW problem statements grounded in the retriever's matches, using the local LLM
    (OLLAMA_URL, OLLAMA_MODEL). Every idea passes format, skill, time/domain and novelty checks. If the LLM is down,
    the retrieved catalogue projects come back instead (source "catalogue")."""
    rec = state.get("rec")
    if rec is None:
        raise HTTPException(503, state.get("message", "Model is loading"))
    out = generator.generate(rec, req.profile.model_dump(), req.message, req.k, req.exclude_core_ids, req.seed,
                             req.domains, req.approaches, req.levels)
    response.headers["X-Applied-Filters"] = json.dumps(out["applied"])
    if not out["ideas"]:
        raise HTTPException(404, "No projects left for this profile; clear the seen list or relax filters",
                            headers={"X-Applied-Filters": json.dumps(out["applied"])})
    return out


@app.post("/admin/reload-model")
def reload_model(authorization: Optional[str] = Header(None), force: bool = False):
    """Re-checks Google Drive and hot-swaps the model without a restart.
    curl -X POST -H "Authorization: Bearer $ML_ADMIN_TOKEN" http://localhost:8000/admin/reload-model"""
    token = os.environ.get("ML_ADMIN_TOKEN", "")
    if not token:
        raise HTTPException(503, "ML_ADMIN_TOKEN is not set, so admin endpoints are disabled")
    given = (authorization or "").removeprefix("Bearer ").strip()
    if not hmac.compare_digest(given.encode(), token.encode()):
        raise HTTPException(401, "Invalid admin token")
    if not reload_lock.acquire(blocking=False):
        raise HTTPException(409, "A reload is already running")
    try:
        new = load_model(force_download=force)
        if new["rec"] is None and state.get("rec") is not None:
            # keep serving the old model if the new one could not be loaded
            return {"status": "kept_previous", "message": new["message"], "projects_indexed": len(state["rec"].meta)}
        state.update(new)                 # atomic swap: requests in flight keep their old reference
        if os.environ.get("SKIP_INTENT_MODEL") != "1":
            state.update(intent_model.load_intent())
        rec = state["rec"]
        return {"status": "ok" if rec else "no_model", "download": new["download"], "message": new["message"],
                "projects_indexed": len(rec.meta) if rec else 0}
    finally:
        reload_lock.release()
