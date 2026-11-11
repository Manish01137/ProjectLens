#!/usr/bin/env node
// A stand-in for ml_service that follows the same HTTP contract, used by the Playwright tests
// (and for UI work without the trained model). Its projects are synthetic test data.
//   node e2e/mock-ml.mjs [port]
import http from "node:http";

const PORT = Number(process.argv[2] ?? process.env.MOCK_ML_PORT ?? 8001);

const DOMAINS = {
  Healthcare: ["patient triage", "medicine reminders", "clinic queues", "diabetic retinopathy screening"],
  Agriculture: ["crop disease detection", "soil moisture alerts", "mandi price forecasting", "pest outbreak mapping"],
  Education: ["doubt-solving forum", "attendance analytics", "adaptive quizzes", "lab slot booking"],
  "Cybersecurity & Blockchain": ["phishing URL detection", "certificate verification", "log anomaly detection", "voting audit trail"],
  "Smart Cities & Transport": ["bus arrival prediction", "parking availability", "pothole reporting", "traffic signal timing"],
  "Disaster Management & Earth Sciences": ["flood early warning", "landslide risk maps", "relief camp logistics", "rainfall nowcasting"],
  "Clean Energy & Environment": ["rooftop solar estimation", "air quality forecasting", "e-waste collection", "energy use dashboards"],
  "Governance & Legal": ["RTI request tracking", "case status summaries", "grievance routing", "scheme eligibility checks"],
  "Heritage & Tourism": ["monument audio guides", "crowd forecasting at sites", "local artisan marketplace", "heritage photo archive"],
  Fintech: ["UPI fraud flags", "expense categorisation", "micro-loan credit scoring", "GST invoice reader"],
  "Accessibility & Inclusion": ["sign language captions", "screen-reader friendly forms", "voice navigation for elders", "easy-read summaries"],
  "Software Engineering & AI Tooling": ["flaky test finder", "code review assistant", "API docs generator", "commit message helper"],
};
const APPROACHES = [
  ["Machine Learning", "Python, scikit-learn, FastAPI, React", "Software"],
  ["Computer Vision", "Python, PyTorch, OpenCV, Flutter", "Software"],
  ["NLP", "Python, Hugging Face, FastAPI, Next.js", "Software"],
  ["Web Application", "TypeScript, Next.js, Node.js, PostgreSQL", "Software"],
  ["IoT", "Arduino, Embedded C, MQTT, React", "Hardware"],
  ["Mobile App", "Flutter, Firebase, Dart", "Software"],
];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];

const projects = [];
let n = 0;
for (const [domain, topics] of Object.entries(DOMAINS)) {
  topics.forEach((topic, t) => {
    const core = `${domain.slice(0, 3).toUpperCase()}-${String(t + 1).padStart(2, "0")}`;
    APPROACHES.forEach(([approach, stack, type], a) => {
      n += 1;
      projects.push({
        id: `PS${String(n).padStart(5, "0")}`,
        core_problem_id: `${core}-${a}`,
        title: `${topic.charAt(0).toUpperCase()}${topic.slice(1)} with ${approach.toLowerCase()}`,
        problem_statement: `Many communities still handle ${topic} by hand, which is slow and error-prone. Build a ${approach.toLowerCase()} solution for ${domain.toLowerCase()} that a real user can try, measure how well it works, and document its limits.`,
        domain,
        approach,
        project_type: type,
        tech_stack: stack,
        level: LEVELS[(t + a) % 3],
        duration_weeks: [8, 10, 12, 14, 16, 20][(t + a) % 6],
        required_skills: stack.split(", ").join(";"),
        source: "Mock ML service (test data)",
      });
    });
  });
}

const DOMAIN_WORDS = Object.fromEntries(Object.keys(DOMAINS).map((d) => [d, d.toLowerCase().split(/[ &]+/)[0]]));

/** Mirrors ranking.py's contract: explicit domains/levels win, else read from the message. */
function filtersFor(body) {
  const p = body.profile ?? {};
  const msg = String(body.message ?? "").toLowerCase();
  const domains = body.domains?.length ? body.domains : Object.keys(DOMAINS).filter((d) => msg.includes(DOMAIN_WORDS[d]));
  let levels = body.levels?.length ? body.levels : [];
  if (!levels.length && /\b(easier|simpler|beginner)\b/.test(msg)) levels = ["Beginner"];
  return { domains, approaches: body.approaches ?? [], levels, weeks: p.weeks ?? null, hardware_ok: p.hardware_ok ?? true, relaxed: [] };
}

