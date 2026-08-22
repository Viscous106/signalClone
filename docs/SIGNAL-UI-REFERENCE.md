# Signal UI Reference

Visual spec extracted from Signal's own source and public docs. This is the target for the UI/UX grading criterion.

> **What we are cloning.** signal.org is the *marketing site* — a different design language (illustrations, hero copy, download buttons). The assignment targets the **messenger interface**, i.e. Signal Desktop. Don't take styling cues from signal.org.
>
> **Plagiarism guard.** Everything below is measurements and color values — facts about how the app looks, gathered so we can rebuild it. Do not copy code from `signalapp/Signal-Desktop`; the assignment disqualifies for that. Read specs, write our own components.

## Layout — three panes, not two

Signal Desktop is a 80px icon rail + conversation list + chat pane.

```
┌──────┬─────────────────────┬──────────────────────────────┐
│ 80px │  conversation list   │  chat pane                   │
│ rail │  72px rows           │  52px header                 │
│      │                      │  ─────────────────────────   │
│ chats│  ┌──┐ Name    12:04  │   messages, 6px apart        │
│ calls│  │48│ preview…   (2) │                              │
│ story│  └──┘                │  ─────────────────────────   │
│      │                      │  composer, 42px min-height   │
│ [me] │                      │                              │
└──────┴─────────────────────┴──────────────────────────────┘
```

| Element | Value |
|---|---|
| Nav rail width | `80px` |
| Conversation list row height | `72px` |
| List horizontal padding | `11px` |
| Header height | `52px` |
| Composer min-height | `42px`, `10px` vertical padding |
| Scrollbar width | `9px` |

The rail holds Chats / Calls / Stories icons and the user's avatar at the bottom. Calls and Stories are our "Coming Soon" stubs (M6) — but the rail must still be there, or the app reads as a generic chat clone.

## Message bubbles

| Property | Value |
|---|---|
| Border radius | `18px` (`4px` on the collapsed corner when messages group) |
| Max width | `min(306px, 100% - 38px)` — a hard pixel cap, not a percentage |
| Padding | `8px` vertical, `12px` horizontal |
| Gap between messages | `6px` top and bottom |
| Text | 14px / 20px, letter-spacing `-0.08px` |
| Timestamp | 11px / 14px, `3px` margin-top, 60% opacity |

The `306px` cap is the single most recognizable thing about Signal's message list — a percentage-based bubble immediately looks wrong on a wide window.

Consecutive messages from one sender group together: the shared vertical corner collapses from 18px to 4px, and only the last bubble in the run shows a timestamp.

## Colors — current design tokens

Signal's live token set (`ts/axo/_tailwind-theme/colors.css`). Alpha-based labels, so text works over any surface.

| Token | Light | Dark |
|---|---|---|
| Outgoing bubble | `#2267F5` | `#2267F5` |
| Incoming bubble | `#EBEBEB` | `#323232` |
| Surface primary (app bg) | `#FAFAFA` | `#191919` |
| Surface secondary (panels) | `#F5F5F5` | `#1E1E1E` |
| Label primary (text) | `#000` @ 90% | `#FFF` @ 90% |
| Label secondary (muted) | `#000` @ 60% | `#FFF` @ 60% |
| Border primary | `#000` @ 6% | `#FFF` @ 6% |
| Accent fill | `#4655FF` | `#5563FF` |
| Brand / logo | `#3B45FD` | `#3B45FD` |

Legacy values still in their SCSS — use only if something looks off: ultramarine `#2C6BED`, link `#315FF4`, gray-90 `#1B1B1B`, gray-95 `#121212`, gray-05 `#E9E9E9`.

Outgoing bubble text is white @ 90%, never pure white.

**Avatar colors** — Signal assigns each contact a deterministic bg/fg pair from a fixed palette, used behind initials when there's no photo. Ours: hash the user id into this list.
`#336BA3` blue · `#6F6A58` burlap · `#CF163E` crimson · `#3B7845` forest · `#6058CA` indigo · `#AA377A` plum · `#71717F` steel · `#8F616A` taupe · `#077D92` teal · `#C73F0A` vermilion · `#9932C8` violet · `#1D8663` wintergreen

## Typography

**Inter** throughout. Load via `next/font/google` — weights 400, 500, 600.

| Role | Size / line-height | Weight | Tracking |
|---|---|---|---|
| Title 1 | 26 / 32 | 600 | -0.56px |
| Title 2 | 20 / 26 | 600 | -0.34px |
| Body 1 — message text, list name | 14 / 20 | 400 / 600 | -0.08px |
| Body 2 — list preview, subtitle | 13 / 18 | 400 / 600 | -0.03px |
| Subtitle / body-small | 12 / 16 | 400 / 600 | 0 |
| Caption — timestamps | 11 / 14 | 400 / 600 | +0.06px |

Negative tracking on the larger sizes is subtle but it's part of why Signal looks tight rather than generic.

## Conversation header

`52px` tall. 32px avatar, `12px` gap, name in body-1-bold, subtitle in body-2 at label-secondary (member count for groups, last-seen for direct). Action buttons on the right: video, voice, search, kebab menu — all 4px radius, all stubs except search.

## Message status — the tick marks

Confirmed against Signal's own description:

| State | Icon |
|---|---|
| sending | spinner |
| sent | one outline ✓ |
| delivered | two outline ✓✓ |
| read | two **filled** ✓✓ |

"Filled" is the real distinction, not a color change — Signal fills the checks in rather than turning them blue. Read receipts are a mutual opt-in: if either side disables them, delivered is as far as it goes. Worth a settings toggle in M5 for authenticity.

## Reference sources
- [signal.org](https://signal.org/) — marketing site; nav, footer, download links
- [Brand guidelines](https://signal.org/brand/) — logo clear space is 0.5× the logo, never render the glyph below 26×26px, no rotating/stretching/recoloring
- `signalapp/Signal-Desktop` — `stylesheets/_variables.scss`, `_mixins.scss`, `_modules.scss`, `ts/axo/_tailwind-theme/colors.css` (specs only, no code)
- [Read receipts](https://support.signal.org/hc/en-us/articles/360007059812-Read-Receipts) · [delivery status](https://support.signal.org/hc/en-us/articles/360007320751-How-do-I-know-if-my-message-was-delivered-or-read)
