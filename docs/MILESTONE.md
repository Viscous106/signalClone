# Signal Clone — Milestone Reference

Secure Messaging Platform (SDE Fullstack Assignment). Single source of truth for scope.
Build order in [PLAN.md](./PLAN.md) · design in [ARCHITECTURE.md](./ARCHITECTURE.md) · [SCHEMA.md](./SCHEMA.md) · [API.md](./API.md) · visual target in [SIGNAL-UI-REFERENCE.md](./SIGNAL-UI-REFERENCE.md) + [UI-SPEC.md](./UI-SPEC.md).
Goal: **look, feel and behave like Signal.** Encryption is mocked, not real.

## Stack (fixed)

| Layer | Choice |
|---|---|
| Frontend | Next.js (TypeScript) |
| Backend | Python — FastAPI or Django |
| DB | SQLite (own schema design) |
| Realtime | WebSockets |

## Milestones

### M1 — Auth / Onboarding
- [x] Register with phone number or username
- [x] Mocked OTP verification (fixed code)
- [x] Display name + profile avatar
- [x] Login / logout, session persistence

### M2 — Contacts & Conversation List
- [x] Left-hand conversation list, sorted by most recent activity
- [x] Search conversations and contacts
- [x] Add a new contact
- [x] Unread badge + last-message preview
- [x] Online / last-seen indicators (mocked)

### M3 — 1:1 Messaging
- [x] Send/receive text in real time (WebSocket)
- [x] Message timestamps
- [x] Delivery / read receipts (single / double check)
- [x] Typing indicators
- [x] Status: sending → sent → delivered → read
- [x] All messages persisted in DB

### M4 — Group Messaging
- [x] Create group (name + members)
- [x] Send/receive group messages
- [x] View group members
- [x] Add / remove members (admin controls)
- [x] Group data + messages persisted

### M5 — Signal Experience (UI/UX parity)
- [x] Layout: conversation list + chat pane
- [x] Message bubbles and threading
- [x] Forms, modals, search, filters
- [x] Notifications / toasts
- [x] Settings placeholders (privacy, notifications, appearance)

### M6 — Placeholders ("Coming Soon" is enough)
- [x] Voice / video calls
- [x] Stories
- [x] Linked devices
- [x] Real end-to-end encryption

### M7 — Ship
- [x] Seed data: multiple users, conversations, messages
- [x] README: setup, stack, architecture, DB schema, API overview, assumptions
- [ ] Public GitHub repo with `frontend/` and `backend/`
- [ ] Deployed live demo (Vercel / Render / Railway / etc.)
- [ ] Submit repo link + demo link

## Bonus (only after M1–M7)
Attachments · emoji reactions · reply/quote · disappearing messages · dark mode · responsive (mobile/tablet/desktop) · keyboard shortcuts

## Non-negotiables
- UI must closely resemble Signal — study the real app before building.
- DB schema is designed by us and **is evaluated**.
- Original work only. Plagiarism from existing repos = disqualification.
- Must be able to explain every line of code in the interview.

## Graded on
Functionality · UI/UX fidelity · DB design · Backend/API design · Code quality · Modularity · Code understanding
