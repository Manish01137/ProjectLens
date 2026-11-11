// Safety overrides applied AFTER the intent model (or the rules). The intent model is v1 and
// sometimes labels statements about the student as project requests, so a few unambiguous patterns
// win. Order matters: profile_update → refine_project → explain_project → chat.
import type { Intent } from "./intent";

export type OverrideContext = {
  /** The most recent assistant turn in this chat showed project cards. */
  lastTurnHadCards: boolean;
  /** Any cards were shown in this chat (needed to resolve "the second one"). */
  hasCards: boolean;
};

export type OverrideResult = { intent: Intent; rule: "profile_update" | "refine_project" | "explain_project" | "chat" } | null;

const norm = (t: string) =>
  t
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

// A request for projects. Its presence means the message is not a pure statement about the student.
const REQUEST =
  /\b(suggest|recommend|give|ideas?|show me|find me|looking for|can you)\b|\b(a|an|some|any|new|another|more|few)\s+(\w+\s+)?projects?\b|\bprojects? (on|in|for|about|using|with)\b/;

const PROFILE_STATEMENTS = [
  /\bi\s+(also\s+|now\s+|just\s+|recently\s+)?(know|learnt|learned|have learnt|have learned|picked up)\b/,
  /\bi\s+(also\s+|now\s+)?have (some |a lot of |good |prior )?experience (with|in)\b/,
  /\bmy skills (are|include)\b/,
  /\b(we|i)\s+(only\s+|now\s+|just\s+)?(have|got)\s+(only\s+|just\s+)?\d{1,2}\s*(weeks?|wks?|months?)\b/,
  /\bmy team (is|has)\b/,
  /\bwe (are|'re)\s+(a team of\s+|now\s+)?\d{1,2}\s*(people|members|students|of us)?\b/,
  /\bi('m| am)\s+(now\s+)?(a\s+|an\s+)?(complete\s+)?(beginner|intermediate|advanced)\b/,
  /\b(add|remove)\b.+\b(to|from)\s+my\s+(skills|interests)\b/,
  /\bi('m| am)\s+(not\s+)?(fine|ok|okay|comfortable|happy|good)\s+with\s+hardware\b/,
];

const REFINE_WORDS = /\b(easier|harder|simpler|more|another|other|different|instead|without|next)\b|\bshow more\b/;
const ORDINAL_REF = /\b(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th|last)\b|\b(this|that) one\b/;
const EXPLAIN_WORDS = /\b(how|explain|plan|dataset|data|build|steps?)\b/;

const GREETING_ONLY =
  /^(hi+|hello+|hey+|hiya|yo|namaste|namaskar|hola|good (morning|afternoon|evening|day)|greetings)( there| everyone| team| projectlens| buddy| friend)?[\s!.,?]*$/;
const THANKS_ONLY = /^(thanks|thank you|thx|ty|thank u|thanks a lot|thank you so much|many thanks|cheers)( so much| a lot| very much)?[\s!.,]*$/;

export function isProfileStatement(text: string): boolean {
  const t = norm(text);
  return PROFILE_STATEMENTS.some((re) => re.test(t)) && !REQUEST.test(t);
}

export function applyOverrides(text: string, ctx: OverrideContext): OverrideResult {
  const t = norm(text);
  const words = t.split(" ").filter(Boolean).length;

  if (isProfileStatement(t)) return { intent: "profile_update", rule: "profile_update" };

  // "make it easier" right after cards. A reference to one card ("more on the 2nd one") is an explain.
  if (ctx.lastTurnHadCards && words <= 6 && REFINE_WORDS.test(t) && !ORDINAL_REF.test(t))
    return { intent: "refine_project", rule: "refine_project" };

  if (ctx.hasCards && ORDINAL_REF.test(t) && EXPLAIN_WORDS.test(t)) return { intent: "explain_project", rule: "explain_project" };

  if (GREETING_ONLY.test(t)) return { intent: "greeting", rule: "chat" };
  if (THANKS_ONLY.test(t)) return { intent: "chitchat", rule: "chat" };
  return null;
}
