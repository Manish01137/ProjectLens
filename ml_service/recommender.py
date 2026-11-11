"""Loads the trained retriever and recommends varied, fitting projects for a student profile.

The ranking rules live in ranking.py (shared with the Colab notebook), so the website and the
notebook's evaluation always use exactly the same logic.
"""
import os
import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer

from ranking import recommend_core, understand_request  # noqa: F401  (re-exported for callers/tests)

ARTIFACTS = os.environ.get("ARTIFACTS_DIR", os.path.join(os.path.dirname(__file__), "artifacts"))


class Recommender:
    def __init__(self, artifacts_dir: str = ARTIFACTS):
        self.model = SentenceTransformer(os.path.join(artifacts_dir, "model"), device="cpu")
        self.emb = np.load(os.path.join(artifacts_dir, "embeddings.npy")).astype(np.float32)
        self.meta = pd.read_csv(os.path.join(artifacts_dir, "projects.csv"), low_memory=False)
        self.meta["duration_weeks"] = pd.to_numeric(self.meta["duration_weeks"], errors="coerce")
        for c in ["required_skills", "organisation", "primary_user", "approach", "tech_stack", "level", "project_type"]:
            self.meta[c] = self.meta[c].fillna("")
        assert len(self.meta) == len(self.emb), "projects.csv and embeddings.npy do not match"

    @staticmethod
    def profile_to_text(profile: dict, message: str = "") -> str:
        parts = [f"I know {', '.join(profile.get('skills', []))}."]
        if profile.get("interests"):
            parts.append(f"I am interested in {', '.join(i.lower() for i in profile['interests'])}.")
        if profile.get("level"):
            parts.append(f"I am a {profile['level'].lower()} student.")
        if profile.get("weeks"):
            parts.append(f"I have {profile['weeks']} weeks.")
        if not profile.get("hardware_ok", True):
            parts.append("No hardware please.")
        if message:
            parts.append(message)
        return " ".join(parts)

    def recommend_with_filters(self, profile: dict, message: str = "", k: int = 5, exclude_core_ids=(),
                               explore: float = 0.3, diversity: float = 0.3, seed=None,
                               domains=None, approaches=None, levels=None):
        q = self.model.encode([self.profile_to_text(profile, message)], normalize_embeddings=True)[0]
        return recommend_core(self.meta, self.emb, self.emb @ q, profile, message, k, exclude_core_ids,
                              explore, diversity, seed, domains, approaches, levels)

    def recommend(self, profile: dict, message: str = "", k: int = 5, exclude_core_ids=(),
                  explore: float = 0.3, diversity: float = 0.3, seed=None) -> pd.DataFrame:
        return self.recommend_with_filters(profile, message, k, exclude_core_ids, explore, diversity, seed)[0]
