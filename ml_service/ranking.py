"""ProjectLens ranking logic: one source of truth for the API service and the Colab notebook.

recommend_core() takes the trained model's similarity scores and turns them into a short, varied, fitting list:
  1. Understand the request text: domains, approach, level ("easier"), weeks and "no hardware" it asks for.
  2. Hard filters: weeks, hardware, already-shown problems, and an explicitly requested domain/approach/level.
  3. One best row per core problem (no near-copies), plus a small bonus for using more of the student's skills.
  4. Fill the k slots round-robin across the requested domains (or the student's interests), choosing each with
     MMR (relevant AND different from what is already picked) plus a little randomness (exploration).
"""
import re
import numpy as np
import pandas as pd

DOMAINS = ["Healthcare", "Agriculture", "Education", "Cybersecurity & Blockchain", "Smart Cities & Transport",
           "Disaster Management & Earth Sciences", "Clean Energy & Environment", "Governance & Legal",
           "Heritage & Tourism", "Fintech", "Accessibility & Inclusion", "Software Engineering & AI Tooling"]

DOMAIN_KEYWORDS = {
    "Healthcare": ["health", "healthcare", "medical", "medicine", "medicines", "hospital", "hospitals", "patient", "patients",
                   "doctor", "doctors", "disease", "diseases", "clinic", "clinical", "mental health", "medtech", "healthtech",
                   "pharma", "pharmacy", "ayurveda", "nursing", "diagnosis"],
    "Agriculture": ["agriculture", "agricultural", "agri", "agritech", "farm", "farms", "farming", "farmer", "farmers", "crop",
                    "crops", "soil", "dairy", "livestock", "cattle", "fisheries", "fishing", "irrigation", "food", "foodtech",
                    "harvest", "mandi", "rural development"],
    "Education": ["education", "educational", "edtech", "school", "schools", "teaching", "teacher", "teachers", "exam",
                  "exams", "learning platform", "e-learning", "classroom", "tutoring", "curriculum", "academic"],
    "Cybersecurity & Blockchain": ["cyber", "cybersecurity", "security", "secure", "phishing", "malware", "blockchain",
                                   "web3", "privacy", "intrusion", "hacking", "smart contract", "smart contracts",
                                   "scam", "scams", "ransomware"],
    "Smart Cities & Transport": ["smart city", "smart cities", "traffic", "transport", "transportation", "parking", "bus",
                                 "buses", "road", "roads", "urban", "mobility", "logistics", "delivery", "metro rail",
                                 "railway", "railways", "vehicle", "vehicles"],
    "Disaster Management & Earth Sciences": ["disaster", "disasters", "flood", "floods", "earthquake", "landslide", "cyclone",
                                             "tsunami", "wildfire", "forest fire", "emergency response", "earth science",
                                             "ocean", "oceans", "climate risk", "rescue", "early warning"],
    "Clean Energy & Environment": ["energy", "solar", "renewable", "pollution", "environment", "environmental", "waste",
                                   "recycling", "carbon", "sustainability", "sustainable", "green", "clean tech",
                                   "cleantech", "water conservation", "air quality", "climate change", "ev", "electric vehicle"],
    "Governance & Legal": ["governance", "government", "e-governance", "legal", "law", "laws", "court", "courts", "civic",
                           "rti", "panchayat", "policy", "public services", "citizen", "citizens", "legaltech", "welfare"],
    "Heritage & Tourism": ["tourism", "tourist", "tourists", "travel", "heritage", "culture", "cultural", "museum", "monument",
                           "monuments", "handloom", "handicraft", "handicrafts", "temple", "temples", "history", "art"],
    "Fintech": ["fintech", "finance", "financial", "bank", "banks", "banking", "payment", "payments", "upi", "loan", "loans",
                "credit", "insurance", "investment", "investing", "money", "budgeting", "accounting", "gst", "microfinance"],
    "Accessibility & Inclusion": ["accessibility", "accessible", "disability", "disabilities", "disabled", "blind",
                                  "visually impaired", "deaf", "hearing impaired", "wheelchair", "assistive", "inclusion",
                                  "inclusive", "sign language", "dyslexia", "elderly", "special needs"],
    "Software Engineering & AI Tooling": ["devops", "developer tools", "developer tool", "software engineering", "ci/cd",
                                          "cicd", "mlops", "kubernetes", "testing tools", "code review", "llmops",
                                          "observability", "developer productivity", "ai tooling", "dev tools", "sre"],
}
APPROACH_KEYWORDS = {
    "Computer Vision": ["computer vision", "image processing", "images", "image", "camera", "cv", "opencv", "yolo", "video"],
    "NLP / LLM": ["nlp", "chatbot", "chatbots", "llm", "llms", "language model", "text analysis", "speech", "voice",
                  "translation", "rag", "generative ai", "genai"],
    "Machine Learning": ["machine learning", "ml model", "prediction", "predictive", "forecasting", "classification model"],
    "IoT / Hardware": ["iot", "hardware", "arduino", "esp32", "raspberry pi", "sensor", "sensors", "embedded", "electronics"],
    "Web App": ["web app", "website", "web platform", "web application", "full stack", "full-stack", "react", "next.js",
                "nextjs", "frontend", "mern"],
    "Mobile App": ["mobile app", "android", "ios app", "flutter", "react native", "kotlin app", "app for phones"],
    "Blockchain": ["blockchain", "web3", "smart contract", "smart contracts", "solidity", "ethereum", "hyperledger"],
    "DevOps / Automation": ["devops", "automation", "ci/cd", "cicd", "docker", "kubernetes", "terraform", "pipeline"],
    "Geospatial": ["gis", "geospatial", "satellite", "maps", "mapping", "remote sensing"],
    "Data Analytics": ["data analytics", "dashboard", "dashboards", "data analysis", "analytics", "visualisation",
                       "visualization", "power bi", "tableau"],
}
LEVELS = ["Beginner", "Intermediate", "Advanced"]
EASIER = r"\b(easier|easy|simpler|simple|beginner|basic|less complex|not too hard|lighter)\b"
HARDER = r"\b(harder|hard|advanced|challenging|complex|tougher|more difficult|research[- ]level)\b"
NO_HW = r"\b(no hardware|without hardware|software only|software-only|only software|no iot)\b"


