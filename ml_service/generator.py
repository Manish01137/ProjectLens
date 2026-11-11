"""Model 3: the reply writer. A local LLM (Ollama, qwen2.5:3b by default) writes NEW problem statements for the student,
grounded in the projects the retriever (model 2) found. The LLM is not trained; it is steered by a strict prompt and
JSON output, and every idea must pass four checks before the student sees it:

  1. format   - the JSON parses and every field is filled
  2. skills   - skills_used only contains the student's skills, plus at most one new_skill_to_learn
  3. time     - the last milestone week is within the student's weeks; the domain matches the request
  4. novelty  - the idea is not a copy: cosine similarity to every catalogue row is below NOVELTY_MAX (0.85)

Failed ideas are sent back once or twice with the reasons. If the LLM is down or nothing passes, the retrieved
catalogue projects are returned instead (source "catalogue"), so the student always gets grounded answers.
"""
import json
import logging
import os
import re
from typing import Callable, Optional

import numpy as np

log = logging.getLogger("projectlens.generator")
NOVELTY_MAX = float(os.environ.get("NOVELTY_MAX", "0.85"))
MAX_ROUNDS = 3

FIELDS = ["title", "problem_statement", "domain", "target_users", "skills_used", "new_skill_to_learn",
          "tech_stack", "milestones", "data_source", "why_it_fits", "inspired_by"]

IDEA_SCHEMA = {
    "type": "object",
    "properties": {"ideas": {"type": "array", "items": {
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "problem_statement": {"type": "string"},
            "domain": {"type": "string"},
            "target_users": {"type": "string"},
            "skills_used": {"type": "array", "items": {"type": "string"}},
            "new_skill_to_learn": {"type": "string"},
            "tech_stack": {"type": "array", "items": {"type": "string"}},
            "milestones": {"type": "array", "items": {"type": "object", "properties": {
                "week": {"type": "integer"}, "task": {"type": "string"}}, "required": ["week", "task"]}},
            "data_source": {"type": "string"},
            "why_it_fits": {"type": "string"},
            "inspired_by": {"type": "string"},
        },
        "required": FIELDS}}},
    "required": ["ideas"],
}

SYSTEM = """You are ProjectLens, a final-year B.Tech project advisor in India.
Write NEW project ideas for ONE student. Rules:
- Use ONLY the student's skills in skills_used. You may add AT MOST ONE skill they don't have, in new_skill_to_learn
  (or "" if none is needed).
- Stay in the requested domain. Respect the student's weeks: the last milestone week must be <= their weeks.
- Use the reference projects as inspiration only. Do not copy their wording; change the user group, setting or angle.
- Problem statements: 3-5 plain sentences. Say who has the problem, what goes wrong today, what the student builds,
  and how success is measured. No marketing words.
- data_source must be something real and reachable (a public dataset, an API, data the team can collect). If unsure,
  say "collect with a survey/sensor" instead of inventing a dataset name.
- inspired_by is the reference id you started from.
Return JSON only, matching the schema."""


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9+#.]", "", s.lower())


def _aliases(skills):
    """Lets 'ML' match 'Machine Learning', 'React.js' match 'React', etc."""
    extra = {"ml": "machinelearning", "dl": "deeplearning", "cv": "computervision", "reactjs": "react",
             "react.js": "react", "node": "node.js", "nodejs": "node.js", "js": "javascript", "ts": "typescript",
             "postgres": "postgresql", "tf": "tensorflow", "k8s": "kubernetes", "nlp": "nlp"}
    out = set()
    for s in skills:
        n = _norm(s)
        out.add(n)
        out.add(extra.get(n, n))
    return out


