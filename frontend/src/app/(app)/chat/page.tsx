"use client";

import { Suspense, useEffect, useState } from "react";

import { ChatHeader } from "@/components/chat/ChatHeader";
import { DisappearingModal } from "@/components/chat/DisappearingModal";
import { GroupInfoModal } from "@/components/chat/GroupInfoModal";
import { Composer } from "@/components/chat/Composer";
import { MessageList } from "@/components/chat/MessageList";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { useActiveConversationId } from "@/hooks/useActiveConversation";
import { sendTyping } from "@/hooks/useRealtime";
import { api } from "@/lib/api";
import type { Conversation, Member, Quote } from "@/lib/types";
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
  const [showTimer, setShowTimer] = useState(false);
  const [members, setMembers] = useState<Member[] | null>(null);
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

  // Only groups gate the timer on a role, so only groups need the roster.
  useEffect(() => {
    if (!showTimer || conversation?.type !== "group" || members) return;
    api
      .get<Member[]>(`/api/conversations/${conversationId}/members`)
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [showTimer, conversation?.type, conversationId, members]);

  if (!me || !conversation) {
    return <div className="h-full" aria-busy="true" />;
  }

  const typist = conversation.members.find(
    (m) => m.id !== me.id && typingIds.includes(m.id)
  );
  const iAmAdmin = (members ?? []).some((m) => m.user.id === me.id && m.role === "admin");

  return (
    <div className="flex h-full flex-col">
      <ChatHeader
        conversation={conversation}
        meId={me.id}
        typingLabel={typist ? typist.display_name.split(/\s+/)[0] : null}
        onOpenInfo={() => setShowInfo(true)}
        onOpenTimer={() => setShowTimer(true)}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <MessageList
          messages={messages ?? []}
          meId={me.id}
          isGroup={conversation.type === "group"}
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

      {showTimer && (
        <DisappearingModal
          conversation={conversation}
          // Groups follow the same rule as renaming: admins only.
          canChange={conversation.type !== "group" || iAmAdmin}
          onClose={() => setShowTimer(false)}
        />
      )}

      {showInfo && conversation.type === "group" && (
        <GroupInfoModal
          conversation={conversation}
          meId={me.id}
          onClose={() => setShowInfo(false)}
        />
      )}
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
