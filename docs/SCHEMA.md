# Database Schema

SQLite. Eight tables. Every id is an integer primary key; every timestamp is UTC ISO-8601.

```
users ──┬── contacts (owner_id, contact_user_id)
        ├── conversation_members ──── conversations
        ├── messages ──────────────── conversations
        ├── message_receipts ──────── messages
        └── message_reactions ─────── messages
                                      attachments ──── messages
```

**users** — one row per account
`id · phone (unique) · username (unique, nullable) · display_name · avatar_url · avatar_token · about · last_seen_at · created_at`

`avatar_url` is `TEXT`, not a bounded string: with no object storage, a chosen
profile photo is cropped and shrunk in the browser and carried inline as a data
URI. `avatar_token` names a palette pair used to draw initials when there is no
photo.

**contacts** — a user's address book. Directional: Alice having Bob does not imply the reverse.
`id · owner_id → users · contact_user_id → users · nickname · created_at`
unique `(owner_id, contact_user_id)`

**conversations** — direct chats and groups in one table, discriminated by `type`
`id · type ('direct' | 'group') · name (groups only) · avatar_url · avatar_token · created_by → users · created_at · last_message_at · disappear_seconds`
`last_message_at` is denormalized so the sidebar sorts without touching `messages`.
`disappear_seconds` is the thread's disappearing-message timer; `0` is off. It
belongs to the conversation rather than the sender, so everyone sees the same
duration.

**conversation_members** — membership, role, and read position
`id · conversation_id → conversations · user_id → users · role ('admin' | 'member') · joined_at · last_read_message_id · muted`
unique `(conversation_id, user_id)`
Unread count = messages in the conversation with `id > last_read_message_id`.

**messages**
`id · conversation_id → conversations · sender_id → users (null for system) · type ('text' | 'system') · body · reply_to_id → messages · created_at · edited_at · deleted_at · expire_seconds · expires_at`
Soft delete via `deleted_at` so "This message was deleted" can render in place.

`reply_to_id` is `ON DELETE SET NULL`: a reply outlives the message it quoted
and simply renders without the quote block.

The two expiry columns are deliberately separate. `expire_seconds` is the
conversation's timer **as it stood when this message was sent**, snapshotted so
a later change cannot reach back and alter something already delivered.
`expires_at` is the actual deadline and stays `NULL` until the message has been
**read** — an unread message has not served its purpose, and destroying it would
lose it unseen. In a group the clock waits for the *last* other member.

**message_receipts** — per-recipient delivery state, the source of the tick marks
`id · message_id → messages · user_id → users · delivered_at · read_at`
unique `(message_id, user_id)`

**attachments** — files and images on a message
`id · message_id → messages · name · mime · size · data_url · width · height`

With no object storage, bytes ride inline as a base64 data URI — the same
compromise the profile photos make. Capped at 4 MB decoded and 10 per message,
with a mime allowlist that excludes SVG (it executes script when opened).
`size` is the decoded byte count, so a file chip can be labelled without
decoding. Images carry dimensions; other types leave them `NULL`.

**message_reactions** — one emoji from one person on one message
`id · message_id → messages · user_id → users · emoji · created_at`
unique `(message_id, user_id)`

Unique per pair, so reacting again *replaces* rather than tallying: a person
holds one reaction per message, which is how Signal behaves. Grouping into pills
happens server-side so every client counts identically.

**otp_codes** — not a table. The code is a constant; nothing to store.

## Indexes
```sql
CREATE INDEX ix_messages_conv_created  ON messages(conversation_id, created_at DESC);
CREATE INDEX ix_members_user           ON conversation_members(user_id);
CREATE INDEX ix_receipts_message       ON message_receipts(message_id);
CREATE INDEX ix_conv_last_message      ON conversations(last_message_at DESC);
CREATE INDEX ix_attachments_message    ON attachments(message_id);
CREATE INDEX ix_reactions_message      ON message_reactions(message_id);
CREATE INDEX ix_messages_expires_at    ON messages(expires_at);
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
- Attachments and reactions are separate tables rather than JSON columns, so
  they can be indexed, counted in one grouped query, and cascade-deleted with
  their message.
- There is **no migration tool**. Schema comes from `create_all` at startup, and
  the deployed database is rebuilt from the seed on every boot (the free Render
  plan allows no disk), so it always matches the models. Locally, adding a
  column means deleting `backend/signal.db` once: `create_all` creates missing
  tables but never alters existing ones.
