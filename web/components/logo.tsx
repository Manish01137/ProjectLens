import { cn } from "@/lib/utils";

/** ProjectLens mark: a lens with a focal point. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <circle cx="14.5" cy="14.5" r="6.5" fill="none" stroke="var(--page)" strokeWidth="2.6" />
      <path d="M19.4 19.4 24 24" stroke="var(--page)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="14.5" cy="14.5" r="2" fill="var(--page)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="font-serif text-[1.15rem] font-semibold tracking-tight">ProjectLens</span>
    </span>
  );
}
