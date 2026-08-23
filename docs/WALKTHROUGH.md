# Walkthrough

Everything in this project: what it is, how it fits together, and what is
genuinely finished. Written to be read top to bottom.

For the reference documents behind it: [ARCHITECTURE.md](./ARCHITECTURE.md) ·
[SCHEMA.md](./SCHEMA.md) · [API.md](./API.md) · [UI-SPEC.md](./UI-SPEC.md)

| | |
|---|---|
| Backend | 2,964 lines across 8 tables and 21 REST endpoints |
| Frontend | 6,652 lines |
| Tests | 644 — 231 backend, 413 frontend |
| Socket events | 9 |

---

## 1. The shape of it

One Python process serves both the API and the compiled web app. That single
decision removes CORS, a reverse proxy, and a second deployment.

```
                  FastAPI + uvicorn — one process, one port

  browser ──── /         ──►  static Next.js export (frontend/out)
          ──── /api/*    ──►  routers ──► services ──► SQLAlchemy ──► signal.db
          ──── /ws       ──►  ConnectionManager (push only)
```

HTTP carries every read and write. The socket carries push, and accepts nothing
from the client except typing indicators and heartbeats — so a dropped
connection can never lose a message. **Persist first, then fan out**; the socket
is never the source of truth.

Because the frontend is a prerendered static export there are no dynamic route
segments: the open conversation is `?c=<id>`, not `/chat/<id>`. Signal Desktop
has no URLs at all, so nothing is lost.

### What a sent message actually does

1. **Optimistic bubble.** The client draws the message immediately with a
   generated `client_id` and a spinner, so the thread never feels laggy.
2. **`POST /messages`.** Membership checked, attachments validated, the quoted
   message confirmed to be in this same conversation, then the row is written.
3. **Sidebar key updated.** `conversations.last_message_at` is denormalised so
   the chat list sorts without touching the messages table.
4. **Delivery receipts.** Anyone with a socket open is marked delivered at once.
   Everyone else gets it on reconnect, via a backlog sweep.
5. **Broadcast.** `message.new` to every member *including the sender* — their
   other tabs need it too. The echoed `client_id` lets the sender swap the
   placeholder for the real row rather than showing it twice.

### Realtime

One socket per tab, authenticated by the **session cookie** rather than a token
in the query string — a query-string JWT leaks into server logs and browser
history. `ConnectionManager` holds `dict[user_id, set[WebSocket]]`, so one
person can have several tabs open and all of them stay current.

The socket route opens a **short database session per operation**, never one for
the life of the connection. A socket can stay open for hours; holding a pooled
connection that long starves everything else.

Nine server events: `ready` · `pong` · `message.new` · `message.status` ·
`message.reactions` · `typing` · `presence` · `conversation.updated` ·
`conversation.removed`.

---

## 2. Data model

SQLite, eight tables. Every id is an integer primary key; every timestamp is
UTC. Full column lists in [SCHEMA.md](./SCHEMA.md).

| Table | Holds | The interesting part |
|---|---|---|
| `users` | One row per account | `avatar_url` is TEXT, not a bounded string: with no object storage, a chosen photo is cropped in the browser and carried inline as a data URI |
| `contacts` | An address book | Directional. Alice having Bob does not imply the reverse |
| `conversations` | Direct chats and groups | One table, discriminated by `type`, so messaging, receipts and the sidebar reuse one code path for both |
| `conversation_members` | Membership, role, read position | Unread count is *derived* — messages with `id > last_read_message_id`. No counter to drift |
| `messages` | Text and system notices | Soft-deleted via `deleted_at`, so "This message was deleted" renders in place rather than leaving a hole |
| `message_receipts` | Per-recipient delivery state | The source of the tick marks. One row per (message, person) |
| `attachments` | Files and images | Bytes inline as base64 data URIs, capped at 4 MB decoded |
| `message_reactions` | One emoji per person per message | Unique on (message, user). Reacting again replaces rather than tallies |

### Why there is no migration tool

Schema comes from `Base.metadata.create_all` at startup. The free Render plan
allows no persistent disk, so the deployed database is rebuilt from the seed on
every boot and always matches the models.

The cost is local: **adding a column means deleting `backend/signal.db` once**,
because `create_all` creates missing tables but never alters existing ones.

