# Signal Clone

A functional clone of Signal — registration, contacts, one-to-one and group
messaging in real time — rebuilt to match the desktop app's look and feel.

Encryption is **simulated**, not implemented: per the brief, the focus is the
Signal experience and the messaging workflows rather than a real cryptographic
protocol.

## Try it

```bash
make setup     # backend venv + frontend deps
make db        # create and seed the database
make run       # api on :8000, web on :3000
```

Then open **http://localhost:3000**.

**Signing in.** Verification is mocked: any phone number works and the code is
always **`123456`**.

**Register with your own number and the app is already populated** — you get
the demo cast as contacts, two direct threads with history (one unread), and a
place in the group. Seeding only one hardcoded account would leave anyone who
signs up staring at an empty app. Switch it off with `STARTER_CHATS=false`.

To watch messages, ticks and typing indicators move live, sign in as two of the
seeded accounts in separate browser profiles:

| Name | Number |
|---|---|
| Alice Chen | `+1 555 000 0001` |
| Bob Martinez | `+1 555 000 0002` |
| Carol Nwosu | `+1 555 000 0003` |
| Dave Kim | `+1 555 000 0004` |
| Erin Patel | `+1 555 000 0005` |

Alice starts with two direct chats and a group, one of them unread.

## Commands

| Command | Does |
|---|---|
| `make` | List every target |
| `make setup` | Install backend and frontend dependencies |
| `make run` | Both servers; Ctrl-C stops both |
| `make test` | pytest + vitest |
| `make db` / `make remove-db` / `make reset-db` | Manage the SQLite file |

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript), Tailwind 4, Zustand |
| Backend | FastAPI, SQLAlchemy 2.0, Pydantic v2 |
| Database | SQLite |
| Realtime | WebSockets |
| Tests | pytest, vitest + Testing Library |

## How it fits together

```
Next.js (:3000)                    FastAPI (:8000)              SQLite
  ├── fetch ──── /api/* ──rewrite──►  routers ──► SQLAlchemy ──► signal.db
  └── WebSocket ───────── /ws ──────►  ConnectionManager
```

The browser only ever talks to one origin: Next rewrites `/api/*` to FastAPI,
so the session cookie needs no CORS or SameSite exceptions. WebSockets are the
exception — Next rewrites do not proxy them, so the socket connects to the API
directly and authenticates with the same cookie.

**Writes go over HTTP; the socket only fans out.** A message is persisted by a
`POST` and then broadcast, so a dropped connection can never lose one.

Full detail: **[architecture](docs/ARCHITECTURE.md)** ·
**[schema](docs/SCHEMA.md)** · **[API](docs/API.md)** ·
**[UI spec](docs/UI-SPEC.md)** · **[plan](docs/PLAN.md)**

## Database

Seven tables. Direct chats and groups share one `conversations` table,
discriminated by `type`, so messaging, receipts and the sidebar have exactly one
code path.

```
users ──┬── contacts (directional: Alice having Bob is not mutual)
        ├── conversation_members ──── conversations
        ├── messages ──────────────── conversations
        └── message_receipts ──────── messages
```

Two decisions worth knowing:

- **Receipts are rows, not columns.** A group message has one delivery state
  per recipient, so the tick mark is the *weakest* state across everyone else —
  one unread member holds the whole message at double-grey, exactly as Signal
  behaves.
- **`conversations.last_message_at` is denormalised** so the sidebar sorts
  without touching `messages`. `GET /conversations` costs a fixed six SQL
  statements no matter how many conversations you have, and a test fails if
  that count starts growing.

## Assumptions

- **Auth is mocked.** No passwords: possessing a phone number is proof of
  identity, and the OTP is a constant. Real verification and key exchange are
  explicitly out of scope.
- **Encryption is simulated** — copy and iconography only.
- **Presence** is real for connected sockets and falls back to `last_seen_at`
  (a 120-second window) for everyone else.
- **Single backend process.** The WebSocket registry is in-memory; scaling
  horizontally would mean swapping it for Redis pub/sub.
- **No migrations.** `create_all` on boot, which is honest for one developer on
  SQLite.
- **New accounts are given starter chats** so the app is never empty on first
  sign-in. Demo behaviour, and clearly switchable rather than hidden.
- **System notices never count as unread.** "Alice added Bob" belongs in the
  thread and the sidebar preview, but badging it would nag everyone on every
  membership change.
- Placeholders are marked disabled rather than pretending to work: calls,
  stories, linked devices, and most settings rows.
- The country list is a working subset, not the full ISO 3166 set.
- The Signal name, logo and wordmark belong to the Signal Foundation and are
  reproduced here only because the brief requires the UI to match exactly.

## Tests

```bash
make test
```

Backend tests use an in-memory database per test. Realtime behaviour — live
delivery, receipts, typing, group membership — is covered against real
WebSocket connections.

## Deployment

The frontend is Vercel-ready. The API needs a host that supports WebSockets and
a **persistent disk** for `signal.db`; without one the database resets on every
redeploy. Set `API_URL` (frontend) and `NEXT_PUBLIC_WS_URL`, `JWT_SECRET` and
`CORS_ORIGINS` (backend).
