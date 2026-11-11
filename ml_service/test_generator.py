"""Tests for model 3 (generator.py) with a scripted fake LLM, so they run without Ollama.
They check the four rules: format, skills, time/domain, novelty, plus retry and catalogue fallback.
Run: python test_generator.py"""
import numpy as np

import generator
from test_ranking import EMB, META

PROFILE = {"skills": ["Python", "Machine Learning", "React", "SQL"], "interests": ["Healthcare"],
           "level": "Intermediate", "weeks": 12, "hardware_ok": False}


class FakeRec:
    """Stands in for Recommender: real catalogue, random vectors."""
    def __init__(self):
        self.meta, self.emb = META, EMB

    def recommend_with_filters(self, profile, message="", k=5, exclude_core_ids=(), seed=None, **kw):
        from ranking import recommend_core
        rel = self.emb @ self.emb[0]
        return recommend_core(self.meta, self.emb, rel, profile, message, k, exclude_core_ids, 0.3, 0.3, seed,
                              kw.get("domains"), kw.get("approaches"), kw.get("levels"))


def far_vector(_text):
    """A unit vector unlike every catalogue row, so the novelty check passes."""
    v = -EMB.mean(0)
    return (v / np.linalg.norm(v)).astype(np.float32)


def idea(title, **over):
    base = {"title": title, "problem_statement": "Rural clinics lose track of follow-ups. Build a web app that ...",
            "domain": "Healthcare", "target_users": "ASHA workers", "skills_used": ["Python", "React"],
            "new_skill_to_learn": "", "tech_stack": ["FastAPI", "React", "PostgreSQL"],
            "milestones": [{"week": 2, "task": "survey"}, {"week": 12, "task": "demo"}],
            "data_source": "collect with a survey", "why_it_fits": "uses your Python and React", "inspired_by": "x"}
    base.update(over)
    return base


class ScriptedLLM:
    def __init__(self, *rounds):
        self.rounds, self.prompts = list(rounds), []

    def chat_json(self, system, user, schema, temperature=0.7):
        self.prompts.append(user)
        return {"ideas": self.rounds.pop(0) if self.rounds else []}


class DownLLM:
    def chat_json(self, *a, **k):
        raise ConnectionError("ollama not running")


def run(llm, message="suggest a healthcare project", encode=far_vector, k=3):
    return generator.generate(FakeRec(), PROFILE, message, k=k, seed=1, llm=llm, encode=encode)


def test_good_ideas_pass():
    out = run(ScriptedLLM([idea("A"), idea("B", new_skill_to_learn="Docker", skills_used=["Python", "Docker"]),
                           idea("C")]))
    assert out["source"] == "generated" and len(out["ideas"]) == 3, out
    assert all(i["checks"] == "passed" for i in out["ideas"])
    assert out["applied"]["domains"] == ["Healthcare"]


def test_each_check_rejects_and_retries():
    bad = [idea("too long", milestones=[{"week": 20, "task": "x"}]),            # time
           idea("unknown skills", skills_used=["Rust", "Go"]),                   # skills
           idea("wrong domain", domain="Fintech"),                               # domain
           idea("missing", data_source="")]                                      # format
    llm = ScriptedLLM(bad, [idea("fixed 1"), idea("fixed 2"), idea("fixed 3")])
    out = run(llm)
    titles = {r["title"]: " ".join(r["problems"]) for r in out["rejected"]}
    assert "only 12 weeks" in titles["too long"]
    assert "does not know" in titles["unknown skills"]
    assert "domain must be" in titles["wrong domain"]
    assert "empty" in titles["missing"]
    assert [i["title"] for i in out["ideas"]] == ["fixed 1", "fixed 2", "fixed 3"]
    assert "rejected" in llm.prompts[1] and "only 12 weeks" in llm.prompts[1], "reasons must be fed back"


def test_novelty_blocks_copies():
    copy_vec = lambda _t: EMB[5]                       # identical to a catalogue row
    out = run(ScriptedLLM([idea("copy")], [idea("copy again")], [idea("still copy")]), encode=copy_vec, k=1)
    assert out["source"] == "catalogue" and out["ideas"][0]["source"] == "catalogue"
    assert all("too close" in " ".join(r["problems"]) for r in out["rejected"])


def test_llm_down_falls_back_to_catalogue():
    out = run(DownLLM())
    assert out["source"] == "catalogue" and len(out["ideas"]) == 3
    assert all(i["domain"] == "Healthcare" for i in out["ideas"])


def test_partial_is_topped_up():
    out = run(ScriptedLLM([idea("only one")], [], []))
    assert out["source"] == "mixed" and len(out["ideas"]) == 3
    assert out["ideas"][0]["source"] == "generated"


def test_skill_aliases():
    p = dict(PROFILE, skills=["ML", "React.js", "Python"])
    ok = generator.check_idea(idea("a", skills_used=["Machine Learning", "React", "Python"]), p, ["Healthcare"],
                              far_vector, EMB)
    assert ok == [], ok


if __name__ == "__main__":
    tests = [v for k, v in dict(globals()).items() if k.startswith("test_")]
    for t in tests:
        t()
        print("OK ", t.__name__)
    print(f"All {len(tests)} generator tests passed")
