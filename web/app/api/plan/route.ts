import { NextResponse } from "next/server";
import { withUser, parseBody } from "@/lib/api";
import { explainInstruction, systemPrompt } from "@/lib/chat/prompts";
import { loadChatProfile } from "@/lib/chat/deps";
import { completeText } from "@/lib/llm";
import { buildPlanOutline, planToMarkdown } from "@/lib/plan";
import { planBodySchema } from "@/lib/validators";
import { auth } from "@/auth";

// Week-by-week plan for the project detail panel, generated on demand.
export const POST = withUser(async ({ req, userId }) => {
  const { project } = await parseBody(req, planBodySchema);
  const session = await auth();
  const profile = await loadChatProfile(userId, session?.user?.name);
  const p = profile ?? { name: "there", branch: null, semester: null, skills: [], interests: [], level: "Intermediate" as const, weeks: 12, hardwareOk: false, goal: "Placement" };
  const outline = buildPlanOutline(project, p);
  let markdown = planToMarkdown(project, outline);
  let generated = false;
  try {
    const text = await completeText({
      system: systemPrompt(p),
      messages: [{ role: "user", content: explainInstruction(project, outline, 0).replace("project #1 from the cards shown earlier", "this project") }],
      maxTokens: 900,
      signal: AbortSignal.timeout(60_000),
    });
    if (text.trim().length > 80) {
      markdown = text.trim();
      generated = true;
    }
  } catch {
    /* the structured template above is a good plan on its own */
  }
  return NextResponse.json({ markdown, outline, generated });
});
