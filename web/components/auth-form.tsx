"use client";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import { loginSchema, signupSchema } from "@/lib/validators";

type Mode = "login" | "signup";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.8 3.3-8.1z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.6-2.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.1 7.1l3.6 2.8C6.6 7.4 9.1 5.4 12 5.4z" />
    </svg>
  );
}

export function AuthForm({ mode, googleEnabled }: { mode: Mode; googleEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const rawCallback = params.get("callbackUrl") ?? "";
  // Only same-origin targets are allowed (Auth.js passes an absolute URL).
  const safeCallback = () => {
    try {
      const u = new URL(rawCallback || "/chat", window.location.origin);
      return u.origin === window.location.origin ? `${u.pathname}${u.search}` : "/chat";
    } catch {
      return "/chat";
    }
  };
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // True once React has hydrated; before that a click would submit the form natively.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const parsed = (mode === "signup" ? signupSchema : loginSchema).safeParse(data);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[String(i.path[0])] ??= i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (mode === "signup") {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setFormError(j.error ?? "Could not create your account");
          return;
        }
      }
      const res = await signIn("credentials", { email: parsed.data.email, password: parsed.data.password, redirect: false });
      if (!res || res.error) {
        setFormError(
          res?.code === "rate_limited" ? "Too many attempts. Wait a minute and try again." : "That email and password don't match.",
        );
        return;
      }
      router.push(mode === "signup" ? "/onboarding" : safeCallback());
      router.refresh();
    } catch {
      setFormError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const field = (name: string, label: string, props: React.ComponentProps<"input">) => (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
        {...props}
      />
      <FieldError id={`${name}-error`}>{errors[name]}</FieldError>
    </div>
  );

  return (
    <div>
      <h1 className="text-[2rem] font-semibold leading-tight">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-2 text-muted">
        {mode === "signup" ? "Two minutes of setup, then projects that fit you." : "Sign in to pick up where you left off."}
      </p>

      {googleEnabled && (
        <>
          <Button variant="secondary" size="lg" className="mt-8 w-full" onClick={() => void signIn("google", { redirectTo: safeCallback() })}>
            <GoogleIcon /> Continue with Google
          </Button>
          <div className="my-6 flex items-center gap-3 text-[13px] text-muted">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form method="post" onSubmit={onSubmit} noValidate className={googleEnabled ? "space-y-4" : "mt-8 space-y-4"}>
        {mode === "signup" && field("name", "Name", { autoComplete: "name", placeholder: "Your full name" })}
        {field("email", "Email", { type: "email", autoComplete: "email", placeholder: "you@college.edu" })}
        {field("password", "Password", {
          type: "password",
          autoComplete: mode === "signup" ? "new-password" : "current-password",
          placeholder: mode === "signup" ? "At least 8 characters, with a number" : "",
        })}
        {formError && (
          <p role="alert" className="rounded-[10px] bg-accent-soft px-3.5 py-2.5 text-[14px] text-text">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy || !hydrated}>
          {busy && <Loader2 className="animate-spin" />}
          {mode === "signup" ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-[14px] text-muted">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-accent-ink underline-offset-4 hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to ProjectLens?{" "}
            <Link href="/signup" className="font-medium text-accent-ink underline-offset-4 hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
      {mode === "login" && (
        <p className="mt-3 text-center text-[13px] text-muted">Demo: demo@projectlens.dev / Demo@1234</p>
      )}
    </div>
  );
}
