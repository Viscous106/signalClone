# UI Spec — from the real app

Screen-by-screen detail taken from screenshots of native Signal (Linux desktop
+ Android). **Nothing here changes scope.** Features and milestones stay exactly
as [MILESTONE.md](./MILESTONE.md) and [PLAN.md](./PLAN.md) define them; this is
the visual target for work already planned.

Desktop shots are 1600×900, downscaled from 1920×1080 (×0.8333). Measured
values are divided back up. Where they can be checked against Signal's own
stylesheets they agree — the rail measured 66px → 79px against a source value
of 80px — so the inferred numbers below are trustworthy to about ±2px.

> **Gap:** the captured account was brand new, so no screenshot shows a
> populated chat list or a message thread. Bubble geometry therefore still
> comes from Signal's stylesheets (see
> [SIGNAL-UI-REFERENCE.md](./SIGNAL-UI-REFERENCE.md)), not from these images.

## Corrections to what is already built

| # | Now | Should be | Phase |
|---|---|---|---|
| 1 | Avatars: solid saturated fill + white initials | **Pastel fill + saturated initials of the same hue** (Signal's A100–A210 pairs) | 2 |
| 2 | List pane 340px | **320px** | 2 |
| 3 | New chat is a centred modal | **A panel that replaces the list in the left pane**, with a back chevron | 2 |
| 4 | Settings takes the whole window | **Rail + 320px settings nav + detail pane**; rail stays visible | 5 |
| 5 | Login is centred, full-width button | **Left-aligned title/blurb, country selector, bottom-right "Next" pill** | 1 |
| 6 | OTP is one wide input | **Six separate digit boxes, grouped 3–3 with a hyphen** | 1 |
| 7 | Empty right pane says "Select a chat" | **Signal logo + "Welcome to Signal" + nonprofit footer** | 2 |

None of these add features. They are all restyling of screens already built or
already planned.

## Avatars — the most visible fix

Signal never puts white initials on a saturated circle. Every avatar is a
**pale tint with the initials in a strong version of the same hue**. The cream
`YV` avatar in the phone shots is exactly `A180`.

| Token | Fill | Initials |
|---|---|---|
| A100 | `#E3E3FE` | `#3838F5` |
| A110 | `#DDE7FC` | `#1251D3` |
| A120 | `#D8E8F0` | `#086DA0` |
| A130 | `#CDE4CD` | `#067906` |
| A140 | `#EAE0FD` | `#661AFF` |
| A150 | `#F5E3FE` | `#9F00F0` |
| A160 | `#F6D8EC` | `#B8057C` |
| A170 | `#F5D7D7` | `#BE0404` |
| A180 | `#FEF5D0` | `#836B01` |
| A190 | `#EAE6D5` | `#7D6F40` |
| A200 | `#D2D2DC` | `#4F4F6D` |
| A210 | `#D7D7D9` | `#5C5C5C` |

These tints read the same in light and dark, which is why Signal can use one
palette for both. Implementation: store the **token name** (`"A180"`) on the
user, not a hex string, and return both halves — a single hex cannot express a
pair, and the current `avatar_color` column is doing exactly that today.

## Desktop shell

```
┌──────┬──────────────────────┬────────────────────────────────┐
│ 80px │  320px               │  chat pane (darker)            │
│ rail │  list pane           │                                │
├──────┼──────────────────────┼────────────────────────────────┤
│ ☰    │ Chats        ✎  ⋯   │  header 52px                   │
│ 💬   │ ┌──────────────────┐ │                                │
│ 📞   │ │ 🔍 Search        │ │  messages                      │
│ 🗂   │ └──────────────────┘ │                                │
│      │  72px rows           │                                │
│      │                      │  composer                      │
│ ⚙    │                      │                                │
└──────┴──────────────────────┴────────────────────────────────┘
```

The left panes sit on the lighter surface, the chat pane on the darker one —
which is the reverse of most chat apps and part of why Signal looks like Signal.

**Rail (80px).** Hamburger at the very top, then Chats / Calls / Stories, and
the settings gear pinned to the bottom. Each target is 48×48 with a 10px
radius; the active one is filled with the darker surface colour. Icons are
1.8px-stroke outlines, ~22px.

**Pane header (52px).** Title left in 20px semibold. Icons right: compose
pencil then kebab. On the Calls tab a filter icon sits to the right of the
search field instead.

**Search.** A pill on the darker surface, ~32px tall, 16px search glyph inset
left, placeholder "Search". Full width inside 12px pane padding.

## Empty states

They come in pairs — one in the list pane, one in the chat pane.

| Where | Content |
|---|---|
| List pane | Bold "No chats" over secondary "Recent chats will appear here.", centred |
| Chat pane | Signal's dashed-outline speech-bubble logo (~64px), "Welcome to Signal" in 20px semibold, then "See *what's new* in this update" with the link in accent |
| Chat pane, pinned bottom | "Signal is a 501c3 nonprofit", centred, caption size, secondary |

Calls and Stories follow the same shape: "No calls" / "Recent calls will appear
here." beside a large centred glyph and "Click 📞 to start a new voice or video
call."

## New chat panel

Not a modal. It slides over the list pane and keeps the rail.

- Header: back chevron left, **centred** title "New chat", 52px.
- Search: pill, placeholder "Name, username, or number".
- Three action rows, each a 36px circular grey icon plus a label:
  **New group**, **Find by username**, **Find by phone number**.
- Section label "Contacts" — 12px, secondary, sentence case (not uppercase).
- Contact rows ~52px: 32px avatar, name, and a small circled-person glyph after
  the name. **Note to Self** gets a notepad icon and a blue verified badge.
- On mobile the same list is grouped under single-letter headers (`F`, `N`).

## Settings

Rail stays. The list pane becomes the settings nav; the chat pane becomes the
detail.

**Nav pane.** "Settings" title, then a profile card — 40px avatar, name, phone —
on a filled rounded-lg panel. Below it the sections, each with a leading icon:
General, Appearance, Chats, Calls, Notifications, Privacy, Data usage, Backups,
Donate to Signal. The active row is a filled rounded-lg block inset ~8px from
the pane edges.

**Detail pane.** A centred column about 730px wide. The page name sits
**centred at the top** in 13px semibold. Then:

- **Row**: title (13px primary) with optional description beneath (12px
  secondary) on the left; control on the right.
- **Section header**: 13px semibold primary, with generous space above.
- **Divider**: 1px hairline at 6% opacity between sections, not between rows.
- **Checkbox**: 14px, 3px radius. Accent fill with a white tick when on, plain
  outline when off.
- **Select**: rounded-md on the lighter surface with a subtle border and a
  trailing chevron.
- **Buttons**: secondary is a grey pill ("Set up", "Export", "Change…");
  primary is an accent pill ("Donate"); destructive is a red-tinted pill with
  red text ("Turn off stories", "Delete data"); disabled is simply dimmed.
- **Link**: underlined, accent-coloured ("Learn More", "Read more").

Privacy is worth copying closely because two of its toggles are things we
actually implement: **Read receipts** and **Typing indicators**, each with the
explanatory line "If disabled, you won't see … from others."

## Dialogs

Centred, ~360px wide, rounded-xl, on the lighter surface with a heavy shadow.
Title centred and bold at the top. Body split into groups by hairline
dividers, each row an icon plus a label with its control on the right. The
confirming action is an accent pill in the **bottom-right**.

## Context menus

Rounded-lg, lighter surface, ~6px padding. Items are icon + 13px label with
generous horizontal padding; a submenu shows a trailing chevron and opens
alongside. The desktop chat-list kebab holds: View Archive, Add chat folder,
Notification profile ›, Settings.

## Mobile

Included because responsive design is a bonus item, and the phone layout is
where Signal's structure is clearest.

- **Top bar**: own avatar (32px), "Signal" in 22px, search glyph, kebab.
- **Bottom tab bar**: Chats / Calls / Stories. The active tab gets a
  pill-shaped fill behind its icon with the label beneath. Stories carries a
  red numeric badge.
- **FAB**: a **rounded square** (~56px, ~18px radius), not a circle, bottom
  right. The Stories and Chats tabs stack two — camera above pencil.
- **Empty chat list**: "No chats yet." / "Get started by messaging a friend."
  centred near the *top*, not vertically centred.
- **"Get started" cards**: a horizontally scrolling row of pastel rounded-2xl
  cards — cream, sage, lilac — each an icon over a label with a dismiss ×.
- **Kebab menu**: New group, Mark all read, Filter unread chats, Notification
  profile, Archived chats, Settings.

## Onboarding

Signal's registration is left-aligned and quiet, with the action bottom-right.

**Phone number step.** Large title "Phone number" (~30px). Blurb: "You will
receive a verification code. Carrier rates may apply." Then a country row —
flag, name, trailing chevron — over a split field: a narrow `+91` box beside
the number input, each with an underline that turns accent on focus. "Next" is
a pill in the bottom-right, dimmed until the number is plausible.

**Country picker.** Full screen, close ×, title "Your country", a search pill,
then rows of flag + name with the dial code right-aligned. Common countries
appear first, divided from the alphabetical list by a hairline.

**Verification step.** Title "Verification code", then "Enter the code we sent
to +91…", then a **"Wrong number?"** link in accent. Six digit boxes, ~52px
each, rounded-md on the lighter surface, **grouped 3–3 with a hyphen between**.
A spinner sits below while checking. Pinned at the bottom: "Resend Code
(00:55)" and "Call me (00:55)", dimmed while counting down.

For our mocked flow the country selector can be a single field, but the
**layout** — left-aligned title, blurb, bottom-right Next, 3–3 digit boxes,
"Wrong number?" — is what makes it read as Signal.
