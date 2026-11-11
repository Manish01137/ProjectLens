"""Unit tests for ranking.py. They use the real projects.csv when it is present and random vectors, so they test the
RULES (filters, spread, no repeats) independently of model quality. Run: python test_ranking.py"""
import glob
import os
import numpy as np
import pandas as pd

from ranking import DOMAINS, recommend_core, understand_request

HERE = os.path.dirname(os.path.abspath(__file__))


def load_meta():
    found = sorted(glob.glob(os.path.join(HERE, "artifacts", "**", "projects.csv"), recursive=True))
    if found:
        meta = pd.read_csv(found[0], low_memory=False)
    else:                                                    # tiny synthetic catalogue when no model is installed
        rows = []
        for d_i, d in enumerate(DOMAINS):
            for c in range(12):
                for v in range(6):
                    rows.append({"id": f"P{d_i}{c}{v}", "core_problem_id": f"{d_i}-{c}", "domain": d,
                                 "approach": ["Machine Learning", "Web App", "Mobile App", "IoT / Hardware"][c % 4],
                                 "project_type": "Hardware" if c % 4 == 3 else "Software",
                                 "level": ["Beginner", "Intermediate", "Advanced"][c % 3], "duration_weeks": [8, 12, 16][c % 3],
                                 "required_skills": ["Python; Machine Learning; SQL", "JavaScript; React; SQL",
                                                     "Flutter; Mobile Development; Firebase", "Embedded C; IoT; Electronics"][c % 4],
                                 "title": f"t{d_i}{c}{v}", "problem_statement": "x", "source": "Generated"})
        meta = pd.DataFrame(rows)
    meta["duration_weeks"] = pd.to_numeric(meta["duration_weeks"], errors="coerce")
    for c in ["required_skills", "approach", "level", "project_type"]:
        meta[c] = meta[c].fillna("")
    return meta


META = load_meta()
RNG = np.random.default_rng(0)
EMB = RNG.normal(size=(len(META), 32)).astype(np.float32)
EMB /= np.linalg.norm(EMB, axis=1, keepdims=True)
DEMO = {"skills": ["Python", "Machine Learning", "React", "SQL"], "interests": ["Healthcare", "Education"],
        "level": "Intermediate", "weeks": 12, "hardware_ok": False}


def run(profile=DEMO, message="", **kw):
    rel = EMB @ EMB[RNG.integers(len(EMB))]
    return recommend_core(META, EMB, rel, profile, message, seed=kw.pop("seed", 1), **kw)


def test_understand():
    u = understand_request("suggest a healthcare project", DEMO)
    assert u["domains"] == ["Healthcare"], u
    assert understand_request("something in agriculture using flutter", DEMO)["approaches"] == ["Mobile App"]
    assert understand_request("make it easier", DEMO)["levels"] == ["Beginner"]
    assert understand_request("make it harder", DEMO)["levels"] == ["Advanced"]
    assert understand_request("I only have 8 weeks", DEMO)["weeks"] == 8
    assert understand_request("in 2 months", DEMO)["weeks"] == 8
    nh = understand_request("no hardware please", DEMO)
    assert nh["hardware_ok"] is False and "IoT / Hardware" not in nh["approaches"]
    assert understand_request("hi, how are you?", DEMO)["domains"] == []
    assert understand_request("I want a machine learning project for my college", DEMO)["domains"] == []
    assert understand_request("a fintech or banking idea", DEMO)["domains"] == ["Fintech"]
    for d in DOMAINS:                                        # exact names sent by the UI always work
        assert d in understand_request(f"projects in {d}", DEMO)["domains"], d


def test_every_domain_request_is_respected():
    words = {"Healthcare": "healthcare", "Agriculture": "agriculture", "Education": "education",
             "Cybersecurity & Blockchain": "cybersecurity", "Smart Cities & Transport": "smart cities",
             "Disaster Management & Earth Sciences": "disaster management", "Clean Energy & Environment": "clean energy",
             "Governance & Legal": "governance", "Heritage & Tourism": "tourism", "Fintech": "fintech",
             "Accessibility & Inclusion": "accessibility", "Software Engineering & AI Tooling": "devops"}
    for d, w in words.items():
        out, applied = run(message=f"suggest a {w} project")
        assert len(out) == 5, (d, len(out))
        assert set(out.domain) == {d}, (d, out.domain.tolist())
        assert applied["domains"] == [d]


def test_interests_are_spread():
    out, applied = run()
    assert {"Healthcare", "Education"} <= set(out.domain), out.domain.tolist()
    assert applied.get("spread_over_interests") == ["Healthcare", "Education"]


def test_easier_and_hardware_and_weeks():
    out, applied = run(message="healthcare but make it easier")
    assert set(out.domain) == {"Healthcare"}
    assert "level" in applied["relaxed"] or set(out.level) <= {"Beginner", ""}, out.level.tolist()
    out, applied = run(message="something with arduino sensors in agriculture")
    assert set(out.domain) == {"Agriculture"}
    assert "approach" in applied["relaxed"] or set(out.approach) == {"IoT / Hardware"}, out.approach.tolist()
    out, _ = run(message="education project, I only have 8 weeks")
    assert (out.duration_weeks.fillna(0) <= 12).all()
    out, _ = run()
    assert (out.project_type != "Hardware").all(), "software-only profile got hardware"


def test_no_repeats_across_rounds_in_one_domain():
    seen = []
    for r in range(4):
        out, _ = run(message="healthcare project", exclude_core_ids=seen, seed=r)
        if out.empty:                                    # small catalogue ran out: fewer results, never other domains
            break
        assert set(out.domain) == {"Healthcare"}
        assert not set(seen) & set(out.core_problem_id)
        seen += out.core_problem_id.tolist()
    assert len(seen) == len(set(seen))


def test_react_student_sees_web_projects():
    seen, approaches = [], []
    for r in range(2):
        out, _ = run(exclude_core_ids=seen, seed=r)
        seen += out.core_problem_id.tolist(); approaches += out.approach.tolist()
    assert any("React" in s for s in META[META.core_problem_id.isin(seen)].required_skills) or "Web App" in approaches


if __name__ == "__main__":
    tests = [v for k, v in dict(globals()).items() if k.startswith("test_")]
    for t in tests:
        t()
        print("OK ", t.__name__)
    print(f"All {len(tests)} ranking tests passed ({len(META):,} catalogue rows)")
