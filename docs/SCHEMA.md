# Database Schema

SQLite. Seven tables. Every id is an integer primary key; every timestamp is UTC ISO-8601.

```
users ──┬── contacts (owner_id, contact_user_id)
        ├── conversation_members ──── conversations
        ├── messages ──────────────── conversations
        └── message_receipts ──────── messages
```

**users** — one row per account
`id · phone (unique) · username (unique, nullable) · display_name · avatar_url · avatar_color · about · last_seen_at · created_at`

**contacts** — a user's address book. Directional: Alice having Bob does not imply the reverse.
`id · owner_id → users · contact_user_id → users · nickname · created_at`
unique `(owner_id, contact_user_id)`

**conversations** — direct chats and groups in one table, discriminated by `type`
`id · type ('direct' | 'group') · name (groups only) · avatar_url · created_by → users · created_at · last_message_at`
`last_message_at` is denormalized so the sidebar sorts without touching `messages`.

**conversation_members** — membership, role, and read position
`id · conversation_id → conversations · user_id → users · role ('admin' | 'member') · joined_at · last_read_message_id · muted`
unique `(conversation_id, user_id)`
Unread count = messages in the conversation with `id > last_read_message_id`.

**messages**
`id · conversation_id → conversations · sender_id → users (null for system) · type ('text' | 'system') · body · reply_to_id → messages · created_at · edited_at · deleted_at`
Soft delete via `deleted_at` so "This message was deleted" can render in place.

**message_receipts** — per-recipient delivery state, the source of the tick marks
`id · message_id → messages · user_id → users · delivered_at · read_at`
unique `(message_id, user_id)`

**otp_codes** — not a table. The code is a constant; nothing to store.

## Indexes
```sql
CREATE INDEX ix_messages_conv_created  ON messages(conversation_id, created_at DESC);
CREATE INDEX ix_members_user           ON conversation_members(user_id);
CREATE INDEX ix_receipts_message       ON message_receipts(message_id);
CREATE INDEX ix_conv_last_message      ON conversations(last_message_at DESC);
```

## Deriving message status
The sender's tick is the **weakest** state across all other members:

| Condition | Shown |
|---|---|
| no receipt rows yet | `sent` — single ✓ |
| every other member has `delivered_at` | `delivered` — double ✓ |
| every other member has `read_at` | `read` — blue double ✓ |

For a group this means one unread recipient keeps the whole message at ✓✓ — which is exactly Signal's behavior.

## Design notes
- Direct chats live in `conversations` rather than a separate table, so messaging, receipts, and the sidebar have exactly one code path.
- A direct conversation is uniquely identified by its member pair; creating one checks for an existing `type='direct'` conversation with both users before inserting.
- Receipts are rows, not columns on `messages`, because a group message has one state per recipient.