---

## 3. Messaging

| Feature | Status |
|---|---|
| Send & receive | Working |
| Delivery ticks | Working |
| Typing indicators | Working |
| Presence | Working |
| Attachments | Working |
| Reactions | Working |
| Quoted replies | Working |
| Disappearing messages | Working |

**Send & receive.** Optimistic bubble, cursor-paginated history (newest first,
50 at a time), Enter sends and Shift+Enter is a newline.

**Delivery ticks.** The distinction that matters is *fill, not colour*: one
outlined check is sent, two are delivered, two filled are read. A group message
shows the **weakest** state across everyone — one unread recipient keeps it on
double-outline. Status is derived from `message_receipts` on every read, never
cached on the message, so a reload shows the truth. It is `null` on messages you
received: ticks belong to the sender.

**Typing indicators.** Broadcast on the socket, stopping after a 3-second
pause. Cleared on unmount, so nobody is left staring at dots.

**Presence.** Derived from `last_seen_at` against a 120-second window rather
than stored as a flag — a flag would strand people "online" after a crash.

**Attachments.** Images render inline, other files as download chips. 4 MB cap,
max 10 per message, validated *before* any row is written so a rejected upload
leaves no trace. Two details worth knowing:

- The mime **inside** the data URI wins over the one the client declared, so a
  payload cannot be mislabelled into storage.
- **SVG is refused.** It executes script, and a data-URI SVG would run
  same-origin.

