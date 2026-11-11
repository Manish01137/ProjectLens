import { applyOverrides, type OverrideContext } from "./overrides";

// Rule-based intent classifier. It sits behind the same interface as the ML service's /intent
// (DistilBERT, planned) and is used whenever that endpoint is unavailable (501) or unsure.

export const INTENTS = [
  "greeting",
  "chitchat",
  "general_question",
  "ask_project",
  "refine_project",
  "explain_project",
  "profile_update",
] as const;
export type Intent = (typeof INTENTS)[number];
export type IntentResult = { intent: Intent; confidence: number; source: "model" | "rules" };
export type IntentContext = { hasCards: boolean };

export const MIN_CONFIDENCE = 0.6;

const norm = (t: string) =>
  t
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^\p{L}\p{N}#+.' ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const GREETING = /^(hi+|hello+|hey+|hiya|yo|namaste|namaskar|hola|good (morning|afternoon|evening|day)|greetings|sup|what's up|wassup)( there| everyone| team| projectlens| buddy| friend)?$/;
const CHITCHAT = [
  /^how (are|r) (you|u)( doing)?( today)?$/,
  /^how's it going$/,
  /^(thanks|thank you|thx|ty|thank u)( so much| a lot| very much)?$/,
  /^(ok|okay|cool|nice|great|awesome|got it|alright|fine|sure|hmm+|lol|haha+|perfect|wow)$/,
  /^(bye|goodbye|see you|see ya|good night|later|cya)( later)?$/,
  /^who (are|r) (you|u)$/,
  /^what('s| is) your name$/,
  /^what can you do$/,
  /^(are you|r u) (a bot|an ai|human|real)$/,
  /^(i'm|i am) (good|fine|great|ok|okay|tired|bored|stressed)$/,
];

const PROJECT_NOUN = /\b(projects?|ideas?|topics?|problem statements?|capstone|final.?year|major project|mini project|something to build)\b/;
const ASK_VERB =
  /\b(suggest|recommend|give|show|find|get|need|want|looking for|help me (pick|choose|find)|ideas? for|any|some|share|list|propose|what should i (build|make|do))\b/;

const ORDINAL =
  /\b(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th|last|number [1-5]|no\.? ?[1-5]|option [1-5]|card [1-5]|project [1-5]|idea [1-5]|one|this|that|it)\b|#\s?[1-5]\b/;
const EXPLAIN_VERB =
  /\b(explain|elaborate|tell me (more )?about|more (details|info) (on|about)|how (do|would|can|should) i (build|make|start|implement|do|approach)|how to (build|make|start|implement)|plan for|break( it)? down|roadmap|steps (for|to)|walk me through|details of|deep dive)\b/;

const REFINE =
  /\b(easier|simpler|harder|tougher|more (advanced|challenging|difficult|complex|practical|innovative)|less (complex|difficult|hardware)|beginner.?friendly|shorter|longer|smaller|bigger|instead|something else|different (ones?|projects?|ideas?)|other (ones?|options|ideas)|another (one|idea|project)|more like (this|that|the)|similar|show more|more options|more ideas|not (these|this)|without hardware|no hardware|software only|with (hardware|iot)|using \w+|in \w+ (instead|domain)|swap|change (it|them|the domain)|make (it|them) |any (domain|field|area|sector)s?)\b/;

const PROFILE_UPDATE = [
  /\bi (also |now |just )?(know|learned|learnt|picked up|am good at|can use|have learned|have learnt)\b/,
  /\b(add|remove)\b.*\b(to|from) my (skills|profile|interests)\b/,
  /\bi (only )?have (only )?\d{1,2} weeks?\b/,
  /\b(we|i) (now )?have \d{1,2} weeks?\b/,
  /\bonly \d{1,2} weeks? (left|remaining)\b/,
  /\b(change|set|update|switch) my (level|weeks|skills|interests|goal|team( size)?|branch|semester)\b/,
  /\bmy team (is|has) (now )?\d\b/,
  /\bwe are (a team of )?\d (people|members|of us)\b/,
  /\bi('m| am) (now )?(an? )?(beginner|intermediate|advanced)\b/,
  /\bi can('t|not| not)? (use|work with|buy) (hardware|arduino|sensors)\b/,
  /\bi('m| am) (now )?(also )?interested in\b/,
  /\bmy (goal|aim) is (now )?\b/,
];

const QUESTION_START =
  /^(what|whats|what's|why|how|when|where|which|who|is|are|can|could|should|does|do|explain|define|difference|compare|tell me)\b/;

export function classifyIntent(text: string, ctx: IntentContext = { hasCards: false }): IntentResult {
  const t = norm(text);
  const r = (intent: Intent, confidence: number): IntentResult => ({ intent, confidence, source: "rules" });
  if (!t) return r("chitchat", 0.7);

  const words = t.split(" ").length;
  const stripped = t.replace(/[.!?]+$/, "");

  if (GREETING.test(stripped)) return r("greeting", 0.95);
  // "hi, suggest a project" is a request, not a greeting
  const greetingPrefix = /^(hi+|hello+|hey+|namaste)\b[ ,!]*/;
  const body = stripped.replace(greetingPrefix, "").trim();
  if (CHITCHAT.some((re) => re.test(body))) return r("chitchat", 0.9);

  if (PROFILE_UPDATE.some((re) => re.test(body))) return r("profile_update", 0.85);

  if (ctx.hasCards && ORDINAL.test(body) && EXPLAIN_VERB.test(body)) return r("explain_project", 0.92);
  if (ctx.hasCards && /^(the )?(first|second|third|fourth|fifth|last|1st|2nd|3rd|4th|5th) one\??$/.test(body))
    return r("explain_project", 0.8);
  if (ctx.hasCards && /^(how (do|would|can) i (build|start|make|do) (it|this|that))\b/.test(body))
    return r("explain_project", 0.85);

  const asksProject = PROJECT_NOUN.test(body) && (ASK_VERB.test(body) || words <= 4);
  if (ctx.hasCards && REFINE.test(body)) return r("refine_project", asksProject ? 0.85 : 0.88);
  if (ctx.hasCards && /^(something|anything|maybe|what about|how about|try|rather|preferably)\b/.test(body) && words <= 8)
    return r("refine_project", 0.8);
  if (asksProject && !/^(what|why) (is|are) (a )?(capstone|final.?year project|major project)\b/.test(body))
    return r("ask_project", 0.9);
  if (/\bwhat should i (build|make|work on)\b/.test(body)) return r("ask_project", 0.8);
  if (!ctx.hasCards && /\b(easier|different|another|more) (ones?|projects?|ideas?)\b/.test(body)) return r("ask_project", 0.75);

  if (QUESTION_START.test(body) || body.endsWith("?") || /\?$/.test(text.trim())) return r("general_question", 0.8);
  if (words <= 2) return r("chitchat", 0.6);
  return r("general_question", 0.6);
}

/** Model first (when it answers), rules otherwise; low confidence becomes general_question. */
export function resolveIntent(
  text: string,
  ctx: IntentContext,
  remote: { intent: string; confidence: number } | null,
): IntentResult {
  let res: IntentResult;
  if (remote && (INTENTS as readonly string[]).includes(remote.intent)) {
    res = { intent: remote.intent as Intent, confidence: remote.confidence, source: "model" };
  } else {
    res = classifyIntent(text, ctx);
  }
  if (res.confidence < MIN_CONFIDENCE) res = { ...res, intent: "general_question" };
  // Follow-ups only make sense when this chat has shown cards.
  if (!ctx.hasCards && res.intent === "refine_project") res = { ...res, intent: "ask_project" };
  if (!ctx.hasCards && res.intent === "explain_project") res = { ...res, intent: "general_question" };
  return res;
}

// ── Final decision: model (or rules), then the safety overrides, then context checks ───────────
export type IntentDecision = IntentResult & { override: string | null };

/**
 * 1. /intent's `intent` (already general_question below 0.6) or, on 501/error, the rules.
 * 2. Safety overrides (profile statement, short refinement, card reference, greeting/thanks).
 * 3. Follow-ups without cards become a fresh request / a question.
 */
export function decideIntent(
  text: string,
  ctx: OverrideContext,
  remote: { intent: string; confidence: number } | null,
): IntentDecision {
  let res: IntentResult;
  if (remote && (INTENTS as readonly string[]).includes(remote.intent)) {
    res = { intent: remote.intent as Intent, confidence: remote.confidence, source: "model" };
  } else {
    res = classifyIntent(text, { hasCards: ctx.hasCards });
    if (res.confidence < MIN_CONFIDENCE) res = { ...res, intent: "general_question" };
  }
  const o = applyOverrides(text, ctx);
  let decision: IntentDecision = { ...res, override: null };
  if (o && o.intent !== res.intent) decision = { intent: o.intent, confidence: 0.95, source: "rules", override: o.rule };
  if (!ctx.hasCards && decision.intent === "refine_project") decision = { ...decision, intent: "ask_project" };
  if (!ctx.hasCards && decision.intent === "explain_project") decision = { ...decision, intent: "general_question" };
  return decision;
}