def _find(text, words):
    return [w for w in words if re.search(r"(?<![\w-])" + re.escape(w) + r"(?![\w-])", text)]


def understand_request(message: str, profile: dict) -> dict:
    """Pulls explicit wishes out of the student's message. Profile text is NOT parsed here."""
    text = (message or "").lower()
    out = {"domains": [], "approaches": [], "levels": None, "weeks": None, "hardware_ok": None}
    if not text.strip():
        return out
    out["domains"] = [d for d, kws in DOMAIN_KEYWORDS.items() if _find(text, kws)]
    for d in DOMAINS:                                   # exact domain names typed or sent by the UI
        if d.lower() in text and d not in out["domains"]:
            out["domains"].append(d)
    out["approaches"] = [a for a, kws in APPROACH_KEYWORDS.items() if _find(text, kws)]
    base = profile.get("level") if profile.get("level") in LEVELS else "Intermediate"
    i = LEVELS.index(base)
    if re.search(EASIER, text):
        out["levels"] = LEVELS[:max(i, 1)]               # strictly easier, or Beginner if already Beginner
    elif re.search(HARDER, text):
        out["levels"] = LEVELS[min(i + 1, 2):]          # strictly harder, or Advanced
    m = re.search(r"\b(\d{1,2})\s*(weeks?|wks?)\b", text) or re.search(r"\b(\d{1,2})\s*months?\b", text)
    if m:
        n = int(m.group(1))
        out["weeks"] = n * 4 if "month" in m.group(0) else n
    if re.search(NO_HW, text):
        out["hardware_ok"] = False
        out["approaches"] = [a for a in out["approaches"] if a != "IoT / Hardware"]
    return out


