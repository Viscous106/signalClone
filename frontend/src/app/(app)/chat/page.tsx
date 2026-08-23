"use client";

import { Suspense, useEffect, useState } from "react";

import { ChatHeader } from "@/components/chat/ChatHeader";
import { ConversationInfo } from "@/components/chat/ConversationInfo";
import { Composer } from "@/components/chat/Composer";
import { MessageList } from "@/components/chat/MessageList";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { useActiveConversationId } from "@/hooks/useActiveConversation";
import { sendTyping } from "@/hooks/useRealtime";
import { api } from "@/lib/api";
import type { Conversation, Quote } from "@/lib/types";
import { selectChatColor, useChatColors } from "@/store/chatColors";
import { useConversations } from "@/store/conversations";
import { selectTyping, useMessages } from "@/store/messages";
import { useSession } from "@/store/session";

function ChatPane() {
  const conversationId = useActiveConversationId() ?? Number.NaN;

  const me = useSession((s) => s.user);
  const conversation = useConversations((s) => s.items.find((c) => c.id === conversationId));
  const upsert = useConversations((s) => s.upsert);
  const clearUnread = useConversations((s) => s.clearUnread);

  const [showInfo, setShowInfo] = useState(false);
  const chatColor = useChatColors(selectChatColor(conversationId));
  // Tagged with the thread it belongs to, so switching chats drops it by
  // derivation rather than by resetting state from an effect.
  const [reply, setReply] = useState<{ conversationId: number; quote: Quote } | null>(null);
  const replyTo = reply?.conversationId === conversationId ? reply.quote : null;
  const messages = useMessages((s) => s.byConversation[conversationId]);
  const typingIds = useMessages(selectTyping(conversationId));
  const load = useMessages((s) => s.load);
  const send = useMessages((s) => s.send);
  const react = useMessages((s) => s.react);
  const dropExpired = useMessages((s) => s.dropExpired);
  const markRead = useMessages((s) => s.markRead);

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

  // A disappearing message should go while you are looking at it, not on the
  // next reload. One shared second-tick rather than a timer per bubble.
  useEffect(() => {
    const tick = setInterval(dropExpired, 1000);
    return () => clearInterval(tick);
  }, [dropExpired]);


  if (!me || !conversation) {
    return <div className="h-full" aria-busy="true" />;
  }

  const typist = conversation.members.find(
    (m) => m.id !== me.id && typingIds.includes(m.id)
  );

  // The info pane replaces the thread, the way Signal Desktop does it.
  if (showInfo) {
    return (
      <ConversationInfo
        conversation={conversation}
        meId={me.id}
        onBack={() => setShowInfo(false)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ChatHeader
        conversation={conversation}
        meId={me.id}
        typingLabel={typist ? typist.display_name.split(/\s+/)[0] : null}
        onOpenInfo={() => setShowInfo(true)}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <MessageList
          messages={messages ?? []}
          meId={me.id}
          isGroup={conversation.type === "group"}
          chatColor={chatColor}
          onReply={(quote) => setReply({ conversationId, quote })}
          onReact={(messageId, emoji) => react(conversationId, messageId, emoji)}
        />
      </div>

      {typist && <TypingIndicator />}

      <Composer
        onSend={(body, attachments) => {
          send(conversationId, { body, attachments, replyToId: replyTo?.id ?? null }, me.id);
          setReply(null);
        }}
        onTyping={(isTyping) => sendTyping(conversationId, isTyping)}
        replyTo={replyTo}
        onCancelReply={() => setReply(null)}
        meId={me.id}
      />

    </div>
  );
}

/**
 * Suspended because it reads `?c=`, which a static export cannot know when it
 * prerenders this route.
 */
export default function ChatPage() {
  return (
    <Suspense fallback={<div className="h-full" aria-busy="true" />}>
      <ChatPane />
    </Suspense>
  );
}
