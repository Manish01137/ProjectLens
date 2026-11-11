import { describe, expect, it } from "vitest";
import { classifyIntent, resolveIntent } from "@/lib/chat/intent";

const noCards = { hasCards: false };
const cards = { hasCards: true };

describe("classifyIntent", () => {
  it.each(["hi", "Hi!", "hello", "hey there", "good evening", "namaste", "hiii"])("%s → greeting", (t) => {
    expect(classifyIntent(t, noCards).intent).toBe("greeting");
  });

  it.each(["how are you?", "thanks!", "thank you so much", "ok", "who are you", "what can you do?", "bye"])(
    "%s → chitchat",
    (t) => expect(classifyIntent(t, noCards).intent).toBe("chitchat"),
  );

  it.each([
    "what is NLP?",
    "Explain gradient descent",
    "What's the difference between SQL and MongoDB?",
    "how does a transformer work",
    "should I learn Docker before Kubernetes?",
  ])("%s → general_question", (t) => expect(classifyIntent(t, noCards).intent).toBe("general_question"));

  it.each([
    "suggest a healthcare project",
    "suggest a project",
    "give me some project ideas",
    "I need a final year project using Python",
    "hi, can you recommend a project in agriculture?",
    "what should I build for my final year?",
    "project ideas",
  ])("%s → ask_project", (t) => expect(classifyIntent(t, noCards).intent).toBe("ask_project"));

  it.each(["make it easier", "something in agriculture", "use Flutter instead", "show me different ones", "harder please", "without hardware"])(
    "%s (after cards) → refine_project",
    (t) => expect(classifyIntent(t, cards).intent).toBe("refine_project"),
  );

  it.each(["explain the second one", "how do I build the second one?", "tell me more about #3", "the first one", "walk me through the last one"])(
    "%s (after cards) → explain_project",
    (t) => expect(classifyIntent(t, cards).intent).toBe("explain_project"),
  );

  it.each(["I also know Docker now", "I only have 8 weeks", "I learned Flutter", "we are 4 people now", "I'm now interested in fintech"])(
    "%s → profile_update",
    (t) => expect(classifyIntent(t, noCards).intent).toBe("profile_update"),
  );
});

describe("resolveIntent", () => {
  it("uses the model when it answers confidently", () => {
    expect(resolveIntent("hi", noCards, { intent: "ask_project", confidence: 0.93 })).toMatchObject({
      intent: "ask_project",
      source: "model",
    });
  });
  it("treats low confidence as a general question", () => {
    expect(resolveIntent("hmm what", noCards, { intent: "ask_project", confidence: 0.4 }).intent).toBe("general_question");
  });
  it("falls back to rules when the model is unavailable (null) or answers an unknown label", () => {
    expect(resolveIntent("hi", noCards, null)).toMatchObject({ intent: "greeting", source: "rules" });
    expect(resolveIntent("hi", noCards, { intent: "weather", confidence: 0.99 }).source).toBe("rules");
  });
  it("turns follow-ups without cards into fresh requests or questions", () => {
    expect(resolveIntent("make it easier", noCards, { intent: "refine_project", confidence: 0.9 }).intent).toBe("ask_project");
    expect(resolveIntent("explain the second one", noCards, null).intent).toBe("general_question");
  });
});