Filenames are also flattened (`/` and `\` stripped) so a download name can
never escape a directory.

**Reactions.** Six emoji. One per person per message: the same emoji twice
removes it, a different one replaces it. Grouped server-side so every client
counts identically, and each recipient's copy of the event carries its own
`mine` flag.

**Quoted replies.** The quote is a **flat snippet**, never a nested message —
nesting would recurse a whole reply chain. Clicking it scrolls to the original.
Quoting across conversations is refused: it would leak a message into a thread
whose members never saw it. If the original is hard-deleted the FK is
`SET NULL`, so the reply survives and simply renders without its quote block.

### Disappearing messages, in detail

Worth spelling out, because the obvious implementation is wrong.

The timer belongs to the **conversation**, not the sender, and changing it
announces itself as a system message in the thread — nobody should have their
messages quietly given a lifetime by someone else.

Each message carries two separate fields:

- **`expire_seconds`** — the duration, snapshotted at send time so a later
  change to the thread's timer cannot reach back and alter something already
  delivered.
- **`expires_at`** — the actual deadline, which stays **null until the message
  has been read**.

In a group the clock waits for the **last** other member. Starting on the first
read would delete the message out from under everyone still to see it — the
same weakest-state rule the delivery ticks use.

Three layers make expiry actually happen:

1. **Filtered on read** — a lapsed message is invisible the instant it lapses.
2. **Swept when a thread is opened** — there is no scheduler in this build, so
   reading is what reclaims rows.
3. **A one-second client tick** — it vanishes while you are looking at it, not
   on your next reload.

The sender's bubble shows a greyed hourglass with the duration while it waits
for a reader, then switches to a live countdown once the clock is armed. The
read endpoint's `message.status` event carries the new `expires_at`, so the
sender's countdown begins at the same instant as the recipient's.

> **Consequence worth knowing.** An unread message never lapses. It sits there
> indefinitely until someone opens it. That follows directly from starting the
> clock on read, and it is the right trade — but a message to someone who never
> opens the app stays forever.

---

## 4. Groups and permissions

A group is a conversation with `type='group'` and more members, so it inherits
every messaging code path untouched. Only the membership and admin rules are
group-specific.

| Action | Who may | Enforced at |
|---|---|---|
| Add members | admin | `POST /members` |
| Remove someone else | admin | `DELETE /members/{id}` |
| Leave | anyone | same route, when the target is yourself |
| Rename | admin | `PATCH /{id}` |
| Set the timer | admin | `PATCH /disappearing` |
| Set the timer (1:1) | either side | no admins exist in a 1:1 |

Every guard runs in the same order — membership, then is-it-a-group, then
is-it-admin — and returns `403 "Only group admins can do that"`.

The **service layer carries no authorization at all**: it takes an actor purely
to write the system notice. That keeps the rules in one place, but it does mean
any future caller of the service gets no protection for free.

Two details that are easy to miss:

- Membership changes are recorded as **system messages in the thread** ("Alice
  added Bob"), which is how Signal does it. They become the sidebar preview and
  bump the conversation's sort position, but they deliberately **never
  contribute to `unread_count`** — badging them would mean every membership
  change nags everyone.
- If the last admin leaves, the longest-standing member is **automatically
  promoted**. A group with no admin could never be administered again.

The UI states the boundary rather than hiding it: a plain member sees *"Only
admins can add or remove members, or change the group name."* where the controls
would be. Absent controls with no explanation read as a broken screen.

---

## 5. The interface

### Shell

Three panes on a desktop: an 80px icon rail, a 320px conversation list, and the
thread. A phone has room for exactly one, so each route names the pane it owns
(`lib/shell.ts`) and the rest is hidden by CSS rather than unmounted.

Calls, Stories and Settings each own the whole content area — carrying the chat
list into them would leave a pane with nothing to do with the page.

### Features

| Feature | Status | Notes |
|---|---|---|
| Filter chips | Working | All / Unread / Favorites / Groups with counts |
| Search | Working | Matches a title *or* any other member's name |
| Conversation info | Working | Click the header; one surface for both chat types |
| Dark / light mode | Working | Four entry points, one shared hook |
| Keyboard shortcuts | Working | Seven bindings plus a `Ctrl+/` sheet |
| Favorites | **Per-device** | `localStorage`, not synced |
| Chat colour | **Per-device** | `localStorage`, not synced |
| Chat folders (`+`) | **Placeholder** | Visible but inert |
| Calls · Stories | **Placeholder** | Honest empty states |
| Mute · in-chat search | **Placeholder** | Disabled, labelled "coming soon" |

**Filter chips.** Counts are computed *before* the search term applies — the
chips describe the whole list, not the current search. "All" never shows a
count; it is the resting state, and a number there would restate the list below
it.

**Search.** Matches a conversation title or any other member's name, so
searching "carol" surfaces the group she is in, not just her direct chat. Your
own name is skipped, since it is in every conversation and would match all.

**Conversation info.** Clicking the header opens a pane that replaces the
thread. One surface for both chat types: the settings rows (disappearing
messages, chat colour) are shared, and a group adds its roster, rename field and
admin controls below them.

**Dark / light mode.** Three-way in Settings (System / Light / Dark, following
the OS live via a `prefers-color-scheme` listener), plus one-click in the nav
rail, in the chat-list menu, and on `Ctrl+Shift+D`. All four share one
`useThemeSwitch()` hook so they cannot disagree about which way the switch goes.

From "System", the toggle commits to the opposite of **what you are currently
looking at**, not the opposite of what is stored — which is what someone
reaching for a toggle is asking for.

**Keyboard shortcuts.** `Ctrl+K` search · `Ctrl+N` new chat · `Alt+↑/↓` walk
conversations · `Ctrl+,` settings · `Esc` close · `Ctrl+Shift+D` theme ·
`Ctrl+/` the sheet. Nothing unmodified fires while you are typing — a shortcut
that steals a keystroke mid-sentence is worse than no shortcut.

The sheet is **generated from the same bindings the handler uses**, so the two
cannot drift.

**Favorites and chat colour** are both `localStorage`, so per-device. Signal
syncs them; a synced version needs a column, and the backend has no migration
tooling. The chat colour hex is validated on read (`/^#[0-9a-f]{6}$/`) because
it lands in a `style` attribute.

### Fidelity details

The bubble is Signal's, not an approximation: 18px radius, a hard **306px** cap
rather than a percentage (a percentage looks wrong on a wide window), and the
inner corner of a run tightening to 4px. Avatars are a deterministic **pair** —
a pale fill with the initials in a strong version of the same hue, never white
on saturated. Every thread opens with the encryption notice.

Responsive work covers three real gaps, not just breakpoints:

- Hover-only message actions are **always visible below `md`**, because a touch
  screen has no hover to reveal them.
- Wide content scrolls inside its own container, so the page body never scrolls
  sideways.
- Translucent overlays flip from `black/10` to `white/10` in dark mode, where a
  black wash is nearly invisible against dark grey.

---

## 6. Identity

Verification is mocked, as the brief allows: any phone number works and the
code is always `123456`.

| | |
|---|---|
| Session | JWT in an httpOnly cookie, 30 days |
| Phone input | Country picker with dial codes, E.164 normalisation |
| OTP entry | Six boxes driven entirely from keydown and paste |
| Profile | Display name, about, and a real photo picker — cropped and shrunk in the browser, stored as a data URI |
| Contacts | Search by name, username or number; add and remove |

On a `401` the client calls logout, because the cookie is httpOnly and only the
server can clear it. Leaving it in place makes `/` and `/login` redirect to each
other forever.

**New accounts are seeded** with the demo cast as contacts, two threads with
history and a place in the group. Seeding one hardcoded account would leave
anyone who signs up staring at an empty app. Switch it off with
`STARTER_CHATS=false`.

---

## 7. What the tests actually prove

644 tests pass. That number is worth unpacking, because the two halves are not
equally well covered.

| Layer | Tests | Method | Strength |
|---|---|---|---|
| Backend | 231 | Real HTTP through FastAPI's TestClient against an in-memory database | **Strong.** Endpoints, authorization, validation and expiry are genuinely exercised |
| Frontend | 413 | jsdom, with `fetch` stubbed | **Component-level.** Proves each component and store behaves — not that the app works |

There is **no end-to-end suite** — no Playwright, no Cypress. Nothing verifies
the two halves talking to each other. Three specific risks follow:

- **Field-name agreement.** Because the frontend mocks `fetch`, a field spelled
  differently on either side would leave both suites green.
- **The `message.reactions` socket event** end-to-end. Both sides are tested in
  isolation; the event has never been observed flowing.
- **Arm-on-read firing from the real client** — the chat page calls `markRead`
  in an effect, and that chain is untested as a whole.

### Two tests that earned their keep

`test_does_not_go_n_plus_1` counts SQL statements and asserts the number does
not grow with the number of conversations. When attachments and reactions were
added to the message schema, the sidebar's preview started lazy-loading both per
row. That test caught it immediately; the fix was eager-loading.

The shortcut sheet's binding test asserts every documented row maps to a real
key press. It found a row advertising `Ctrl+Shift+L` for a shortcut that did
nothing at all.

---

## 8. Known gaps

- **No E2E coverage**, as above — the single largest gap.
- **No delete-message endpoint.** The `deleted_at` column and the "This message
  was deleted" bubble both exist, but nothing in the API can set it. `API.md`
  documented a `DELETE /messages/{id}` that was never built.
- **Favorites and chat colours are per-device.** Deliberate, given no migration
  tooling, but not what Signal does.
- **Settings → default timer for new chats** is disabled. It needs a per-user
  preference applied at conversation creation, which is a separate feature from
  the working per-chat timer.
- **No admin promotion.** A role is set at group creation or by automatic
  succession; there is no way to hand someone else the keys deliberately.
- **The `muted` column exists but is unused** — Mute is a placeholder.
- **One unhandled error in the frontend suite.** `layout.test.tsx` stubs every
  fetch with `[]`, so `loadCurrentUser` hands an array to `setUser` and the
  avatar calls `.trim()` on `undefined`. Test-harness noise, not product code,
  but it should be cleaned up.
- **Single backend process.** Horizontal scaling would need Redis pub/sub in
  place of the in-memory connection manager.

---

## 9. Running it

```bash
make setup    # backend venv + frontend deps
make db       # create and seed
make run      # api on :8000, web on :3000
```

Any phone number works; the code is `123456`. To watch ticks, typing and
presence move live, sign in as two of the seeded accounts in separate browser
profiles:

| Name | Number |
|---|---|
| Alice Chen | `+1 555 000 0001` |
| Bob Martinez | `+1 555 000 0002` |
| Carol Nwosu | `+1 555 000 0003` |
| Dave Kim | `+1 555 000 0004` |
| Erin Patel | `+1 555 000 0005` |

You need a second person to see the read-triggered timer arm, since it waits on
someone else reading.

Deployment is one Docker image on Render. The free plan allows no persistent
disk, so the database lives in the container and is rebuilt from the seed on
every boot: demo data is always present, and anything a visitor creates is lost
when the instance restarts. Moving to a paid plan with a disk needs only a
`plan` and `disk` block — the image already points the database at `/data`.
