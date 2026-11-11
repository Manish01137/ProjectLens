import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  Bookmark,
  Brain,
  CalendarRange,
  Check,
  ChevronDown,
  Compass,
  FileDown,
  Layers,
  Lightbulb,
  Mic,
  Repeat2,
  Sparkles,
  Type,
  WandSparkles,
} from "lucide-react";
import { auth } from "@/auth";
import { DomainIcon } from "@/components/domain-icon";
import { TryIt } from "@/components/landing/try-it";
import { Logo, LogoMark } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { DOMAINS } from "@/lib/constants";
import { cn } from "@/lib/utils";

// ── Product preview (decorative, mirrors the real chat UI) ────────────────────────────────────
function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[960px]">
      {/* floating annotations that point at real features */}
      <div aria-hidden="true" className="float-slow absolute -left-28 top-28 z-10 hidden rounded-[12px] border border-border bg-surface/90 px-3 py-2 text-[12px] shadow-[var(--shadow-float)] backdrop-blur xl:block">
        <p className="font-medium">Understood your intent</p>
        <p className="text-muted">ask_project · Healthcare</p>
      </div>
      <div aria-hidden="true" className="float-slow absolute -right-28 top-72 z-10 hidden rounded-[12px] border border-border bg-surface/90 px-3 py-2 text-[12px] shadow-[var(--shadow-float)] backdrop-blur xl:block" style={{ animationDelay: "-3s" }}>
        <p className="flex items-center gap-1.5 font-medium">
          <Check className="size-3.5 text-success" /> Novelty check passed
        </p>
        <p className="text-muted">0.71 similarity, limit 0.85</p>
      </div>

      <div
        role="img"
        aria-label="Preview of the ProjectLens assistant suggesting a new healthcare project idea"
        className="tilt relative overflow-hidden rounded-[20px] border border-border bg-page shadow-[0_40px_80px_-40px_rgb(31_30_29/0.45)]"
      >
        <div aria-hidden="true" className="flex h-9 items-center gap-1.5 border-b border-border bg-sunken/60 px-4">
          <span className="size-2.5 rounded-full bg-[#e8766a]" />
          <span className="size-2.5 rounded-full bg-[#e9b65a]" />
          <span className="size-2.5 rounded-full bg-[#8cc07e]" />
          <span className="mx-auto rounded-md bg-surface px-3 py-0.5 text-[11px] text-muted">projectlens.app/chat</span>
        </div>
        <div aria-hidden="true" className="flex">
          <div className="hidden w-52 shrink-0 border-r border-border p-3 md:block">
            <div className="flex items-center gap-2 px-1 pb-4">
              <LogoMark className="size-5" />
              <span className="font-serif text-[13px] font-semibold">ProjectLens</span>
            </div>
            <div className="mb-3 flex h-7 items-center gap-2 rounded-lg px-2 text-[11.5px] font-medium text-accent-ink">
              <span className="flex size-4 items-center justify-center rounded-full bg-accent-ink text-[9px] text-accent-fg">+</span> New chat
            </div>
            <p className="px-2 pb-1.5 text-[10px] text-muted">Today</p>
            {["Healthcare project ideas", "Plan for idea #2", "What is RAG?"].map((t, i) => (
              <p key={t} className={cn("truncate rounded-md px-2 py-1 text-[11.5px]", i === 0 ? "bg-sunken" : "text-muted")}>
                {t}
              </p>
            ))}
          </div>
          <div className="min-w-0 flex-1 px-4 py-5 sm:px-8">
            <div className="ml-auto w-fit max-w-[80%] rounded-[18px] bg-sunken px-4 py-2 text-[13px]">Suggest a healthcare project</div>
            <div className="mt-4 flex gap-2.5">
              <LogoMark className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-serif text-[14px] leading-relaxed">
                  Here are 3 new ideas built around your Python and React skills, each grounded in a real project from the
                  catalogue.
                </p>
                <p className="mt-2 text-[11.5px] text-muted">
                  Showing <strong className="text-text">Healthcare</strong> · Intermediate
                </p>
                <div className="mt-2 rounded-[12px] border border-border bg-surface p-3.5">
                  <div className="flex flex-wrap gap-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-px text-[10px] font-medium text-accent-ink">
                      <Sparkles className="size-2.5" /> New idea
                    </span>
                    {["Healthcare", "Web App", "12 weeks"].map((m) => (
                      <span key={m} className="rounded-full bg-sunken px-2 py-px text-[10px] text-muted">
                        {m}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 font-serif text-[15px] font-semibold leading-snug">Missed-dose alerts for TB patients in tier-2 towns</p>
                  <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-muted">
                    ASHA workers track TB medication by phone calls and paper. Build a web app that flags patients likely to miss
                    doses, so workers visit them first.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                    {["Python", "Machine Learning", "React"].map((s) => (
                      <span key={s} className="rounded-full bg-accent-soft px-2 py-px font-medium text-accent-ink">
                        {s}
                      </span>
                    ))}
                    <span className="rounded-full border border-dashed border-border-strong px-2 py-px">New skill: FastAPI</span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                    {["W2 · Interview users", "W6 · Risk model", "W12 · Pilot"].map((m) => (
                      <span key={m} className="rounded-md border border-border bg-page px-2 py-1 text-[10px] text-muted">
                        {m}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2.5 flex gap-3 text-[10.5px] text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Bookmark className="size-3" /> Save
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Type className="size-3" /> Plain words
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Lightbulb className="size-3" /> Explain this
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["Make it easier", "Only 8 weeks", "How do I build #1?"].map((c) => (
                    <span key={c} className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px]">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2 rounded-[22px] border border-border bg-surface px-4 py-2.5 shadow-sm">
              <span className="flex-1 text-[12.5px] text-muted">Make it easier, or explain the second one…</span>
              <Mic className="size-3.5 text-muted" />
              <span className="flex size-7 items-center justify-center rounded-full bg-accent-ink text-accent-fg">
                <ArrowUp className="size-3.5" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────────────────────
const STATS = [
  { value: "50,000", label: "real problem statements indexed" },
  { value: "461", label: "distinct core problems" },
  { value: "12", label: "domains, from Healthcare to Fintech" },
  { value: "3", label: "AI models working together" },
];

const STEPS = [
  {
    n: "01",
    icon: Compass,
    title: "Tell us what you know",
    text: "Branch, skills with a quick self-rating, the domains you care about and the weeks you really have. Two minutes.",
  },
  {
    n: "02",
    icon: Sparkles,
    title: "Get ideas written for you",
    text: "New problem statements grounded in real projects, checked for your skills, your timeline and originality.",
  },
  {
    n: "03",
    icon: CalendarRange,
    title: "Turn one into a plan",
    text: "Ask how to build it and get a week-by-week plan, the skills to learn and what to do this week.",
  },
];

const MODELS = [
  {
    icon: Brain,
    tag: "Model 1",
    title: "Understands what you mean",
    text: "A fine-tuned intent classifier tells a greeting from a question from a project request. Saying hi never gets you a wall of cards.",
    visual: (
      <div className="space-y-1.5 text-[12px]">
        {[
          ["“hi!”", "greeting"],
          ["“what is RAG?”", "question"],
          ["“make it easier”", "refine"],
        ].map(([q, l]) => (
          <div key={q} className="flex items-center justify-between rounded-lg border border-border bg-page px-2.5 py-1.5">
            <span className="text-muted">{q}</span>
            <span className="rounded-full bg-accent-soft px-2 py-px font-medium text-accent-ink">{l}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Layers,
    tag: "Model 2",
    title: "Finds what truly fits",
    text: "A retriever trained on 50,000 statements ranks projects by your skills and interests, then spreads them out so no two ideas feel the same.",
    visual: (
      <div className="space-y-2 text-[12px]">
        {[
          ["Healthcare · ML", 92],
          ["Education · Web", 81],
          ["Healthcare · Mobile", 74],
        ].map(([l, v]) => (
          <div key={l as string}>
            <div className="mb-1 flex justify-between text-muted">
              <span>{l}</span>
              <span>{v}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-sunken">
              <div className="h-full rounded-full bg-accent" style={{ width: `${v}%` }} />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: WandSparkles,
    tag: "Model 3",
    title: "Writes something new",
    text: "A language model writes fresh ideas from the best matches. Each one must pass four checks: format, your skills, your weeks and originality.",
    visual: (
      <div className="grid grid-cols-2 gap-1.5 text-[12px]">
        {["Format", "Your skills", "Fits 12 weeks", "Not a copy"].map((c) => (
          <span key={c} className="flex items-center gap-1.5 rounded-lg border border-border bg-page px-2.5 py-1.5">
            <Check className="size-3.5 text-success" /> {c}
          </span>
        ))}
      </div>
    ),
  },
];

const FEATURES = [
  { icon: CalendarRange, title: "Week-by-week plans", text: "Milestones sized to the weeks you actually have, with first steps for this week." },
  { icon: Repeat2, title: "Never the same idea twice", text: "Everything you've seen is remembered, so “show me different ones” always means different." },
  { icon: Bookmark, title: "A board for your guide", text: "Shortlist, discuss, choose. Drag ideas between columns and keep notes for your guide meeting." },
  { icon: Type, title: "Rewrite in plain words", text: "Turn any dense problem statement into two clear sentences, without losing the facts." },
  { icon: FileDown, title: "Download as PDF", text: "Take a project brief with its plan to your guide, printed or on your phone." },
  { icon: Mic, title: "Talk or type", text: "Ask by voice in the chat, and steer ideas with quick filters for domain, level and weeks." },
];

const FAQ = [
  ["Is ProjectLens free?", "Yes, for students. Sign up with your email and start in two minutes."],
  [
    "Are the ideas copied from somewhere?",
    "No. New ideas are written for you and must pass an originality check: if one is too close to any of 50,000 known projects, it is rewritten or dropped. When the writer is busy, you see the closest catalogue projects instead, clearly labelled.",
  ],
  ["I only have 8 weeks. Will it still work?", "Yes. Your weeks are a hard limit: plans end within them, and longer projects are filtered out."],
  ["I don't want hardware projects.", "Turn hardware off in your profile and you'll only get software projects. Say “something with sensors” any time to change your mind."],
  ["What happens to my data?", "Your profile, chats and saved projects stay in your account. You can delete everything from Settings at any time."],
];

export default async function Landing() {
  const session = await auth();
  const loggedIn = Boolean(session?.user);
  const cta = loggedIn ? "/chat" : "/signup";

  return (
    <div className="min-h-dvh overflow-x-clip">
      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-transparent bg-page/70 backdrop-blur-xl supports-[backdrop-filter]:bg-page/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="ProjectLens home" className="rounded-md">
            <Logo />
          </Link>
          <nav aria-label="Sections" className="hidden items-center gap-7 text-[14px] text-muted md:flex">
            <a href="#how" className="hover:text-text">
              How it works
            </a>
            <a href="#models" className="hover:text-text">
              The models
            </a>
            <a href="#try" className="hover:text-text">
              Try it
            </a>
            <a href="#faq" className="hover:text-text">
              FAQ
            </a>
          </nav>
          <nav className="flex items-center gap-1" aria-label="Account">
            {loggedIn ? (
              <Link href="/chat" className={buttonVariants({ size: "sm" })}>
                Open ProjectLens <ArrowRight />
              </Link>
            ) : (
              <>
                <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Sign in
                </Link>
                <Link href="/signup" className={buttonVariants({ size: "sm" })}>
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="grain relative isolate">
          <div className="aurora -z-10" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="mx-auto max-w-4xl px-4 pb-14 pt-16 text-center sm:px-6 sm:pt-24">
            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3.5 py-1.5 text-[13px] text-text/85 shadow-sm backdrop-blur">
              <span className="flex size-5 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                <Sparkles className="size-3" aria-hidden="true" />
              </span>
              For final-year B.Tech students<span className="hidden sm:inline"> · 3 AI models, one assistant</span>
            </p>
            <h1 className="mx-auto mt-7 max-w-3xl text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-[4.4rem]">
              Find a final-year project that <em className="text-gradient font-semibold not-italic sm:italic">actually fits you</em>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-muted sm:text-[18px]">
              ProjectLens writes project ideas around your skills, your interests and the weeks you really have, then helps
              you plan the build, one week at a time.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href={cta} className={cn(buttonVariants({ size: "lg" }), "h-12 px-7 shadow-[0_12px_30px_-12px_var(--accent)]")}>
                {loggedIn ? "Continue to ProjectLens" : "Find my project"} <ArrowRight />
              </Link>
              <a href="#try" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "h-12 px-6 bg-surface/80 backdrop-blur")}>
                See an example
              </a>
            </div>
            <p className="mt-5 text-[13px] text-muted">Free for students · 2-minute setup · Works on your phone</p>
          </div>
          <div className="px-4 pb-20 sm:px-6">
            <ProductPreview />
          </div>
        </section>

        {/* Real numbers */}
        <section aria-label="ProjectLens in numbers" className="border-y border-border bg-surface/60">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-y-8 px-4 py-10 sm:px-6 md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-serif text-[2.2rem] font-semibold leading-none tracking-tight sm:text-[2.6rem]">{s.value}</dd>
                <dd className="mx-auto mt-2 max-w-[14rem] text-[13.5px] text-muted">{s.label}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Domains marquee */}
        <section aria-label="Domains" className="py-12">
          <p className="mb-6 text-center text-[13px] font-medium uppercase tracking-[0.14em] text-muted">Ideas across 12 domains</p>
          <div className="marquee overflow-hidden">
            <ul className="marquee-track">
              {[...DOMAINS, ...DOMAINS].map((d, i) => (
                <li
                  key={`${d}-${i}`}
                  aria-hidden={i >= DOMAINS.length || undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-[14px]",
                    i >= DOMAINS.length && "marquee-dup",
                  )}
                >
                  <DomainIcon domain={d} className="size-4 text-accent-ink" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section id="how" aria-labelledby="how-title" className="scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <p className="text-center text-[13px] font-medium uppercase tracking-[0.14em] text-accent-ink">How it works</p>
            <h2 id="how-title" className="mx-auto mt-3 max-w-2xl text-center text-[2rem] font-semibold leading-tight sm:text-[2.6rem]">
              From “I have no idea” to a plan in three steps
            </h2>
            <ol className="relative mt-14 grid gap-6 md:grid-cols-3">
              <span aria-hidden="true" className="absolute left-[16%] right-[16%] top-7 hidden h-px bg-gradient-to-r from-transparent via-border-strong to-transparent md:block" />
              {STEPS.map((s) => (
                <li key={s.n} className="glow-card relative rounded-[18px] border border-border bg-surface p-7">
                  <div className="flex items-center justify-between">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink">
                      <s.icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="font-serif text-[2rem] font-semibold text-muted" aria-hidden="true">{s.n}</span>
                  </div>
                  <h3 className="mt-6 text-[1.3rem] font-semibold">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* The three models */}
        <section id="models" aria-labelledby="models-title" className="dot-grid scroll-mt-20 border-y border-border px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <p className="text-center text-[13px] font-medium uppercase tracking-[0.14em] text-accent-ink">Under the hood</p>
            <h2 id="models-title" className="mx-auto mt-3 max-w-2xl text-center text-[2rem] font-semibold leading-tight sm:text-[2.6rem]">
              Three models, one calm assistant
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-[16px] text-muted">
              Each model does one job well, and the assistant only shows you projects when you ask for them.
            </p>
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {MODELS.map((m) => (
                <article key={m.tag} className="glow-card flex flex-col rounded-[18px] border border-border bg-surface p-6">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-accent-ink text-accent-fg">
                      <m.icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="text-[12px] font-medium uppercase tracking-wide text-muted">{m.tag}</span>
                  </div>
                  <h3 className="mt-5 text-[1.3rem] font-semibold">{m.title}</h3>
                  <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted">{m.text}</p>
                  <div className="mt-6 rounded-[14px] border border-border bg-sunken/50 p-3" aria-hidden="true">
                    {m.visual}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Try it */}
        <section id="try" aria-label="Try an example" className="scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <TryIt />
          </div>
        </section>

        {/* Features */}
        <section aria-labelledby="features-title" className="border-t border-border bg-surface/60 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h2 id="features-title" className="max-w-xl text-[2rem] font-semibold leading-tight sm:text-[2.4rem]">
              Everything your final year needs, nothing it doesn&apos;t
            </h2>
            <ul className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-page text-accent-ink">
                    <f.icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-sans text-[16px] font-semibold tracking-normal">{f.title}</h3>
                    <p className="mt-1 text-[14.5px] leading-relaxed text-muted">{f.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <h2 id="faq-title" className="text-center text-[2rem] font-semibold sm:text-[2.4rem]">
              Questions students ask
            </h2>
            <div className="mt-10 divide-y divide-border rounded-[18px] border border-border bg-surface">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group px-6 py-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[16px] font-medium [&::-webkit-details-marker]:hidden">
                    {q}
                    <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="pb-5 text-[15px] leading-relaxed text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="px-4 pb-20 sm:px-6">
          <div
            className="grain relative isolate mx-auto max-w-6xl overflow-hidden rounded-[28px] px-6 py-16 text-center text-[#f5f4ef] dark:ring-1 dark:ring-border sm:px-12"
            style={{
              background:
                "radial-gradient(90% 120% at 12% -10%, rgb(201 100 66 / 0.42) 0%, rgb(201 100 66 / 0.14) 40%, transparent 72%), radial-gradient(80% 110% at 95% 115%, rgb(216 137 74 / 0.3) 0%, rgb(216 137 74 / 0.08) 45%, transparent 75%), #1f1e1d",
            }}
          >
            <h2 className="mx-auto max-w-2xl text-[2rem] font-semibold leading-tight text-[#f5f4ef] sm:text-[2.8rem]">
              Your final year deserves a project you&apos;re proud of
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[16px] text-[#e4e1d8]">Two minutes to set up. Your first ideas arrive right after.</p>
            <Link
              href={cta}
              className="mt-8 inline-flex h-12 items-center gap-2 rounded-[12px] bg-[#f5f4ef] px-7 text-[15px] font-medium text-[#1f1e1d] transition hover:bg-white focus-visible:outline-[#f5f4ef]"
            >
              {loggedIn ? "Continue to ProjectLens" : "Get started, it's free"} <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-[13px] text-muted sm:flex-row">
          <div className="flex items-center gap-3">
            <Logo className="scale-90" />
            <span className="hidden sm:inline">·</span>
            <span>Discovering Projects That Truly Fit</span>
          </div>
          <nav aria-label="Footer" className="flex gap-5">
            <a href="#how" className="hover:text-text">
              How it works
            </a>
            <a href="#faq" className="hover:text-text">
              FAQ
            </a>
            <Link href="/login" className="hover:text-text">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-text">
              Sign up
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
