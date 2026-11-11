import { cn } from "@/lib/utils";

export function Badge({ className, tone = "quiet", ...props }: React.ComponentProps<"span"> & { tone?: "quiet" | "accent" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-5",
        tone === "quiet" ? "bg-sunken text-muted" : "bg-accent-soft text-accent-ink",
        className,
      )}
      {...props}
    />
  );
}
