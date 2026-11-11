import { NextResponse } from "next/server";
import { withUser } from "@/lib/api";
import { db } from "@/lib/db";
import { llmStatus } from "@/lib/llm";
import * as ml from "@/lib/ml";

// Database, retriever (model 2), intent model (model 1) and LLM (model 3 + chat replies).
// Drives the status dot in the sidebar footer.
export const GET = withUser(async () => {
  const [database, mlHealth, llm] = await Promise.all([
    db.$queryRaw`SELECT 1`.then(
      () => ({ ok: true, detail: "Connected" }),
      () => ({ ok: false, detail: "Database unreachable" }),
    ),
    ml.health().catch(() => null),
    llmStatus(),
  ]);
  const retriever = mlHealth
    ? {
        ok: mlHealth.status === "ok",
        detail:
          mlHealth.status === "ok" ? `${mlHealth.projects_indexed.toLocaleString("en-IN")} projects indexed` : (mlHealth.message ?? mlHealth.status),
      }
    : { ok: false, detail: "ML service unreachable" };
  const intent = mlHealth?.intent_model
    ? { ok: true, detail: `DistilBERT ${mlHealth.intent_version ?? ""}`.trim() }
    : { ok: false, detail: mlHealth ? "Not installed: using rules" : "ML service unreachable" };
  // The intent model and the LLM have fallbacks (rules, catalogue cards, templates), so they only degrade.
  const status = database.ok && retriever.ok ? (llm.ok && intent.ok ? "ok" : "degraded") : "down";
  return NextResponse.json({ status, database, retriever, intent, llm, ml: retriever });
});
