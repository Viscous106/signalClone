# Architecture

```
Next.js (Vercel-ready)          FastAPI + uvicorn            SQLite
  ├── fetch  ──── REST /api ────────►  routers  ──► SQLAlchemy ──► signal.db
  └── WebSocket ── /ws (cookie) ────►  ConnectionManager
```

One HTTP API for reads/writes, one WebSocket for push. The socket carries no writes except typing indicators.

## Repo layout

```
backend/
  app/
    main.py            app factory, CORS, startup create_all + seed-if-empty
    core/              config.py (env), security.py (JWT), deps.py (current_user)
    db/                session.py, models.py
    schemas/           Pydantic request/response models
    api/               auth.py users.py contacts.py conversations.py messages.py
    ws/                manager.py (ConnectionManager), routes.py (/ws)
    seed.py
  requirements.txt

frontend/
  src/app/
    (auth)/login  (auth)/register
    (app)/layout.tsx          80px nav rail + conversation list, persistent
    (app)/page.tsx            empty state ("Select a chat")
    (app)/chat/[id]/page.tsx  message pane
    (app)/settings/...        privacy / notifications / appearance
    (app)/calls  stories  devices     "Coming Soon" stubs
  src/components/  rail/ sidebar/ chat/ modals/ ui/
  src/lib/         api.ts  ws.ts  time.ts
  src/store/       session.ts conversations.ts messages.ts  (zustand)
```

## Realtime

Single socket per browser tab, authenticated by the **session cookie** — not a
token in the query string, which would leak the JWT into logs and history.
Cookies ignore port, so `:3000 → :8000` works in development; a cross-domain
deployment needs the API on a sibling subdomain.

`ConnectionManager` lives on `app.state` (not a module global, so tests get a
fresh registry) and holds `dict[user_id, set[WebSocket]]` — one user can have
several tabs. Fanout resolves conversation members, then sends to every socket
each member has open.

The socket route opens a **short database session per operation**, never one for
the life of the connection: a socket can stay open for hours, and holding a
pooled connection that long starves everything else.

Broadcasts are issued from synchronous endpoints via `anyio.from_thread.run`,
which hops back onto the event loop. Keeping the endpoints synchronous means
blocking SQLAlchemy calls never sit on the loop.

**Server → client**

| Event | Payload | Effect |
|---|---|---|
| `message.new` | full message | append bubble, bump conversation to top of list |
| `message.status` | message_id, status, user_id | ✓ → ✓✓ → blue ✓✓ |
| `typing` | conversation_id, user_id, is_typing | typing dots |
| `presence` | user_id, online, last_seen | sidebar + chat header |
| `conversation.updated` | conversation | rename, member change, added to a group |
| `conversation.removed` | conversation_id | you were removed, or you left |

**Client → server**: `typing` (start/stop), `ping` (keepalive).

`conversation.updated` is one payload broadcast to every member, so it cannot
carry per-person state — it always arrives with `last_message: null` and
`unread_count: 0`. The client merges only the structural fields over what it
already holds; taking it wholesale would blank the sidebar for everyone.

Reconnect: exponential backoff to 10s max. On reconnect the client refetches the conversation list, so nothing missed while offline is lost.

## Message send path

1. Client draws the bubble immediately with a generated `client_id`, status `sending`.
2. `POST /conversations/{id}/messages` persists it and returns the stored row,
   echoing `client_id` back.
3. Server marks it delivered for every recipient who currently has a socket
   open, then broadcasts `message.new` to all members — the sender included, so
   their other tabs stay in step.
4. The sender matches the confirmation to its optimistic bubble **by
   `client_id`**, an exact match rather than guessing from body text and
   timestamps. A failed POST flips the bubble to `failed`.

Recipients who were offline get their receipts on reconnect: the socket
handler delivers the backlog and notifies each original sender, so ticks catch
up rather than being stuck.

## Message status

Derived from `message_receipts`, never cached on the message, so a reload shows
the truth. A message's status is the **weakest** state across everyone else in
the conversation — one unread recipient keeps a group message on outlined
double checks. `status` is `null` on messages you received: ticks belong to the
sender.

## Theme tokens

Signal's real design tokens, defined once as CSS variables in `globals.css` and consumed through Tailwind. Dark is the default. Full spec in [SIGNAL-UI-REFERENCE.md](./SIGNAL-UI-REFERENCE.md).

| Token | Dark | Light |
|---|---|---|
| outgoing bubble | `#2267F5` | `#2267F5` |
| incoming bubble | `#323232` | `#EBEBEB` |
| surface primary | `#191919` | `#FAFAFA` |
| surface secondary | `#1E1E1E` | `#F5F5F5` |
| label primary | `#FFF` 90% | `#000` 90% |
| label secondary | `#FFF` 60% | `#000` 60% |
| border | `#FFF` 6% | `#000` 6% |
| accent | `#5563FF` | `#4655FF` |

Font is **Inter**. Bubbles: 18px radius, max-width `min(306px, 100% - 38px)`, 8px/12px padding, 6px apart.

## Assumptions
- Mocked auth: no passwords. OTP is always `123456`; possession of a phone number is proof of identity.
- Encryption is simulated — a lock icon and copy only, no key exchange.
- Presence is real for connected sockets, `last_seen` for everyone else.
- Single backend process; horizontal scaling would need Redis pub/sub in place of the in-memory manager.
