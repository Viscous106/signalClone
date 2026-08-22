# Architecture

```
Next.js (Vercel-ready)          FastAPI + uvicorn            SQLite
  ├── fetch  ──── REST /api ────────►  routers  ──► SQLAlchemy ──► signal.db
  └── WebSocket ── /ws?token= ──────►  ConnectionManager
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

Single socket per browser tab, authenticated by the JWT on the query string. `ConnectionManager` holds `dict[user_id, set[WebSocket]]` — in-process only, which is correct for one uvicorn worker. Fanout resolves conversation members, then sends to every socket each member has open.

**Server → client**

| Event | Payload | Effect |
|---|---|---|
| `message.new` | full message | append bubble, bump conversation to top of list |
| `message.status` | message_id, status, user_id | ✓ → ✓✓ → blue ✓✓ |
| `typing` | conversation_id, user_id, is_typing | typing dots |
| `presence` | user_id, online, last_seen | sidebar + chat header |
| `conversation.updated` | conversation | rename, member change, new group |

**Client → server**: `typing` (start/stop), `ping` (keepalive).

Reconnect: exponential backoff to 10s max. On reconnect the client refetches the conversation list, so nothing missed while offline is lost.

## Message send path

1. Client renders the bubble immediately with a temp id, status `sending`.
2. `POST /conversations/{id}/messages` persists it and returns the real row.
3. Server broadcasts `message.new` to all members including the sender.
4. Sender swaps the temp bubble for the real one by temp id; a failed POST flips it to `failed` with a retry affordance.

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
