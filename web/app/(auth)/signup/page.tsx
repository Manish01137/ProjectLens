import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { googleEnabled } from "@/auth";

// Google sign-in appears when AUTH_GOOGLE_* are set at runtime, not just at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <Suspense>
      <AuthForm mode="signup" googleEnabled={googleEnabled} />
    </Suspense>
  );
}