def check_idea(idea: dict, profile: dict, domains, encode: Callable, catalogue_emb: np.ndarray) -> list:
    """Returns a list of problems; empty means the idea passes all four checks."""
    problems = []
    for f in FIELDS:                                        # 1. format
        v = idea.get(f)
        if f == "new_skill_to_learn":
            if not isinstance(v, str):
                problems.append("new_skill_to_learn must be a string ('' if none)")
        elif v in (None, "", []) or (f == "milestones" and not isinstance(v, list)):
            problems.append(f"field '{f}' is empty")
    if problems:
        return problems

    have = _aliases(profile.get("skills", []))              # 2. skills
    unknown = [s for s in idea["skills_used"] if _norm(s) not in have]
    new = idea.get("new_skill_to_learn", "").strip()
    extra = [s for s in unknown if _norm(s) != _norm(new)] if new else unknown
    if len(unknown) > 1 or extra:
        problems.append(f"skills_used has skills the student does not know: {', '.join(extra or unknown)}; "
                        f"use only {', '.join(profile.get('skills', []))} plus at most one new_skill_to_learn")

    weeks = profile.get("weeks")                            # 3. time and domain
    try:
        last = max(int(m.get("week", 0)) for m in idea["milestones"])
    except (TypeError, ValueError):
        last = 0
        problems.append("milestones need integer weeks")
    if weeks and last > weeks:
        problems.append(f"plan ends in week {last} but the student has only {weeks} weeks")
    if domains and not any(_norm(d) in _norm(idea["domain"]) or _norm(idea["domain"]) in _norm(d) for d in domains):
        problems.append(f"domain must be one of: {', '.join(domains)}")

    v = encode(idea["title"] + ". " + idea["problem_statement"])   # 4. novelty
    sim = float((catalogue_emb @ v).max())
    idea["novelty_similarity"] = round(sim, 3)
    if sim >= NOVELTY_MAX:
        problems.append(f"too close to an existing project (similarity {sim:.2f}); change the users, setting or angle")
    return problems


class OllamaLLM:
    def __init__(self, url: Optional[str] = None, model: Optional[str] = None, timeout: float = 120):
        self.url = (url or os.environ.get("OLLAMA_URL", "http://localhost:11434")).rstrip("/")
        self.model = model or os.environ.get("OLLAMA_MODEL", "qwen2.5:3b")
        self.timeout = timeout

    def chat_json(self, system: str, user: str, schema: dict, temperature: float = 0.7) -> dict:
        import httpx
        r = httpx.post(f"{self.url}/api/chat", timeout=self.timeout, json={
            "model": self.model, "stream": False, "format": schema,
            "options": {"temperature": temperature, "num_ctx": 8192},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]})
        r.raise_for_status()
        return json.loads(r.json()["message"]["content"])


def _reference_block(refs) -> str:
    lines = []
    for r in refs.itertuples():
        lines.append(f"[{r.core_problem_id}] {r.title} | domain: {r.domain} | approach: {r.approach} | "
                     f"skills: {getattr(r, 'required_skills', '')} | {str(r.problem_statement)[:500]}")
    return "\n".join(lines)


def build_prompt(profile: dict, message: str, refs, k: int, applied: dict) -> str:
    domains = applied.get("domains") or profile.get("interests") or []
    return f"""Student profile:
- skills: {', '.join(profile.get('skills', []))}
- interests: {', '.join(profile.get('interests', [])) or 'open'}
- level: {profile.get('level') or 'not given'}
- weeks available: {applied.get('weeks') or profile.get('weeks') or 'not given'}
- hardware allowed: {'yes' if applied.get('hardware_ok', profile.get('hardware_ok', True)) else 'no, software only'}
Requested domain(s): {', '.join(domains) or 'any that fits the student'}
Preferred approach: {', '.join(applied.get('approaches') or []) or 'any'}
Preferred level: {', '.join(applied.get('levels') or []) or profile.get('level') or 'any'}
Student's message: "{message}"

Reference projects from our catalogue (inspiration only, do not copy):
{_reference_block(refs)}

Write {k} different ideas. Each one must start from a different reference project."""


