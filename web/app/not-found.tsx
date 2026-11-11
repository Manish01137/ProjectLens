import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-4 text-center">
      <p className="text-[13px] font-medium text-accent-ink">404</p>
      <h1 className="mt-2 text-[2rem] font-semibold">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-muted">It may have been deleted, or the link is wrong.</p>
      <Link href="/chat" className={buttonVariants({ className: "mt-6" })}>
        Back to ProjectLens
      </Link>
    </div>
  );
}
