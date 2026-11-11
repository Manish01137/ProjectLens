import { signOut } from "@/auth";

// Clears a session whose user no longer exists (for example after the account was deleted).
export async function GET() {
  await signOut({ redirectTo: "/login" });
}