def _catalogue_cards(refs) -> list:
    return [{"title": r.title, "problem_statement": r.problem_statement, "domain": r.domain,
             "target_users": str(getattr(r, "primary_user", "") or ""),
             "skills_used": list(getattr(r, "matched_skills", []) or []), "new_skill_to_learn": "",
             "tech_stack": [t.strip() for t in str(getattr(r, "tech_stack", "") or "").split(";") if t.strip()],
             "milestones": [], "data_source": "", "why_it_fits": "Closest match in the ProjectLens catalogue",
             "inspired_by": r.core_problem_id, "source": "catalogue", "checks": "grounded"} for r in refs.itertuples()]


def generate(rec, profile: dict, message: str = "", k: int = 3, exclude_core_ids=(), seed=None,
             domains=None, approaches=None, levels=None, llm=None, encode: Optional[Callable] = None) -> dict:
    """rec is the loaded Recommender. Returns {"ideas", "grounding", "applied", "source", "rounds", "rejected"}."""
    refs, applied = rec.recommend_with_filters(profile, message, k=max(5, k + 2), exclude_core_ids=exclude_core_ids,
                                               seed=seed, domains=domains, approaches=approaches, levels=levels)
    grounding = refs.core_problem_id.tolist() if len(refs) else []
    if refs.empty:
        return {"ideas": [], "grounding": [], "applied": applied, "source": "none", "rounds": 0, "rejected": []}
    encode = encode or (lambda t: rec.model.encode([t], normalize_embeddings=True)[0])
    llm = llm or OllamaLLM()
    want_domains = applied.get("domains") or []
    eff_profile = dict(profile, weeks=applied.get("weeks") or profile.get("weeks"))

    accepted, rejected, feedback = [], [], ""
    prompt = build_prompt(eff_profile, message, refs, k, applied)
    rounds = 0
    for rounds in range(1, MAX_ROUNDS + 1):
        need = k - len(accepted)
        user = prompt if not feedback else (prompt + f"\n\nWrite {need} more idea(s). Earlier attempts were rejected:\n"
                                            + feedback + "\nFix these problems.")
        try:
            out = llm.chat_json(SYSTEM, user, IDEA_SCHEMA, temperature=0.7 if rounds == 1 else 0.5)
            ideas = out.get("ideas", []) if isinstance(out, dict) else []
        except Exception as e:  # noqa: BLE001
            log.warning("LLM unavailable (%s); returning catalogue projects", e)
            return {"ideas": _catalogue_cards(refs.head(k)), "grounding": grounding, "applied": applied,
                    "source": "catalogue", "rounds": rounds, "rejected": rejected, "llm_error": str(e)}
        fb = []
        for idea in ideas:
            if len(accepted) >= k or not isinstance(idea, dict):
                continue
            if any(_norm(idea.get("title", "")) == _norm(a["title"]) for a in accepted):
                continue
            problems = check_idea(idea, eff_profile, want_domains, encode, rec.emb)
            if problems:
                rejected.append({"title": idea.get("title", "?"), "problems": problems})
                fb.append(f"- \"{idea.get('title', '?')}\": " + "; ".join(problems))
            else:
                idea.update(source="generated", checks="passed")
                accepted.append(idea)
        if len(accepted) >= k:
            break
        feedback = "\n".join(fb) or "- returned fewer ideas than asked"

    source = "generated"
    if len(accepted) < k:                                   # top up with grounded catalogue projects
        used = {a.get("inspired_by") for a in accepted}
        top_up = refs[~refs.core_problem_id.isin(used)].head(k - len(accepted))
        accepted += _catalogue_cards(top_up)
        source = "mixed" if any(a["source"] == "generated" for a in accepted) else "catalogue"
    return {"ideas": accepted[:k], "grounding": grounding, "applied": applied, "source": source,
            "rounds": rounds, "rejected": rejected}
