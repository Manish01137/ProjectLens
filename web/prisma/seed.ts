// Seeds a demo student: demo@projectlens.dev / Demo@1234
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const exampleCards = [
  {
    id: "DEMO-1",
    core_problem_id: "DEMO-H-01",
    title: "Early sepsis warning from routine ward vitals",
    problem_statement:
      "District hospitals record vitals by hand every few hours, and sepsis is often recognised late. Build a system that ingests routine vitals, flags patients whose trend suggests early sepsis, and explains which readings drove the alert so nurses can act on it.",
    domain: "Healthcare",
    approach: "Machine Learning",
    project_type: "Software",
    tech_stack: "Python, scikit-learn, FastAPI, React",
    level: "Intermediate",
    duration_weeks: 12,
    matched_skills: ["Python", "Machine Learning", "React"],
    match_score: 0.74,
    source: "Demo example",
  },
];

async function main() {
  const email = "demo@projectlens.dev";
  const passwordHash = await bcrypt.hash("Demo@1234", 12);
  const user = await db.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, name: "Demo Student", passwordHash },
  });

  const profile = {
    branch: "CSE",
    semester: 7,
    skills: ["Python", "Machine Learning", "React", "SQL"],
    skillLevels: { Python: 3, "Machine Learning": 2, React: 2, SQL: 2 },
    interests: ["Healthcare", "Education"],
    level: "Intermediate",
    weeks: 12,
    teamSize: 3,
    hardwareOk: false,
    goal: "Placement",
    guidePreferences: "Our guide prefers projects with a working demo and a small dataset.",
    onboardingStep: 4,
    completedAt: new Date(),
  };
  await db.profile.upsert({ where: { userId: user.id }, update: profile, create: { userId: user.id, ...profile } });

  const existing = await db.chat.count({ where: { userId: user.id } });
  if (existing === 0) {
    await db.chat.create({
      data: {
        userId: user.id,
        title: "Healthcare project ideas",
        messages: {
          create: [
            { role: "user", content: "Suggest a healthcare project using Python", intent: "ask_project" },
            {
              role: "assistant",
              intent: "ask_project",
              content: "Here is an example of what a match looks like. Ask me for more and I'll pull fresh ideas from the model.",
              projects: exampleCards,
            },
          ],
        },
      },
    });
  }
  console.log(`Seeded demo student ${email} / Demo@1234`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
