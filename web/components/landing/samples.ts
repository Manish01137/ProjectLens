import type { Domain } from "@/lib/constants";

// Hand-written examples for the landing page's "Try it" section. They show the SHAPE of what
// ProjectLens writes; they are labelled as examples and are not model output.
export type Sample = {
  title: string;
  statement: string;
  skills: string[];
  newSkill: string;
  stack: string[];
  weeks: number;
  milestones: [number, string][];
};

export const SAMPLES: Record<Domain, Sample> = {
  Healthcare: {
    title: "Missed-dose alerts for TB patients in tier-2 towns",
    statement:
      "ASHA workers track TB medication by phone calls and paper. Build a web app that flags patients likely to miss doses from their refill history, so workers visit them first. Success: fewer missed doses than the current call list.",
    skills: ["Python", "Machine Learning", "React"],
    newSkill: "FastAPI",
    stack: ["Python", "scikit-learn", "FastAPI", "React"],
    weeks: 12,
    milestones: [[2, "Interview 5 ASHA workers"], [6, "Risk model beats the call-list baseline"], [12, "Pilot with one PHC"]],
  },
  Agriculture: {
    title: "Leaf-disease triage from low-light phone photos",
    statement:
      "Farmers wait days for an extension officer to identify crop disease. Build a mobile flow that classifies five common tomato leaf diseases from phone photos and suggests next steps in Hindi. Success: 85% accuracy on field photos.",
    skills: ["Python", "Computer Vision"],
    newSkill: "Flutter",
    stack: ["PyTorch", "OpenCV", "Flutter"],
    weeks: 14,
    milestones: [[3, "Collect 600 field photos"], [8, "Model on-device"], [14, "Field test in one village"]],
  },
  Education: {
    title: "Weak-topic practice sets for Class 10 maths",
    statement:
      "Government-school teachers can't personalise revision for 60 students. Build a tool that reads past test scores and builds a practice set per student around their weakest topics. Success: higher re-test scores than a common worksheet.",
    skills: ["Python", "SQL", "React"],
    newSkill: "",
    stack: ["Python", "PostgreSQL", "React"],
    weeks: 10,
    milestones: [[2, "Tag 300 questions by topic"], [6, "Practice-set generator"], [10, "Trial with two classes"]],
  },
  "Cybersecurity & Blockchain": {
    title: "UPI scam message detector for first-time users",
    statement:
      "New UPI users get fake 'refund' and 'KYC' messages. Build a browser and SMS-paste checker that scores a message for scam patterns and explains why in plain words. Success: catches 90% of a labelled scam set with few false alarms.",
    skills: ["Python", "NLP"],
    newSkill: "Chrome extensions",
    stack: ["Python", "Hugging Face", "JavaScript"],
    weeks: 12,
    milestones: [[3, "Label 2,000 messages"], [7, "Classifier + explanations"], [12, "Extension with 20 testers"]],
  },
  "Smart Cities & Transport": {
    title: "Bus arrival estimates from conductor phones",
    statement:
      "City buses have no GPS boxes, so stops show no arrival times. Build an app conductors run in the background that shares location, and a page that predicts arrival at each stop. Success: estimates within 3 minutes.",
    skills: ["JavaScript", "React", "Node.js"],
    newSkill: "Leaflet maps",
    stack: ["React", "Node.js", "PostgreSQL", "Leaflet"],
    weeks: 12,
    milestones: [[2, "Ride and log two routes"], [7, "Live map + ETA model"], [12, "Two-week trial on one route"]],
  },
  "Disaster Management & Earth Sciences": {
    title: "Flood-risk alerts for low-lying wards from rainfall data",
    statement:
      "Ward officers learn about waterlogging from complaints. Build a dashboard that combines IMD rainfall and elevation data to rank wards by flood risk a day ahead. Success: matches last monsoon's complaint hotspots.",
    skills: ["Python", "Data Analysis"],
    newSkill: "GIS",
    stack: ["Python", "GeoPandas", "Streamlit"],
    weeks: 10,
    milestones: [[2, "Gather rainfall + DEM data"], [6, "Risk score per ward"], [10, "Back-test on last monsoon"]],
  },
  "Clean Energy & Environment": {
    title: "Rooftop solar estimate from a single address",
    statement:
      "Households can't tell whether rooftop solar pays off. Build a web tool that estimates roof area from satellite tiles and gives a payback period using local tariffs. Success: within 15% of installer quotes.",
    skills: ["Python", "Computer Vision", "React"],
    newSkill: "",
    stack: ["Python", "OpenCV", "React"],
    weeks: 12,
    milestones: [[3, "Roof segmentation baseline"], [8, "Payback calculator"], [12, "Compare with 10 real quotes"]],
  },
  "Governance & Legal": {
    title: "Plain-language summaries of panchayat circulars",
    statement:
      "Villagers miss scheme deadlines buried in long circulars. Build a service that summarises circulars into three lines in the local language and lists who is eligible. Success: villagers answer eligibility questions correctly.",
    skills: ["Python", "NLP", "LLMs"],
    newSkill: "",
    stack: ["Python", "Hugging Face", "FastAPI"],
    weeks: 10,
    milestones: [[2, "Collect 50 circulars"], [6, "Summary + eligibility extractor"], [10, "Test with 15 residents"]],
  },
  "Heritage & Tourism": {
    title: "Crowd forecasts for monument visiting slots",
    statement:
      "Tourists queue for hours at popular monuments on peak days. Build a forecaster using ticket counts, holidays and weather that suggests quieter slots. Success: predictions within 15% of actual footfall.",
    skills: ["Python", "Machine Learning", "SQL"],
    newSkill: "",
    stack: ["Python", "Prophet", "Next.js"],
    weeks: 8,
    milestones: [[2, "Clean three years of ticket data"], [5, "Forecast model"], [8, "Slot finder page"]],
  },
  Fintech: {
    title: "Spend categories from SMS bank alerts",
    statement:
      "Students can't see where their money goes because transactions arrive as scattered SMS. Build an offline app that parses bank SMS into categories and a monthly view. Success: 95% of messages parsed correctly.",
    skills: ["Python", "Flutter"],
    newSkill: "",
    stack: ["Flutter", "SQLite", "Python"],
    weeks: 8,
    milestones: [[2, "Collect 1,000 anonymised SMS"], [5, "Parser + categories"], [8, "App with 10 testers"]],
  },
  "Accessibility & Inclusion": {
    title: "Live captions for lectures in Indian English",
    statement:
      "Hard-of-hearing students miss parts of lectures. Build a captioning app that works on a laptop mic and handles subject terms. Success: word error rate under 15% on recorded lectures.",
    skills: ["Python", "NLP"],
    newSkill: "Speech models",
    stack: ["Python", "Whisper", "React"],
    weeks: 12,
    milestones: [[3, "Record 5 hours of lectures"], [7, "Fine-tuned captions"], [12, "Use in one course"]],
  },
  "Software Engineering & AI Tooling": {
    title: "Flaky-test finder for student GitHub repos",
    statement:
      "Teams lose hours to tests that fail at random. Build a CLI that reruns a test suite, spots flaky tests from timing and order effects, and comments on the pull request. Success: finds known flaky tests in 10 open-source repos.",
    skills: ["Python", "Docker"],
    newSkill: "GitHub Actions",
    stack: ["Python", "Docker", "GitHub Actions"],
    weeks: 10,
    milestones: [[2, "Collect 10 repos with flaky tests"], [6, "Detector + report"], [10, "Bot on real PRs"]],
  },
};
