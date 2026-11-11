"use client";
import { useState } from "react";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { Monitor, Moon, Sun, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { cn, fetchJson } from "@/lib/utils";

export function SettingsPanel({ email }: { email: string }) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function deleteAccount() {
    setBusy(true);
    try {
      await fetchJson("/api/account", { method: "DELETE" });
      toast.success("Your account was deleted");
      await signOut({ redirectTo: "/" });
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-10">
      <section aria-labelledby="theme-h">
        <h2 id="theme-h" className="text-[1.3rem] font-semibold">
          Appearance
        </h2>
        <p className="mt-1 text-[14px] text-muted">Follow your system, or choose a theme. Saved on this device.</p>
        <div role="radiogroup" aria-label="Theme" className="mt-4 grid max-w-md grid-cols-3 gap-2">
          {(
            [
              ["light", Sun, "Light"],
              ["dark", Moon, "Dark"],
              ["system", Monitor, "System"],
            ] as const
          ).map(([v, Icon, label]) => (
            <button
              key={v}
              role="radio"
              aria-checked={theme === v}
              onClick={() => setTheme(v)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-[12px] border px-3 py-4 text-[14px] transition-colors",
                theme === v ? "border-accent bg-accent-soft text-accent-ink" : "border-border bg-surface hover:bg-sunken",
              )}
            >
              <Icon className="size-5" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="danger-h" className="rounded-[12px] border border-border bg-surface p-5">
        <h2 id="danger-h" className="text-[1.3rem] font-semibold">
          Delete account
        </h2>
        <p className="mt-1 text-[14px] text-muted">
          Permanently removes your profile, chats, saved projects and seen list. This can&apos;t be undone.
        </p>
        <Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>
          <Trash2 /> Delete my account
        </Button>
      </section>

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription className="mt-2">
            This deletes {email} and everything in it. Type <strong className="text-text">DELETE</strong> to confirm.
          </DialogDescription>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="confirm-delete">Confirmation</Label>
            <Input id="confirm-delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" disabled={confirm !== "DELETE" || busy} onClick={() => void deleteAccount()}>
              Delete forever
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
