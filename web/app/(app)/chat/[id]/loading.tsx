import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[720px] space-y-6 px-4 pt-10 sm:px-6" aria-busy="true" aria-label="Loading chat">
      <Skeleton className="ml-auto h-10 w-64 rounded-[20px]" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-40 w-full rounded-[12px]" />
    </div>
  );
}
