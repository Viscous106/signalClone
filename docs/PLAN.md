# Build Plan

Locked decisions: **FastAPI** backend · **Next.js + Tailwind** (custom Signal tokens) · **SQLite** · **WebSockets**. Hosting decided at Phase 6.

Visual target per screen: [UI-SPEC.md](./UI-SPEC.md), from screenshots of the
real apps. It adds no scope — it restyles screens already listed below.

Rule: REST writes, WebSocket fanout. Every message is persisted by an HTTP call, then broadcast. Never trust the socket as the source of truth.

## Order of work

| Phase | What | Done when |
|---|---|---|
| 0 | Scaffold | `backend/` + `frontend/` run locally, models created, `seed.py` fills 5 users + 3 chats |
| 1 | Auth (M1) | Register → fixed OTP `123456` → JWT cookie → refresh survives reload |
| 2 | App shell (M2) | Sidebar list from real API, search, add contact, unread + preview |
| 3 | 1:1 chat (M3) | Two browsers, live messages, ✓/✓✓, typing dots, all persisted |
| 4 | Groups (M4) | Create group, member list, add/remove, system messages |
| 5 | Signal polish (M5, M6) | Dark theme, toasts, settings pages, "Coming Soon" stubs |
| 6 | Ship (M7) | README, deploy, seed on boot, submit links |

Phases 1→3 are the critical path. Phase 4 reuses the Phase 3 message pipeline unchanged — a group is just a conversation with `type='group'`.

## Phase detail

**0 — Scaffold**
- `backend/`: FastAPI app, SQLAlchemy models, `Base.metadata.create_all()` on startup (no Alembic — SQLite, single dev).
- `frontend/`: `create-next-app` (App Router, TS), Tailwind, Signal color tokens in `globals.css`.
- `seed.py`: idempotent. Users Alice/Bob/Carol/Dave/Erin, 2 direct chats + 1 group, ~15 messages with staggered timestamps.

**1 — Auth**
- `POST /auth/start` → returns `{otp_sent: true}` (logs the code, always `123456`).
- `POST /auth/verify` → creates user if new, returns JWT in httpOnly cookie.
- Next.js middleware guards `(app)` routes; `/login` + `/register` are public.

**2 — Shell**
- Three-pane layout matching Signal: 80px icon rail (Chats/Calls/Stories + own avatar), conversation list with 72px rows, chat pane. Rail + list are a persistent layout, so switching chats does not remount them.
- `GET /conversations` returns each row pre-joined with last message + unread count — one query for the whole list, no N+1.

**3 — 1:1 messaging**
- Connect WS on app mount, one socket for all conversations, routed client-side by `conversation_id`.
- Optimistic send: render bubble as `sending` with a temp id, reconcile on the server's `message.new`.
- Receipts: `delivered` when a member's socket receives it, `read` when they have the chat open. Sender's tick = weakest state across other members.
- Typing: WS-only, never persisted, 3s idle timeout.

**4 — Groups**
- Same endpoints. `POST /conversations` with `name` + `member_ids`. Creator becomes `admin`.
- Add/remove writes a `type='system'` message ("Alice added Bob") so the change appears in the thread.

**5 — Polish**
- Dark is the default theme. Match Signal: 18px bubble radius, 306px bubble cap, 48px list avatars, outgoing bubble `#2267F5`, date dividers, unread separator line. Specs in SIGNAL-UI-REFERENCE.md.
- Settings pages render real toggles that persist locally; nothing behind them needs to work.
- Placeholders: Calls, Stories, Linked devices → centered "Coming Soon" panel.

**6 — Ship**
- README with setup, architecture, schema, API, assumptions (a graded deliverable).
- SQLite needs a mounted disk or data dies on redeploy. Seed on boot if the DB is empty.

## Testing — TDD

Tests come before implementation in every phase. Red, then green.

- **Backend**: pytest. In-memory SQLite per test via the `db` fixture; `client` fixture overrides `get_db` so API tests never touch the real file. Run `.venv/bin/python -m pytest`.
- **Frontend**: vitest + Testing Library, jsdom. Run `pnpm test`.
- Realtime behaviour that tests can't reach (two live sockets, tick transitions) still gets a manual two-browser check at the end of each phase.

## UI refinements from the real app

Fixes to screens already in scope, logged against the phase that owns them.
Detail and measurements in [UI-SPEC.md](./UI-SPEC.md).

| Phase | Refinement |
|---|---|
| 1 | Onboarding left-aligned with a bottom-right "Next"; OTP as six boxes grouped 3–3; "Wrong number?" link |
| 2 | Avatars to Signal's pastel-fill/saturated-initial pairs (A100–A210) — store the token, not a hex |
| 2 | List pane 340px → 320px |
| 2 | New chat becomes a left-pane panel with a back chevron, not a centred modal |
| 2 | Empty states in pairs: "No chats" in the list, Signal logo + "Welcome to Signal" + nonprofit footer in the chat pane |
| 2 | Rail gains the hamburger at top; settings gear pinned bottom |
| 5 | Settings becomes rail + 320px nav + ~730px detail column, rail still visible |
| 5 | Privacy page carries real Read receipts and Typing indicators toggles — both are features we actually built |
| 5 | Shared primitives: grey/accent/destructive pills, 14px checkbox, select with chevron, hairline section dividers |

## Deliberately out of scope
Real E2E crypto · Alembic migrations (single-dev SQLite, `create_all` is honest) · file uploads unless bonus time remains.