def recommend_core(meta: pd.DataFrame, emb: np.ndarray, rel: np.ndarray, profile: dict, message: str = "", k: int = 5,
                   exclude_core_ids=(), explore: float = 0.3, diversity: float = 0.3, seed=None,
                   domains=None, approaches=None, levels=None):
    """Returns (DataFrame of up to k projects, dict of filters that were applied)."""
    rng = np.random.default_rng(seed)
    wish = understand_request(message, profile)
    domains = [d for d in (domains or wish["domains"]) if d in DOMAINS]
    approaches = approaches or wish["approaches"]
    levels = levels or wish["levels"]
    weeks = wish["weeks"] or profile.get("weeks")
    hardware_ok = profile.get("hardware_ok", True) if wish["hardware_ok"] is None else wish["hardware_ok"]
    if approaches == ["IoT / Hardware"] or "IoT / Hardware" in approaches:
        hardware_ok = True                               # asking for IoT overrides a "software only" profile

    skills = {s.strip().lower() for s in profile.get("skills", []) if s.strip()}
    req = meta.required_skills.fillna("").str.lower().str.split(r"\s*;\s*")
    skill_frac = req.map(lambda rs: len(skills & set(rs)) / len(skills) if skills else 0.0).to_numpy()
    m = meta.assign(rel=rel + 0.08 * skill_frac, row=np.arange(len(rel)))

    if weeks:
        m = m[m.duration_weeks.isna() | (m.duration_weeks <= weeks + 4)]
    if not hardware_ok:
        m = m[m.project_type != "Hardware"]
    m = m[~m.core_problem_id.isin(set(exclude_core_ids))]
    if domains:
        m = m[m.domain.isin(domains)]                    # an explicitly requested domain is never broken
    applied = {"domains": domains, "approaches": [], "levels": [], "weeks": weeks, "hardware_ok": hardware_ok,
               "relaxed": []}
    if approaches:                                       # approach and level are strong wishes, relaxed only if empty
        m2 = m[m.approach.isin(approaches)]
        if len(m2.core_problem_id.unique()) >= k:
            m, applied["approaches"] = m2, approaches
        else:
            applied["relaxed"].append("approach")
    if levels:
        m2 = m[m.level.isin(levels) | (m.level.fillna("") == "")]
        if len(m2.core_problem_id.unique()) >= k:
            m, applied["levels"] = m2, levels
        else:
            applied["relaxed"].append("level")
    if m.empty:
        return m, applied

    c = m.loc[m.groupby("core_problem_id").rel.idxmax()].nlargest(120, "rel").reset_index(drop=True)
    targets = domains or [d for d in profile.get("interests", []) if d in DOMAINS]
    if targets and not domains:                          # interests guide the spread but never block other domains
        applied["spread_over_interests"] = targets
    noisy = c.rel.to_numpy() + explore * 0.05 * rng.gumbel(size=len(c))
    vecs = emb[c.row.to_numpy()]
    chosen = []
    for slot in range(min(k, len(c))):
        allowed = np.ones(len(c), dtype=bool)
        if targets:
            want = targets[slot % len(targets)]
            in_target = (c.domain == want).to_numpy()
            if (in_target & ~np.isin(np.arange(len(c)), chosen)).any():
                allowed = in_target
        score = noisy.copy() if not chosen else (1 - diversity) * noisy - diversity * (vecs @ vecs[chosen].T).max(axis=1)
        score[~allowed] = -np.inf
        score[chosen] = -np.inf
        if not np.isfinite(score).any():
            break
        chosen.append(int(np.argmax(score)))
    out = c.iloc[chosen].copy()
    out["matched_skills"] = [[s.strip() for s in rs.split(";") if s.strip().lower() in skills]
                             for rs in out.required_skills.fillna("")]
    return out, applied
