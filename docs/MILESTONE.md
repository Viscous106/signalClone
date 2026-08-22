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
- [ ] Register with phone number or username
- [ ] Mocked OTP verification (fixed code)
- [ ] Display name + profile avatar
- [ ] Login / logout, session persistence

### M2 — Contacts & Conversation List
- [ ] Left-hand conversation list, sorted by most recent activity
- [ ] Search conversations and contacts
- [ ] Add a new contact
- [ ] Unread badge + last-message preview
- [ ] Online / last-seen indicators (mocked)

### M3 — 1:1 Messaging
- [ ] Send/receive text in real time (WebSocket)
- [ ] Message timestamps
- [ ] Delivery / read receipts (single / double check)
- [ ] Typing indicators
- [ ] Status: sending → sent → delivered → read
- [ ] All messages persisted in DB

### M4 — Group Messaging
- [ ] Create group (name + members)
- [ ] Send/receive group messages
- [ ] View group members
- [ ] Add / remove members (admin controls)
- [ ] Group data + messages persisted

### M5 — Signal Experience (UI/UX parity)
- [ ] Layout: conversation list + chat pane
- [ ] Message bubbles and threading
- [ ] Forms, modals, search, filters
- [ ] Notifications / toasts
- [ ] Settings placeholders (privacy, notifications, appearance)

### M6 — Placeholders ("Coming Soon" is enough)
- [ ] Voice / video calls
- [ ] Stories
- [ ] Linked devices
- [ ] Real end-to-end encryption

### M7 — Ship
- [ ] Seed data: multiple users, conversations, messages
- [ ] README: setup, stack, architecture, DB schema, API overview, assumptions
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
