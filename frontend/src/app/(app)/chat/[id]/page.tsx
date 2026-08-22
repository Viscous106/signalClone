"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";

import { ChatHeader } from "@/components/chat/ChatHeader";
import { Composer } from "@/components/chat/Composer";
import { MessageList } from "@/components/chat/MessageList";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { sendTyping } from "@/hooks/useRealtime";
import { api } from "@/lib/api";
import type { Conversation } from "@/lib/types";
import { useConversations } from "@/store/conversations";
import { useMessages } from "@/store/messages";
import { useSession } from "@/store/session";

export default function ChatPage() {
  const params = useParams<{ id: string }>();
  const conversationId = Number(params.id);

  const me = useSession((s) => s.user);
  const conversation = useConversations((s) => s.items.find((c) => c.id === conversationId));
  const upsert = useConversations((s) => s.upsert);
  const clearUnread = useConversations((s) => s.clearUnread);

  const messages = useMessages((s) => s.byConversation[conversationId]);
  const typingIds = useMessages((s) => s.typingBy[conversationId] ?? []);
  const { load, send, markRead } = useMessages();

  // Deep link into a chat the sidebar has not loaded yet.
  useEffect(() => {
    if (conversation || !Number.isFinite(conversationId)) return;
    api
      .get<Conversation>(`/api/conversations/${conversationId}`)
      .then(upsert)
      .catch(() => undefined);
  }, [conversation, conversationId, upsert]);

  useEffect(() => {
    if (!Number.isFinite(conversationId)) return;
    load(conversationId).catch(() => undefined);
  }, [conversationId, load]);

  // Having the chat open means having read it.
  useEffect(() => {
    if (!messages?.length) return;
    markRead(conversationId).then(() => clearUnread(conversationId));
  }, [conversationId, messages?.length, markRead, clearUnread]);

  if (!me || !conversation) {
    return <div className="h-full" aria-busy="true" />;
  }

  const typist = conversation.members.find(
    (m) => m.id !== me.id && typingIds.includes(m.id)
  );

  return (
    <div className="flex h-full flex-col">
      <ChatHeader
        conversation={conversation}
        meId={me.id}
        typingLabel={typist ? typist.display_name.split(/\s+/)[0] : null}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <MessageList
          messages={messages ?? []}
          meId={me.id}
          isGroup={conversation.type === "group"}
        />
      </div>

      {typist && <TypingIndicator />}

      <Composer
        onSend={(body) => send(conversationId, body, me.id)}
        onTyping={(isTyping) => sendTyping(conversationId, isTyping)}
      />
    </div>
  );
}
