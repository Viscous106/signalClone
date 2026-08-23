# API

Base `/api`. JSON in, JSON out. Auth via JWT in an httpOnly cookie; `401` when absent or expired.

## Auth
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/start` | `{phone}` | `{otp_sent: true, is_new: bool}` — code is always `123456` |
| POST | `/auth/verify` | `{phone, code, display_name?}` | user + sets cookie. `display_name` required when new |
| POST | `/auth/logout` | — | clears cookie |

## Users
| Method | Path | Notes |
|---|---|---|
| GET | `/users/me` | current session user |
| PATCH | `/users/me` | `display_name`, `about`, `avatar_url` |
| GET | `/users/search?q=` | by display name, username, or phone; excludes self; blank `q` returns `[]` |

## Contacts
| Method | Path | Notes |
|---|---|---|
| GET | `/contacts` | address book, alphabetical |
| POST | `/contacts` | `{phone}` or `{user_id}`; `201`, idempotent; `404` if not on Signal |
| DELETE | `/contacts/{user_id}` | takes the contact's **user** id, not the join-row id |

## Conversations
| Method | Path | Notes |
|---|---|---|
| GET | `/conversations` | sorted by `last_message_at` desc; each row carries `last_message`, `unread_count`, `members` |
| POST | `/conversations` | direct: `{user_id}` — returns the existing chat if there is one, so the sidebar cannot fill with duplicates. Group: `{name, member_ids[]}` — never deduplicated, two groups may share a name |
| GET | `/conversations/{id}` | detail + members |
| PATCH | `/conversations/{id}` | `{name}` — rename a group. Admin only (`403`), groups only (`400`), blank rejected (`422`) |
| PATCH | `/conversations/{id}/disappearing` | `{seconds}` — the thread's timer; `0` is off. Only the durations in `services/disappearing.CHOICES` are accepted (`400`). Admin only in a group; either side in a 1:1. Writes a system notice, and setting the value it already has is a no-op |
| GET | `/conversations/{id}/members` | `[{role, joined_at, last_read_message_id, user}]`, oldest first. Members only |
| POST | `/conversations/{id}/members` | `{user_ids[]}` — admin only. Already-members are skipped; returns the full roster |
| DELETE | `/conversations/{id}/members/{user_id}` | Admin removes anyone; **anyone may remove themselves** to leave. `404` if they are not in the group |

## Messages
| Method | Path | Notes |
|---|---|---|
| GET | `/conversations/{id}/messages?before={id}&limit=50` | newest first, cursor paginated for infinite scroll. Each row carries `status` (`sent`/`delivered`/`read`) on messages **you** sent and `null` on the rest, plus `attachments`, `reactions` (grouped, with a `mine` flag for you) and `quote` (a flat snippet of `reply_to_id`, never a nested message) |
| POST | `/conversations/{id}/messages` | `{body, reply_to_id?, attachments?, client_id?}` → persists, then broadcasts `message.new`. `client_id` is echoed back untouched so the sender can match its optimistic bubble |
| POST | `/conversations/{id}/messages/{message_id}/reactions` | `{emoji}` — one endpoint for the whole toggle: the same emoji clears, a different one replaces, blank clears. Returns the updated message and broadcasts `message.reactions` per member |
| POST | `/conversations/{id}/read` | `{message_id}` — advances `last_read_message_id`, broadcasts `message.status`, and **arms any disappearing timer** the last outstanding reader has now satisfied |

There is deliberately **no delete-message endpoint**. The `deleted_at` column
and the "This message was deleted" bubble both exist, but nothing in the API
sets them yet.

### Sending attachments

`attachments` is a list of `{name, mime, data_url, width?, height?}`. With no
object storage, bytes ride inline as base64 data URIs.

- Max **4 MB decoded**, max **10 per message** — both `400`.
- The mime **inside** the data URI must match the declared one, and must be in
  the allowlist. **SVG is refused**: it executes script when opened.
- Validation happens before any row is written, so a rejected upload leaves no
  message behind.
- Filenames are flattened (`/` and `\` stripped) so a download name cannot
  escape a directory.

### Disappearing messages

A message carries `expire_seconds` (the thread's timer as it stood when the
message was sent) and `expires_at` (the deadline, `null` until read). Reading is
what starts the clock; in a group it waits for the **last** other member. Lapsed
messages are filtered out of `GET /messages` and swept on read.

## WebSocket
`GET /ws` — one socket per tab, authenticated by the session cookie (no token
in the query string). Event contract in
[ARCHITECTURE.md](./ARCHITECTURE.md#realtime).

## Group rules

- **Membership is the authorisation** for every conversation route; the admin
  role gates only add, remove and rename.
- Every change writes a `type='system'` message into the thread ("Alice added
  Bob", "Bob left the group"), which becomes the sidebar preview and bumps the
  conversation's sort position.
- **System notices never contribute to `unread_count`.** They belong in the
  thread and the preview, but badging them would mean every membership change
  nags everyone.
- **If the last admin leaves, the longest-standing remaining member is
  promoted.** A group with no admin could never be administered again.
- New members can read the full history — there is no per-member visibility
  window.
- A group message stays at `sent` until *every* other member has it, and only
  reaches `read` when every one of them has read it.
- **Quoting across conversations is refused** (`400`): it would leak a message
  into a thread whose members never saw it. `reply_to_id` is `ON DELETE SET
  NULL`, so a reply outlives the message it quoted.

## Notes on the list endpoint

`GET /conversations` is the sidebar's only call. Each row already carries
`last_message`, `unread_count` and `members`, and the whole response costs a
**fixed number of SQL statements** regardless of how many conversations you have
— newest message per conversation and unread counts are each one grouped query,
and the preview's attachments are eager-loaded rather than lazy-loaded per row.
A test asserts the statement count does not grow with the row count; it is what
caught the N+1 when attachments were added to the message schema.

Presence is mocked: `UserBrief.online` is computed from `last_seen_at` against
a 120-second window.

The display title is deliberately **not** returned. The server stays structural
(`type`, `name`, `members`) and the client derives the title, so the rule for
"what do we call an unnamed group" lives in exactly one place.

## Conventions
- Errors: `{detail: "..."}` with `400` validation · `401` unauthenticated · `403` not a member / not admin · `404` missing.
- Every conversation and message route checks the caller is a member before doing anything else.
- Timestamps are UTC ISO-8601 strings; the client formats them locally.
