// Shared vocabulary. DOMAINS must match the names the ML model was trained on.

export const BRANCHES = ["CSE", "IT", "ECE", "EEE", "Mechanical", "Civil", "AI&DS", "Other"] as const;

export const SKILL_SUGGESTIONS = [
  "Python", "Java", "C++", "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "SQL", "MongoDB",
  "Machine Learning", "Computer Vision", "NLP", "LLMs", "PyTorch", "TensorFlow", "Data Analysis", "Flutter",
  "Android", "IoT", "Embedded C", "Arduino", "Raspberry Pi", "Blockchain", "Solidity", "Docker", "Kubernetes",
  "DevOps", "Cloud", "AWS", "Azure", "GIS", "Cybersecurity",
] as const;

export const DOMAINS = [
  "Healthcare",
  "Agriculture",
  "Education",
  "Cybersecurity & Blockchain",
  "Smart Cities & Transport",
  "Disaster Management & Earth Sciences",
  "Clean Energy & Environment",
  "Governance & Legal",
  "Heritage & Tourism",
  "Fintech",
  "Accessibility & Inclusion",
  "Software Engineering & AI Tooling",
] as const;

export const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
export const GOALS = ["Placement", "Research", "Startup", "Hackathon"] as const;
export const SAVED_STATUSES = ["Shortlisted", "Discussing with guide", "Chosen"] as const;

export type Domain = (typeof DOMAINS)[number];
export type Level = (typeof LEVELS)[number];
export type Goal = (typeof GOALS)[number];
export type SavedStatus = (typeof SAVED_STATUSES)[number];

/** Everyday words that point at one of the 12 domains (used by the chat rules). */
export const DOMAIN_ALIASES: Record<Domain, string[]> = {
  Healthcare: ["healthcare", "health", "medical", "medicine", "hospital", "patient", "patients", "clinic", "disease", "mental health"],
  Agriculture: ["agriculture", "agri", "farming", "farm", "farms", "farmer", "farmers", "crop", "crops", "soil", "irrigation"],
  Education: ["education", "edtech", "e-learning", "students", "school", "teaching", "college"],
  "Cybersecurity & Blockchain": ["cybersecurity", "security", "blockchain", "crypto", "web3", "phishing", "malware"],
  "Smart Cities & Transport": ["smart city", "smart cities", "transport", "traffic", "parking", "mobility", "urban"],
  "Disaster Management & Earth Sciences": ["disaster", "flood", "earthquake", "climate", "weather", "earth science", "landslide"],
  "Clean Energy & Environment": ["energy", "solar", "environment", "pollution", "renewable", "waste", "carbon", "green"],
  "Governance & Legal": ["governance", "legal", "law", "government", "civic", "court", "policy"],
  "Heritage & Tourism": ["heritage", "tourism", "tourist", "travel", "culture", "museum"],
  Fintech: ["fintech", "finance", "banking", "payments", "upi", "stock", "loan", "insurance"],
  "Accessibility & Inclusion": ["accessibility", "inclusion", "disability", "disabled", "blind", "deaf", "sign language", "elderly"],
  "Software Engineering & AI Tooling": ["software engineering", "developer tools", "devtools", "ai tooling", "code review", "testing tools"],
};

export const APP_NAME = "ProjectLens";
export const TAGLINE = "Discovering Projects That Truly Fit";
