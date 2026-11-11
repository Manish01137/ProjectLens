import type { Metadata } from "next";
import { auth } from "@/auth";
import { SettingsPanel } from "@/components/settings/settings-panel";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="text-[2.1rem] font-semibold leading-tight">Settings</h1>
      <SettingsPanel email={session?.user?.email ?? ""} />
    </div>
  );
}
