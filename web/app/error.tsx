"use client";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-[2rem] font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-muted">This page hit an unexpected problem. Your data is safe. Try again in a moment.</p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
