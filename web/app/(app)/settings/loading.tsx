import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="mt-6 h-16 w-full" />
      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-56 rounded-[12px]" />
        ))}
      </div>
    </div>
  );
}