function recommend(body) {
  const p = body.profile ?? {};
  const k = Math.min(10, Math.max(1, body.k ?? 5));
  const applied = filtersFor(body);
  const exclude = new Set(body.exclude_core_ids ?? []);
  const want = new Set((p.skills ?? []).map((s) => s.toLowerCase()));
  const interests = new Set(p.interests ?? []);
  let pool = projects.filter((x) => !exclude.has(x.core_problem_id));
  if (p.weeks) pool = pool.filter((x) => x.duration_weeks <= p.weeks + 4);
  if (p.hardware_ok === false) pool = pool.filter((x) => x.project_type !== "Hardware");
  if (applied.domains.length) pool = pool.filter((x) => applied.domains.includes(x.domain));
  if (applied.levels.length) {
    // Like ranking.py: a level wish is relaxed (and reported) when too few problems are left.
    const lv = pool.filter((x) => applied.levels.includes(x.level));
    if (new Set(lv.map((x) => x.core_problem_id)).size >= k) pool = lv;
    else {
      applied.relaxed.push("level");
      applied.levels = [];
    }
  }
  const scored = pool.map((x) => {
    const skills = x.required_skills.split(";");
    const matched = skills.filter((s) => want.has(s.toLowerCase()));
    let score = 0.3 + 0.08 * matched.length + (interests.has(x.domain) ? 0.25 : 0) + (x.level === p.level ? 0.05 : 0);
    return { ...x, matched_skills: matched, match_score: Math.round(Math.min(score, 0.99) * 1e4) / 1e4 };
  });
  scored.sort((a, b) => b.match_score - a.match_score || a.id.localeCompare(b.id));
  const out = [];
  const cores = new Set();
  for (const s of scored) {
    if (cores.has(s.core_problem_id)) continue;
    cores.add(s.core_problem_id);
    const { required_skills: _r, ...rest } = s;
    out.push(rest);
    if (out.length >= k) break;
  }
  return { out, applied };
}

/** /generate stand-in: "writes" one idea per reference, grounded in the top matches. */
function generate(body) {
  const k = Math.min(5, Math.max(1, body.k ?? 3));
  const { out: refs, applied } = recommend({ ...body, k: k + 2 });
  const weeks = body.profile?.weeks ?? 12;
  const skills = body.profile?.skills ?? [];
  const ideas = refs.slice(0, k).map((r, i) => ({
    title: `${r.title.replace(/ with .*/, "")} for first-time users (idea ${i + 1})`,
    problem_statement: `People who rely on ${r.title.toLowerCase()} today struggle with slow, manual steps. Build a small ${r.approach.toLowerCase()} tool for them and measure how much time it saves.`,
    domain: r.domain,
    target_users: "First-time users in tier-2 towns",
    skills_used: skills.slice(0, 2),
    new_skill_to_learn: "FastAPI",
    tech_stack: r.tech_stack.split(", "),
    milestones: [
      { week: 2, task: "Interview five users" },
      { week: Math.max(3, Math.round(weeks / 2)), task: "Working prototype" },
      { week: weeks, task: "Evaluation and demo" },
    ],
    data_source: "collect with a survey",
    why_it_fits: `Uses your ${skills.slice(0, 2).join(" and ")} skills`,
    inspired_by: r.core_problem_id,
    source: "generated",
    checks: "passed",
    novelty_similarity: 0.72,
  }));
  return { body: { ideas, grounding: refs.map((r) => r.core_problem_id), applied, source: "generated", rounds: 1, rejected: [] }, applied };
}
const send = (res, status, body, applied) => {
  res.writeHead(status, { "content-type": "application/json", ...(applied ? { "x-applied-filters": JSON.stringify(applied) } : {}) });
  res.end(JSON.stringify(body));
};

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (req.method === "GET" && req.url === "/health")
        return send(res, 200, { status: "ok", projects_indexed: projects.length, intent_model: false, intent_version: null });
      if (req.method === "POST" && req.url === "/intent") return send(res, 501, { detail: "Intent model not trained yet" });
      if (req.method === "POST" && req.url === "/recommend") {
        let body;
        try {
          body = JSON.parse(raw || "{}");
        } catch {
          return send(res, 422, { detail: "invalid json" });
        }
        if (!Array.isArray(body.profile?.skills) || body.profile.skills.length === 0) return send(res, 422, { detail: "skills required" });
        const { out, applied } = recommend(body);
        return out.length ? send(res, 200, out, applied) : send(res, 404, { detail: "No projects left for this profile" }, applied);
      }
      if (req.method === "POST" && req.url === "/generate") {
        let body;
        try {
          body = JSON.parse(raw || "{}");
        } catch {
          return send(res, 422, { detail: "invalid json" });
        }
        if (!Array.isArray(body.profile?.skills) || body.profile.skills.length === 0) return send(res, 422, { detail: "skills required" });
        const { body: out, applied } = generate(body);
        return out.ideas.length ? send(res, 200, out, applied) : send(res, 404, { detail: "No projects left" }, applied);
      }
      send(res, 404, { detail: "not found" });
    });
  })
  .listen(PORT, () => console.log(`mock ML service on http://localhost:${PORT} (${projects.length} synthetic projects)`));
