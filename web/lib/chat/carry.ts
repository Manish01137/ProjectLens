// Context carry-over: the filters last applied in a conversation are sent again on a refinement,
// merged with whatever the new message adds. "healthcare projects" → "make it easier" stays
// Healthcare, now at Beginner level.
import { DOMAINS, LEVELS, type Level } from "../constants";
import type { AppliedFilters } from "../validators";
import { findDomains, findWeeks } from "./understand";

export type CarriedFilters = {
  domains: string[];
  approaches: string[];
  levels: string[];
  weeks: number | null;
  hardware_ok: boolean | null;
};

/** What a message asks for (same shape as the ML service's /understand). */
export type Wish = {
  domains: string[];
  approaches: string[];
  levels: string[] | null;
  weeks: number | null;
  hardware_ok: boolean | null;
};

export const EMPTY_FILTERS: CarriedFilters = { domains: [], approaches: [], levels: [], weeks: null, hardware_ok: null };

export function fromApplied(a: AppliedFilters | null | undefined): CarriedFilters | null {
  if (!a) return null;
  return {
    domains: a.domains.filter((d) => (DOMAINS as readonly string[]).includes(d)),
    approaches: a.approaches,
    levels: a.levels,
    weeks: a.weeks,
    hardware_ok: a.hardware_ok,
  };
}

const ANY_DOMAIN = /\b(any|all|every|whichever)\s+(domains?|fields?|areas?|sectors?|topics?)\b|\bany domain\b/i;

export function mergeFilters(prev: CarriedFilters | null, wish: Wish, text: string): CarriedFilters {
  const p = prev ?? EMPTY_FILTERS;
  return {
    // A new domain replaces the old one; "any domain" clears it.
    domains: ANY_DOMAIN.test(text) ? [] : wish.domains.length ? wish.domains : p.domains,
    approaches: wish.approaches.length ? wish.approaches : p.approaches,
    levels: wish.levels?.length ? wish.levels : p.levels,
    weeks: wish.weeks ?? p.weeks,
    hardware_ok: wish.hardware_ok ?? p.hardware_ok,
  };
}

/** The current difficulty the conversation is at, so "easier" steps down from there. */
export function currentLevel(prev: CarriedFilters | null, profileLevel: Level): Level {
  const l = prev?.levels?.[0];
  return (LEVELS as readonly string[]).includes(l ?? "") ? (l as Level) : profileLevel;
}

/** Local stand-in for /understand when the ML service can't be asked (mirrors ranking.py's rules). */
export function understandLocally(text: string, level: Level): Wish {
  const t = text.toLowerCase();
  const i = LEVELS.indexOf(level);
  let levels: string[] | null = null;
  if (/\b(easier|easy|simpler|simple|beginner|basic|less complex|not too hard|lighter)\b/.test(t))
    levels = LEVELS.slice(0, Math.max(i, 1));
  else if (/\b(harder|hard|advanced|challenging|complex|tougher|more difficult)\b/.test(t)) levels = LEVELS.slice(Math.min(i + 1, 2));
  const weeks = findWeeks(text);
  const noHw = /\b(no hardware|without hardware|software only|software-only|only software|no iot)\b/.test(t);
  return { domains: findDomains(text), approaches: [], levels, weeks, hardware_ok: noHw ? false : null };
}
