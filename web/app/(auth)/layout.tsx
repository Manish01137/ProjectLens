import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center px-4 sm:px-6">
        <Link href="/" aria-label="ProjectLens home" className="rounded-md">
          <Logo />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-[6vh] sm:pt-[10vh]">
        <div className="w-full max-w-[400px] animate-slide-up">{children}</div>
      </main>
    </div>
  );
}
