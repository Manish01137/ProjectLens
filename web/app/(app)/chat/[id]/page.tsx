import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ChatView } from "@/components/chat/chat-view";
import type { ChatMessage } from "@/components/chat/message";
import { db } from "@/lib/db";
import { getProfile } from "@/lib/profile";
import { suggestionsFor } from "@/lib/suggestions";
import { firstName } from "@/lib/utils";
import { projectListSchema } from "@/lib/validators";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const session = await auth();
  const { id } = await params;
  const chat = session?.user?.id ? await db.chat.findFirst({ where: { id, userId: session.user.id }, select: { title: true } }) : null;
  return { title: chat?.title ?? "Chat" };
}

export default async function ChatPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;
  const chat = await db.chat.findFirst({
    where: { id, userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!chat) notFound();
  const profile = (await getProfile(userId))!;
  const messages: ChatMessage[] = chat.messages.map((m) => {
    const cards = projectListSchema.safeParse(m.projects);
    return {
      id: m.id,
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
      projects: cards.success ? cards.data : null,
      meta: (m.meta as ChatMessage["meta"]) ?? null,
      intent: m.intent,
      feedback: m.feedback,
    };
  });
  return <ChatView key={chat.id} chatId={chat.id} initialMessages={messages} firstName={firstName(session?.user?.name)} suggestions={suggestionsFor(profile)}
      profile={{ branch: profile.branch, skills: profile.skills, weeks: profile.weeks, level: profile.level }}
    />;
}
