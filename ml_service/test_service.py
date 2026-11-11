"""Checks the service works and gives varied results. Run: python test_service.py"""
from fastapi.testclient import TestClient
from main import app

student = {"skills": ["Python", "Machine Learning", "React"], "interests": ["Healthcare", "Education"],
           "level": "Intermediate", "weeks": 12, "hardware_ok": False}

with TestClient(app) as client:
    assert client.get("/health").json()["status"] == "ok"

    seen, shown = [], []
    for round_no in range(5):                          # student clicks "show more" 5 times
        r = client.post("/recommend", json={"profile": student, "exclude_core_ids": seen, "seed": round_no})
        assert r.status_code == 200, r.text
        ideas = r.json()
        assert len(ideas) == 5
        assert len({i["core_problem_id"] for i in ideas}) == 5, "duplicate core problem inside one answer"
        assert not set(seen) & {i["core_problem_id"] for i in ideas}, "a seen project came back"
        assert all(i["project_type"] != "Hardware" for i in ideas), "hardware shown to a no-hardware student"
        assert all(i["duration_weeks"] is None or i["duration_weeks"] <= 16 for i in ideas)
        seen += [i["core_problem_id"] for i in ideas]
        shown += ideas
    print(f"OK: 5 rounds gave {len(shown)} ideas from {len(set(seen))} different core problems")

    bad = client.post("/recommend", json={"profile": {"skills": []}})
    assert bad.status_code == 422, "empty skills should be rejected"
    print("OK: invalid profile rejected with 422")
    print("Example idea:", shown[0]["title"], "| matched:", shown[0]["matched_skills"])

    # Model 1: /health reports the intent model; /intent answers 200 when installed, 501 when not
    import os
    health = client.get("/health").json()
    assert isinstance(health.get("intent_model"), bool), health
    r = client.post("/intent", json={"text": "suggest a healthcare project"})
    if health["intent_model"]:
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["intent"] in {"greeting", "chitchat", "general_question", "ask_project", "refine_project",
                                  "explain_project", "profile_update"}, body
        assert 0 <= body["confidence"] <= 1
        print(f"OK: /intent → {body['intent']} ({body['confidence']:.2f})")
    else:
        assert r.status_code == 501, r.text
        print("OK: /intent answers 501 (intent model not installed), website uses its rules")

    # Model 3: with the LLM unreachable, /generate falls back to catalogue projects that respect the domain
    old = os.environ.get("OLLAMA_URL")
    os.environ["OLLAMA_URL"] = "http://127.0.0.1:9"          # closed port
    try:
        g = client.post("/generate", json={"profile": student, "message": "suggest a healthcare project", "k": 3})
    finally:
        if old is None:
            os.environ.pop("OLLAMA_URL", None)
        else:
            os.environ["OLLAMA_URL"] = old
    assert g.status_code == 200, g.text
    out = g.json()
    assert out["source"] == "catalogue", out["source"]
    assert len(out["ideas"]) == 3 and all(i["domain"] == "Healthcare" for i in out["ideas"]), out["ideas"]
    assert out["applied"]["domains"] == ["Healthcare"]
    assert "X-Applied-Filters" in g.headers
    print("OK: /generate with the LLM offline returns 3 Healthcare catalogue projects")
