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
| POST | `/conversations` | direct: `{user_id}` — returns the existing chat if there is one, so the sidebar cannot fill with duplicates. Group (`{name, member_ids[]}`) arrives in Phase 4 |
| GET | `/conversations/{id}` | detail + members |
| PATCH | `/conversations/{id}` | rename group — admin only |
| GET | `/conversations/{id}/members` | |
| POST | `/conversations/{id}/members` | `{user_ids[]}` — admin only, writes a system message |
| DELETE | `/conversations/{id}/members/{user_id}` | admin only, or self to leave |

## Messages
| Method | Path | Notes |
|---|---|---|
| GET | `/conversations/{id}/messages?before={id}&limit=50` | newest first, cursor paginated for infinite scroll. Each row carries `status` (`sent`/`delivered`/`read`) on messages **you** sent, `null` on the rest |
| POST | `/conversations/{id}/messages` | `{body, reply_to_id?, client_id?}` → persists, then broadcasts `message.new`. `client_id` is echoed back untouched so the sender can match its optimistic bubble |
| POST | `/conversations/{id}/read` | `{message_id}` — advances `last_read_message_id`, broadcasts `message.status` |
| DELETE | `/messages/{id}` | soft delete, sender only |

## WebSocket
`GET /ws` — one socket per tab, authenticated by the session cookie (no token
in the query string). Event contract in
[ARCHITECTURE.md](./ARCHITECTURE.md#realtime).

## Notes on the list endpoint

`GET /conversations` is the sidebar's only call. Each row already carries
`last_message`, `unread_count` and `members`, and the whole response costs a
fixed **6 SQL statements** regardless of how many conversations you have —
newest message per conversation and unread counts are each one grouped query.
A test asserts the statement count does not grow with the row count.

Presence is mocked: `UserBrief.online` is computed from `last_seen_at` against
a 120-second window.

The display title is deliberately **not** returned. The server stays structural
(`type`, `name`, `members`) and the client derives the title, so the rule for
"what do we call an unnamed group" lives in exactly one place.

## Conventions
- Errors: `{detail: "..."}` with `400` validation · `401` unauthenticated · `403` not a member / not admin · `404` missing.
- Every conversation and message route checks the caller is a member before doing anything else.
- Timestamps are UTC ISO-8601 strings; the client formats them locally.
