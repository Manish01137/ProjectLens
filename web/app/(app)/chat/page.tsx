import type { Metadata } from "next";
import { auth } from "@/auth";
import { ChatView } from "@/components/chat/chat-view";
import { getProfile } from "@/lib/profile";
import { suggestionsFor } from "@/lib/suggestions";
import { firstName } from "@/lib/utils";

export const metadata: Metadata = { title: "New chat" };

export default async function NewChatPage() {
  const session = await auth();
  const profile = (await getProfile(session!.user.id))!;
  return <ChatView key="new" chatId={null} initialMessages={[]} firstName={firstName(session?.user?.name)} suggestions={suggestionsFor(profile)}
      profile={{ branch: profile.branch, skills: profile.skills, weeks: profile.weeks, level: profile.level }}
    />;
}
