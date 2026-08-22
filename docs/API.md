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
| GET | `/users/search?q=` | by phone or username, excludes self |

## Contacts
| Method | Path | Notes |
|---|---|---|
| GET | `/contacts` | address book, alphabetical |
| POST | `/contacts` | `{phone}` or `{user_id}` |
| DELETE | `/contacts/{id}` | |

## Conversations
| Method | Path | Notes |
|---|---|---|
| GET | `/conversations` | sorted by `last_message_at` desc; each row carries `last_message`, `unread_count`, `members` |
| POST | `/conversations` | direct: `{user_id}` (returns the existing chat if there is one) · group: `{name, member_ids[]}` |
| GET | `/conversations/{id}` | detail + members |
| PATCH | `/conversations/{id}` | rename group — admin only |
| GET | `/conversations/{id}/members` | |
| POST | `/conversations/{id}/members` | `{user_ids[]}` — admin only, writes a system message |
| DELETE | `/conversations/{id}/members/{user_id}` | admin only, or self to leave |

## Messages
| Method | Path | Notes |
|---|---|---|
| GET | `/conversations/{id}/messages?before={id}&limit=50` | newest first, cursor paginated for infinite scroll |
| POST | `/conversations/{id}/messages` | `{body, reply_to_id?}` → persists, then broadcasts `message.new` |
| POST | `/conversations/{id}/read` | `{message_id}` — advances `last_read_message_id`, broadcasts `message.status` |
| DELETE | `/messages/{id}` | soft delete, sender only |

## WebSocket
`GET /ws?token={jwt}` — one socket per tab. Event contract is in [ARCHITECTURE.md](./ARCHITECTURE.md#realtime).

## Conventions
- Errors: `{detail: "..."}` with `400` validation · `401` unauthenticated · `403` not a member / not admin · `404` missing.
- Every conversation and message route checks the caller is a member before doing anything else.
- Timestamps are UTC ISO-8601 strings; the client formats them locally.
