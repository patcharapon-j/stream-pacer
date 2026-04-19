# Stream Pacer UI Redesign — Design Spec

**Date:** 2026-04-19
**Scope:** Visual redesign of three existing surfaces + one new feature (Dire Peril).
**Aesthetic:** Arknights "Operator Panel" for the base module (clipped parallelogram corners, amber accent, numeric index markers, grain texture). Dire Peril uses a companion register — royal purple with a red touch, Japanese kinetic-cut typography aesthetic, English-only content.

## 1. Goal

Elevate the three on-screen surfaces of the Stream Pacer module to feel like a single premium tactical module, not a generic Foundry dialog. Add a new GM signal — **Dire Peril** — that delivers a dramatic full-screen kinetic-typography reveal and then parks a persistent corner indicator until the GM dismisses it.

## 2. In / Out of Scope

**In scope**
- `#stream-pacer-hud` / `#stream-pacer-container` — the floating HUD panel (visual redesign + new button)
- `.stream-pacer-overlay` — the bottom ticker (visual redesign)
- `.stream-pacer-hand-bar` — the top hand-raise notification bar (visual redesign)
- **New: Dire Peril** — GM button, full-screen animation, persistent corner indicator, socket state sync

**Out of scope**
- Exempt Users settings dialog (`templates/exempt-users.hbs`) — unchanged
- Existing module behavior: socket sync patterns, audio cue triggers, state management, draggability, exempt-user hiding — the redesign rides on top of all of it. New Dire Peril state uses the same patterns but is additive.
- `scripts/AudioManager.js`, `scripts/settings.js`, `scripts/module.js` — not touched for the visual redesign. `scripts/PacerManager.js` and `scripts/socket-handler.js` gain **only** the additions needed for Dire Peril (new state field, new message types); existing pathways stay as-is.
- `module.json` — not touched

## 3. Design Tokens

All tokens live on `:root` in `styles/stream-pacer.css`, replacing the current `--sp-*` set.

### 3.1 Palette

| Token | Value | Use |
|---|---|---|
| `--sp-ink-0` | `#06080b` | outer shadow base |
| `--sp-ink-1` | `#0f131a` | panel gradient bottom |
| `--sp-ink-2` | `#151a22` | panel gradient top |
| `--sp-ink-3` | `#1e2530` | hover/lift |
| `--sp-text` | `#e8ecf0` | primary text |
| `--sp-muted` | `#6a7684` | grip, quiet icons |
| `--sp-muted-2` | `#8a96a4` | section labels, secondary |
| `--sp-line` | `rgba(255,255,255,0.06)` | dividers |
| `--sp-line-strong` | `rgba(255,255,255,0.10)` | button borders |
| `--sp-amber` | `#e4b055` | primary accent, engaged, soft signal |
| `--sp-amber-dim` | `rgba(228,176,85,0.22)` | amber band borders |
| `--sp-cyan` | `#47c8ff` | GM badge, floor open |
| `--sp-blue` | `#5aa3f0` | hand raised |
| `--sp-purple` | `#a684ff` | need time |
| `--sp-green` | `#64c08f` | ready |
| `--sp-red` | `#ef6464` | countdown critical |
| `--sp-warn` | `#f0a850` | countdown warning |
| `--sp-peril` | `#a52dc0` | Dire Peril primary (royal purple, red-leaning) |
| `--sp-peril-deep` | `#3d0848` | Dire Peril shadow |
| `--sp-peril-bright` | `#f3b8ff` | Dire Peril highlight |
| `--sp-peril-glow` | `rgba(175,45,185,0.55)` | Dire Peril glow layer |
| `--sp-peril-red` | `#ff2e5a` | Dire Peril red-touch accent (flash, strike, slash) |
| `--sp-peril-red-glow` | `rgba(255,46,90,0.45)` | Dire Peril red glow layer |

Engaged and Soft Signal both live on amber because engaged is the default "active-participant" state and soft signal is the default attention-cue — keeping them aligned with the primary accent reinforces the system's identity.

Dire Peril gets its own color family (royal purple + red touch) because it is the only catastrophic signal in the system. It must read instantly distinct from the standard amber/cyan/red signals. Purple is not used anywhere else at high saturation (`--sp-purple` is a soft lavender reserved for the Need Time chip tint, which is low-contrast and never appears near the peril treatments).

### 3.2 Typography

Load via `@import` at the top of `styles/stream-pacer.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
```

| Role | Family | Weight | Size | Tracking |
|---|---|---|---|---|
| Title | Rajdhani | 600 | 10.5px | 3.5px |
| Section label | Rajdhani | 600 | 9px | 2.5px |
| Chip text | Rajdhani | 500 | 11px | 0.3px |
| Signal message | Rajdhani | 700 | 10.5–13px | 2–3px |
| Index markers (`01`, `NOTICE/03`) | JetBrains Mono | 500 | 8.5–10px | 2px |
| Countdown numbers | JetBrains Mono | 700 | 14–16px | 1px |

Fallback chain: `'Rajdhani', 'Signika', sans-serif` (Signika is Foundry's default; form remains legible if Google Fonts is unreachable).

### 3.3 Shape

No `border-radius` anywhere. All corners use `clip-path`:

- Panel: 14px diagonal cut at top-left and bottom-right
- Buttons: 5px diagonal cut at top-left and bottom-right
- GM role badge: 4px chevron cut
- Ticker/handbar: no clip (full-width gradient bleed)

### 3.4 Spacing

- Panel width: 300px (was 200px max)
- Panel internal horizontal padding: 18px left / 14px right
- Section vertical padding: 10px top / 12px bottom
- Chip padding: 3px 8px 3px 7px
- Chip gap: 4px
- Button grid: 4 columns, 4px gap, 30px tall buttons
- Ticker height: 38px
- Handbar height: 46px

## 4. Component Specs

### 4.1 Pacer HUD Panel

**Container** (`#stream-pacer-container`)
- `clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)`
- Background: `linear-gradient(180deg, var(--sp-ink-2), var(--sp-ink-1))`
- Box shadow stack: outer drop (14px 40px rgba(0,0,0,.55)), inset top highlight, inset bottom shadow, 1px amber ring
- `backdrop-filter: blur(6px)`
- `::before` — grain pseudo: two layered `repeating-linear-gradient` (2px vertical, 22px diagonal) with `pointer-events: none`
- `::after` — 1px top inner-highlight rule, positioned below the clip
- Ambient `panel-drift` 14s animation cycles outer shadow intensity

**Left accent stripe**
- New empty `<div class="sp-accent"></div>` injected as the first child of `#stream-pacer-container` in `templates/pacer-hud.hbs` (the container's `::before` is reserved for the grain overlay and `::after` for the top highlight rule).
- Absolutely positioned, 2px wide, `top:0 bottom:14px left:0`
- `linear-gradient(180deg, var(--sp-amber), rgba(228,176,85,0.1))`
- `box-shadow: 0 0 8px rgba(228,176,85,0.4)`
- Decorative 10×1px amber notch tick via `.sp-accent::after` at y≈56px

**Header** (`.pacer-header`)
- Drag grip → index marker (`01` JetBrains Mono amber) → title (Rajdhani 600, 3.5px tracking) → GM badge
- GM badge: `linear-gradient(135deg, amber, #c0913a)`, clip-path chevron 4px, 0 0 8px amber glow

**Sections** (`.p-sec`, new wrapping div)
- Wraps the operators list and the command controls each in their own block, divided by `border-bottom: 1px solid var(--sp-line)`.
- Each section leads with `.p-lbl`: JetBrains Mono number + Rajdhani label + fading hairline rule.

**Operator chips** (`.player-status`)
- 2px left border in status color
- Status-specific background/glow:
  - engaged: amber border, amber 5% fill
  - hand-raised: blue border, gradient 25%→8% fill, 14px blue glow, `hand-pulse` 1.6s animation, `::after` shimmer sweep 2.6s
  - ready: green border, 8% fill
  - need-time: purple border, 8% fill

**Signal band** (`.pacer-signal`)
- Rendered only when a signal is active. Position unchanged from current template: GM view shows it between Operators and the GM command row; player view shows it below the player's own status buttons.
- Border top+bottom amber-dim, gradient fill amber 18%→4%
- `::after` shimmer sweep 4s, `signal-glow` 3s inset pulse
- Icon drop-shadow 6px amber
- Countdown number right-aligned, JetBrains Mono 14px 700, amber text-shadow

**Buttons** (`.status-btn`, `.gm-btn`)
- 30px tall, clip-path 5px diagonal cut
- Background: `linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))`
- `::before` 1px top highlight rule
- Hover: `transform: translateY(-1px)`, brighten gradient, border opacity 0.22
- Active press: `transform: translateY(0)`, `filter: brightness(0.9)`
- Active state gains 12px color-matched outer glow + color-matched border + 2.4s pulse animation for soft-signal button

**Urgency escalation** (`.countdown-active.urgency-warning`, `.urgency-critical`)
- warning: amber → orange shift, 2s `pulse-warning`
- critical: red, 1s `pulse-critical`, countdown numbers flash 0.5s

### 4.2 Bottom Ticker (`.stream-pacer-overlay`)

**Container**
- Fixed bottom, full width, 38px tall
- Base gradient: solid `rgba(20,24,32,0.96)` center 7%→93%, fading to transparent at edges
- Box shadow: top drop 4px 18px black + inset 1px top highlight
- `::before` scan-line overlay (0deg repeating gradient, 2-3px)

**Tint pseudo** (`.tint` inner element, or overlay `::after`)
- Signal-specific color band: 16%→8%→16% horizontal gradient, softened at edges
- Re-tinted per signal type:
  - soft-signal: amber
  - countdown: red
  - floor-open: cyan
  - urgency-warning: orange
  - urgency-critical: red + `ticker-glow` 1s animation

**Top rail** (`.rail-t`, new element or `::after`)
- 1px hairline at top, signal-colored, with 8px color-matched box-shadow

**Scrolling content** (`.overlay-content`)
- `mask-image: linear-gradient(90deg, transparent, black 5%, black 95%, transparent)` for clean edge fade
- `ticker-scroll` 28s linear infinite, translateX(0 → -50%)
- Duplicated segments for seamless loop
- Segment structure: `NOTICE / 0N` (JetBrains Mono signal-colored) → icon (FA signal-colored with drop-shadow) → message (Rajdhani 700 uppercase, 3px tracking) → countdown (JetBrains Mono 15px bold, only for countdown variant) → diamond separator (6×6px rotated 45°, signal-colored with glow)

### 4.3 Hand-Raise Bar (`.stream-pacer-hand-bar`)

**Container**
- Fixed top, full width, 46px tall
- Multi-stop gradient: `linear-gradient(90deg, transparent 0%, rgba(15,19,26,0.55) 3%, rgba(30,80,140,0.85) 8%, rgba(70,140,220,0.92) 50%, rgba(30,80,140,0.85) 92%, rgba(15,19,26,0.55) 97%, transparent 100%)`
- Box shadow: 4px 18px black drop + inset 1px top white-22% highlight + inset 1px bottom black-30% shadow
- Hidden state: `opacity: 0; visibility: hidden; transform: translateY(-100%)`
- Active: slide-in + `handbar-breath` 3s brightness cycle
- `::before` grain (vertical + diagonal)
- `::after` shimmer sweep 5s (40% wide, left:-50% → 150%)

**Decorative edge rules** (`.edge-t`, `.edge-b`, new elements)
- Top: 1px white-35% hairline at 7%→93%
- Bottom: 1px black-35% hairline at 7%→93%

**Content row** (`.hand-bar-content`)
- Centered flex row, 18px gap:
  1. `PRIORITY / 01` index chip — JetBrains Mono 10px 3px tracking, black-35% background, chevron clip-path, 2px white-50% left border
  2. Hand icon — 22px FA `fa-hand`, 10px white drop-shadow, `hb-icon` 1.6s bounce+rotate animation
  3. Player names — Rajdhani 700 17px uppercase 4px tracking, layered text-shadow (10px white + 24px blue + 4px black)
  4. `// HAND RAISED` trailing tag — JetBrains Mono 10px 2px tracking, white-75%

Note: If multiple names, they remain comma-joined as in current implementation — the index chip stays fixed at `PRIORITY / 01`.

### 4.4 Dire Peril

A new GM-only signal that declares a high-lethality encounter state. Unlike Soft Signal, Countdown, and Floor Open — which are mode toggles — Dire Peril is a single dramatic declaration that plays a full-screen animation once, then leaves a persistent corner indicator visible until the GM explicitly dismisses it.

#### 4.4.1 Behavior

- GM-only trigger; ignored if received from a non-GM client.
- State field `direPerilActive: boolean` added to the module's synced state. Persisted through `game.settings` so it survives reloads.
- Broadcast via a new socket message type `peril:declare`. Non-exempt clients receive it and play the full-screen animation, then show the corner indicator. Exempt users (streaming overlay accounts) receive the broadcast but, per existing exempt logic, do not render either the animation or the indicator. (Flagged as an open question — see §9.)
- A second socket message type `peril:dismiss` clears the state and hides the indicator on all clients.
- Late-joining clients read the persisted state on init and, if active, show the **indicator only** (the animation is not replayed — it is a one-shot cinematic).
- The Reset All command (`reset-all`) also clears Dire Peril.
- Scene change does not clear Dire Peril automatically; it only clears via GM dismiss or Reset All (matches the semantic that peril is about narrative encounter state, not scene pacing).

#### 4.4.2 GM Button

Added to the `.pacer-gm-controls` row as the 5th button (after Soft, Countdown, Floor, before Reset). The grid changes from 4 columns to **5 columns** for GMs — the button treatments compress slightly but remain legible at 30px height. (Template changes in §7.)

Visual treatment:
- Clip-path 5px cut corners (same as other GM buttons)
- Border `1px solid rgba(175,45,185,0.55)`
- Color: `--sp-peril-bright`
- Icon: `fa-solid fa-skull`
- Hover: color `#fff`, box-shadow `0 0 12px var(--sp-peril-glow), inset 0 0 8px var(--sp-peril-red-glow)`
- Tooltip: `STREAM_PACER.DirePerilTooltip` → "Declare Dire Peril — death is on the table"
- No active state (button is one-shot trigger, not a toggle). If `direPerilActive === true`, the button is disabled (reduced opacity 0.35, `pointer-events: none`). This prevents re-triggering the animation. The GM dismisses via the indicator.

#### 4.4.3 Full-Screen Animation

**Container:** new fixed-position overlay `.stream-pacer-peril-stage`, `z-index: 9999` (above HUD, ticker, and handbar). Full viewport, `overflow: hidden`. Hidden by default (`opacity: 0; visibility: hidden`). Added to `<body>` on module init, content rendered from `templates/peril-stage.hbs` on `peril:declare`.

**Lifecycle:** on declare, the stage content is rendered (via `renderTemplate`), appended to the stage container, and the stage receives `.playing` class which triggers the one-shot animation sequence (§4.4.3 timing). After 5500ms a `setTimeout` removes `.playing`, fades the stage out over 1000ms (the fade-out window is already inside the 5500ms budget — see timing table row 4500→5500ms), removes the inner content from the DOM, and mounts the indicator at the 4700ms mark (200ms into fade-out). The stage container itself stays in the DOM (empty, hidden) for reuse on the next declaration.

**Typography aesthetic:** Japanese kinetic-cut inspired — rapid letter flashes, big slam-in words, running data lines, vertical upright letter columns, diagonal accent slashes — but **all content is English** (no kanji, katakana, or Japanese characters).

**Layer tree (back to front):**

```
.stream-pacer-peril-stage.playing
  .peril-wash              /* radial purple→black backdrop */
  .peril-watermark         /* giant stroked outline "PERIL" word, low alpha */
  .peril-slash.a           /* diagonal purple-to-red slash, upper-left */
  .peril-slash.b           /* diagonal slash, lower-right */
  .peril-dot-pair.l        /* 3 small dots vertical, left */
  .peril-dot-pair.r        /* 3 small dots vertical, right */
  .peril-run.line-t        /* horizontal running data line, top */
  .peril-run.line-b        /* horizontal running data line, bottom */
  .peril-vcol.l            /* vertical upright English letter column, left */
  .peril-vcol.r            /* vertical upright English letter column, right */
  .peril-flash-stage       /* center absolute, contains .l × 9 letter spans */
  .peril-impact            /* full-screen white+red radial flash */
  .peril-title             /* final settled composition */
    .peril-tag             /* "// OPERATIONAL HAZARD //" */
    .peril-word-dire       /* "DIRE" */
    .peril-rule            /* thin horizontal rule between words */
    .peril-word-peril      /* "PERIL" */
    .peril-sub             /* "// DEATH IS ON THE TABLE //" */
```

**Timing** — total duration 5500ms, single play-through:

| Timeframe (ms) | Event |
|---|---|
| 0 → 220 | `.peril-wash` fades in (radial purple→black) |
| 220 → 1400 | **Letter flash cascade.** Each letter of `DIRE PERIL` appears center-stage for ~100–120ms, then hides. Sequence: D (220), I (320), R (420), E (520), gap (620→720), P (720), E (820), R (920), I (1020), L (1120). Each letter is 280px Rajdhani 700 uppercase white with layered purple+red glow text-shadow. Entry scale 1.15→1, exit scale 1→0.9. |
| 1400 → 1500 | `.peril-impact` radial white+red flash (100ms) |
| 1500 → 2000 | `.peril-word-dire` slams in from `translateX(-800px)` → `0`, opacity 0→1, cubic-bezier(0.2,1,0.3,1). Simultaneously `.peril-word-peril` slams from `translateX(800px)` → `0`. Words stacked vertically (DIRE above, PERIL below) at screen center. |
| 2000 → 2200 | `.peril-tag` fades in above title; `.peril-rule` draws from 0 to 360px wide between the words. |
| 2200 → 2600 | `.peril-sub` types on via `max-width: 0 → 520px` with `steps(40)` easing. |
| 2600 → 3000 | `.peril-slash.a`, `.peril-slash.b`, `.peril-dot-pair.l/r` fade in. `.peril-run.line-t/b` start scrolling. `.peril-vcol.l/r` start scrolling. |
| 3000 → 4500 | **Hold.** All elements remain; running text continues to scroll; title breathes subtly (filter brightness 1.0 ↔ 1.12). |
| 4500 → 5500 | Entire stage fades out (opacity 1 → 0, transform scale 1 → 0.98), runs 1000ms. Indicator fades in at 4700ms (200ms into fade-out). |

**Running text content** (both horizontal lines scroll continuously; the tracks are duplicated twice for seamless loop):

- Line top: `HAZARD CLASS [LETHAL] // PROTOCOL ENGAGED // ENCOUNTER [CRITICAL] // DEATH IS ON THE TABLE //` — the bracketed words colored with `--sp-peril-red`.
- Line bottom: `T-0 // THREAT.LEVEL [MAX] // CASUALTY.RISK [CERTAIN] // COMMAND [ENGAGE] //` — same red treatment on bracketed emphasis.

**Vertical columns** (both use `writing-mode: vertical-rl; text-orientation: upright;` so English letters stack vertically, one per line, reading top-to-bottom):

- Column left: `H A Z A R D / L E T H A L / E N G A G E D`, repeated.
- Column right: `T H R E A T / R I S K / A L E R T`, repeated, animated in reverse.

**Title copy** (all localizable):

- Tag: `// OPERATIONAL HAZARD //` — monospace `--sp-peril-red`
- Word 1: `DIRE`
- Word 2: `PERIL`
- Subtitle: `// DEATH IS ON THE TABLE //` — monospace `--sp-peril-bright`

#### 4.4.4 Persistent Corner Indicator — "Framed Stamp"

Renders immediately after the full-screen animation fades out and stays until the GM dismisses. Also renders on late-join if `direPerilActive === true`.

**Container:** `.stream-pacer-peril-indicator`, `position: fixed; bottom: 20px; right: 20px; z-index: 100` (same layer as HUD, below the peril stage). Min-width 210px.

**Structure:**

```
.stream-pacer-peril-indicator
  .peril-ind-bar           /* 2px vertical left stripe, gradient purple→red, pulse animation */
  .peril-ind-icon          /* 34×34 clipped box, red-bordered, contains fa-skull */
  .peril-ind-stack         /* 2-row label */
    .peril-ind-header      /* "// HAZARD ACTIVE" — JBM 8px red */
    .peril-ind-main        /* "Dire Peril" — Rajdhani 700 12px 2.5px tracking */
  .peril-ind-dismiss       /* dismiss button, fa-xmark, tooltip "Dismiss Dire Peril" */
```

**Visual:**
- Background: `linear-gradient(180deg, rgba(45,10,90,0.96), rgba(20,4,42,0.98))`
- Border: `1px solid rgba(175,45,185,0.5)`
- Clip-path: `polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)`
- Box-shadow: `0 8px 22px rgba(0,0,0,0.55), 0 0 24px var(--sp-peril-glow)`
- Grain overlay `::before` — standard vertical 2-3px repeating gradient
- Left bar `::after` — 2px wide, full height, gradient `var(--sp-peril)` → `var(--sp-peril-red)`, pulses via `peril-bar` 1.8s ease-in-out infinite (opacity 0.85 ↔ 1.0).
- Icon box — `clip-path` 5px diagonal cut, border `1px solid var(--sp-peril-red)`, icon color `var(--sp-peril-red)` with `drop-shadow(0 0 4px var(--sp-peril-red-glow))`.
- Dismiss button — `1px solid rgba(175,45,185,0.3)`, size 18×14, font 10px, color `rgba(255,255,255,0.55)`. Hover: border bright, color white.

**Interaction:**
- Clicking the dismiss button calls `game.streamPacer.manager.dismissDirePeril()`, which flips state and emits `peril:dismiss` to all clients.
- Only the GM sees the dismiss button. For players, the indicator is display-only (no dismiss button rendered, or rendered disabled).
- Keyboard: `Escape` does NOT dismiss (to avoid accidental dismissal). Only the explicit button click.

**Entry/exit:**
- Entry: opacity 0 → 1, transform translateY(8px) → 0, over 400ms ease-out, starts 200ms into the stage's fade-out.
- Exit: reverse (opacity → 0, translateY(8px), 300ms). After animation completes, element is removed from DOM.

## 5. Animation Catalog

All durations use `ease-in-out` unless noted. Full list wired into `styles/stream-pacer.css`.

| Keyframe | Duration | Target | Purpose |
|---|---|---|---|
| `panel-drift` | 14s alternate | `#stream-pacer-container` | ambient breathing shadow |
| `shimmer-sweep` | 2–6s | chip, signal band, handbar, ticker `::after` | horizontal light wipe |
| `hand-pulse` | 1.6s | `.status-hand-raised` chip | blue glow pulse |
| `hand-icon-pulse` | 1.6s | hand chip `i` | icon drop-shadow pulse |
| `signal-glow` | 3s | `.pacer-signal` | inset amber pulse |
| `btn-pulse-amber` | 2.4s | `.soft-signal-btn.active` | active soft-signal pulse |
| `pulse-warning` | 2s | `.urgency-warning` | amber→orange pulse |
| `pulse-critical` | 1s | `.urgency-critical` | red pulse |
| `flash-critical` | 0.5s | critical countdown digits | opacity flash |
| `ticker-scroll` | 28s linear | `.overlay-content` | horizontal scroll loop |
| `ticker-glow` | 1s | `.urgency-critical` overlay | red outer pulse |
| `handbar-breath` | 3s | `.stream-pacer-hand-bar.active` | brightness 1.0 → 1.12 |
| `hb-icon` | 1.6s | handbar hand icon | bounce + rotate + glow |
| `peril-wash` | 220ms ease-in | `.peril-wash` | backdrop fade-in |
| `peril-letter` | ~120ms each | `.peril-flash-stage .l` | one-shot letter flash, 9 total, staggered delays |
| `peril-impact` | 100ms steps(1) | `.peril-impact` | single white+red flash |
| `peril-dire-slam` | 500ms cubic-bezier | `.peril-word-dire` | translateX(-800px)→0, opacity in |
| `peril-peril-slam` | 500ms cubic-bezier | `.peril-word-peril` | translateX(800px)→0, opacity in |
| `peril-rule-draw` | 200ms ease-out | `.peril-rule` | width 0→360px |
| `peril-sub-type` | 400ms steps(40) | `.peril-sub` | max-width 0→520px |
| `peril-run` | 18s linear loop | `.peril-run .run-track` | horizontal scroll |
| `peril-vcol` | 20–24s linear loop | `.peril-vcol .track` | vertical scroll |
| `peril-hold` | 1500ms hold | stage | held frame |
| `peril-fade-out` | 1000ms ease-in | `.stream-pacer-peril-stage` | final fade out |
| `peril-ind-enter` | 400ms ease-out | `.stream-pacer-peril-indicator` | fade in + translateY |
| `peril-ind-pulse` | 2.4s ease-in-out infinite | `.stream-pacer-peril-indicator` | outer glow breathe |
| `peril-ind-bar` | 1.8s ease-in-out infinite | indicator left bar | opacity 0.85 ↔ 1.0 |

### 5.1 Reduced Motion

At the end of the stylesheet:

```css
@media (prefers-reduced-motion: reduce) {
  #stream-pacer-container,
  #stream-pacer-container *,
  .stream-pacer-overlay,
  .stream-pacer-overlay *,
  .stream-pacer-hand-bar,
  .stream-pacer-hand-bar *,
  .stream-pacer-peril-stage,
  .stream-pacer-peril-stage *,
  .stream-pacer-peril-indicator,
  .stream-pacer-peril-indicator * {
    animation: none !important;
    transition: none !important;
  }
}
```

For Dire Peril specifically under reduced-motion: the full-screen stage still plays the **composition** (wash, title, tag, subtitle all appear) but all animations are skipped — the stage effectively jumps to its held state for the full duration, then fades out. Letter-flash cascade and word slams are no-ops. Indicator renders statically (no pulse).

## 6. Icon Mapping

Continue using Font Awesome 6 Solid (Foundry-native). Update icon classes in templates and scripts to their modern FA6 equivalents:

| Role | Current | New |
|---|---|---|
| Engaged | `fa-hourglass` | `fa-hourglass-half` |
| Hand raised | `fa-hand-paper` | `fa-hand` |
| Need time | `fa-brain` | `fa-brain` |
| Ready | `fa-check-circle` | `fa-circle-check` |
| Soft signal | `fa-exclamation-triangle` | `fa-triangle-exclamation` |
| Countdown | `fa-clock` | `fa-clock` |
| Floor open | `fa-microphone` | `fa-microphone` |
| Cancel | `fa-times` | `fa-xmark` |
| Reset | `fa-redo` | `fa-arrows-rotate` |
| Drag grip | `fa-grip-vertical` | `fa-grip-vertical` |
| Dire Peril | — | `fa-skull` |
| Dire Peril indicator | — | `fa-skull` |

Legacy v5 aliases still work in FA6, but updating keeps the module future-proof.

## 7. Files Touched

| File | Change |
|---|---|
| `styles/stream-pacer.css` | Full rewrite of visual layer + new Dire Peril sections (stage + indicator, ~300 additional lines) |
| `templates/pacer-hud.hbs` | Add `<div class="sp-accent"></div>` as first child of container; add `.p-sec` wrappers around operators and command; add `.p-ix` index spans in header and section labels. Signal band position is unchanged. Add 5th GM button (Dire Peril) with `skull` icon. |
| `templates/peril-stage.hbs` | **New** — Handlebars template for the full-screen Dire Peril animation stage (see §4.4.3 layer tree). |
| `templates/peril-indicator.hbs` | **New** — Handlebars template for the persistent corner indicator (see §4.4.4 structure). |
| `scripts/HandRaiseSidebar.js` | Inject `PRIORITY / 01` index chip markup + `// HAND RAISED` trailing tag |
| `scripts/PacerOverlay.js` | Prefix each ticker segment with `NOTICE / 0N` index (N derived from signal type), replace separator markup with diamond element |
| `scripts/PerilOverlay.js` | **New** — Manages Dire Peril full-screen animation lifecycle and persistent corner indicator. Exposes `show()` and `hide()`. Mounts/unmounts DOM, handles `animationend`/timeout completion, wires dismiss handler to manager. |
| `scripts/PacerHUD.js` | Wire click handler for new `data-action="declare-peril"` GM button; delegate to `PacerManager.declareDirePeril()`. Render the Dire Peril button as disabled when `direPerilActive === true`. |
| `scripts/PacerManager.js` | Add `direPerilActive: boolean` state field (persisted via `game.settings`). Add methods `declareDirePeril()` (GM-only, sets state, emits socket, triggers `PerilOverlay.show()` locally), `dismissDirePeril()` (GM-only, clears state, emits socket, triggers `PerilOverlay.hide()` locally). Include `direPeril` clear in the existing `resetAll()` pathway. |
| `scripts/socket-handler.js` | Add new message types `peril:declare` and `peril:dismiss`. On receive: skip if exempt user (unless §9 open question changes this); call `PerilOverlay.show()` or `.hide()` as appropriate. Non-GM clients cannot originate these messages. |
| `scripts/module.js` | Register `PerilOverlay` on `ready` hook, expose as `game.streamPacer.peril`. Read `direPerilActive` from settings on init and call `PerilOverlay.showIndicatorOnly()` if true (late-join path — indicator only, no animation). |
| `languages/en.json` | New keys: `STREAM_PACER.SectionOperators`, `STREAM_PACER.SectionCommand`, `STREAM_PACER.Priority`, `STREAM_PACER.Notice`, `STREAM_PACER.HandRaisedTag`, `STREAM_PACER.DirePerilTooltip`, `STREAM_PACER.DirePerilTag` ("// OPERATIONAL HAZARD //"), `STREAM_PACER.DirePerilTitleDire`, `STREAM_PACER.DirePerilTitlePeril`, `STREAM_PACER.DirePerilSubtitle` ("// DEATH IS ON THE TABLE //"), `STREAM_PACER.DirePerilHazardActive` ("// HAZARD ACTIVE"), `STREAM_PACER.DirePerilDismiss`, `STREAM_PACER.DirePerilRunTop`, `STREAM_PACER.DirePerilRunBottom` (the two horizontal running data strings), `STREAM_PACER.DirePerilColumnLeft`, `STREAM_PACER.DirePerilColumnRight` (vertical upright columns) |

## 8. Fallback & Compatibility

- Foundry v13 runs Electron/Chromium ≥120 → `clip-path`, `backdrop-filter`, `mask-image`, and CSS `@import` of Google Fonts are all supported.
- Offline/private environments: Google Fonts fails silently; text falls back to Signika (already loaded by Foundry) and system monospace. Layout remains stable because all sizes are absolute px.
- `prefers-reduced-motion` disables all animations and transitions (section 5.1).

## 9. Open Implementation Details

These do not block the design, but the implementer should resolve them:

1. **200 → 300px panel width.** Current HUD default right offset is `310px` (to clear the chat panel). A 300px panel at that offset fits. Verify visually that on lower-resolution displays the panel still clears chat; if not, drop width to 280px and re-tighten typography.
2. **Signal band placement.** Currently rendered only when active; in the new design it lives between Operators and Command for GMs. When no signal is active, the command section sits directly below operators — the `.p-sec` border-bottom on operators handles that transition naturally.
3. **Grain vs existing scan-line.** The current `#stream-pacer-container::before` scan-line overlay is replaced by the new two-layer grain pseudo. Remove the legacy rule, not merge.
4. **`PRIORITY / 01` copy.** "01" is a fixed decorative marker (there's only ever one hand-raise bar at a time). It does not index the raised player count. The actual player names remain in the names span.
5. **Dire Peril on exempt users.** Default behavior follows existing exempt-user logic: stream-overlay accounts marked exempt see neither the full-screen animation nor the indicator. The intent of the feature is a dramatic on-stream moment — which may argue for the stream-overlay account specifically receiving it. The implementer should decide between: (a) default exempt behavior (currently specified — hidden), (b) Dire Peril ignores the exempt list and shows to everyone, or (c) add a new setting `showDirePerilOnStream` that opts the overlay in. **Default for this spec is (a)** to maintain behavioral consistency with other signals; a setting can be added in a follow-up.
6. **GM control row layout at 5 buttons.** The row goes from 4 to 5 columns for GMs. At 300px panel width with 18/14px horizontal padding and 4px button gap, each button gets ~52px. This is tight but legible for icon-only buttons at 12–14px icon size. If a Cancel button is also rendered (when `hasActiveSignal === true`), the row briefly becomes 6 columns — each button drops to ~42px. If this feels cramped in testing, wrap to two rows at 6+. Do not redesign the button shape.
7. **Dire Peril indicator z-index at 100.** Sits on the same layer as the HUD. The HUD is draggable and the indicator is fixed at bottom-right. If a GM drags the HUD over the indicator, the indicator should remain visible — ensure indicator CSS specificity is such that pointer events on the indicator still work, and raise to `z-index: 101` if needed.
8. **Font loading order.** The stylesheet `@import`s Rajdhani + JetBrains Mono from Google Fonts. On slow networks, the first Dire Peril trigger could fire before fonts load and show Signika fallback. Acceptable for v1; for future polish, consider preloading in `module.js`.

## 10. Success Criteria

- All three existing surfaces share the same visual vocabulary: clipped corners, grain overlay, JetBrains Mono index markers, amber primary accent, consistent animation curves and easing.
- A GM raising a hand is impossible to miss: blue pulsing chip in the HUD + blue top-bar + shimmer + bounce — at the same time.
- Countdown urgency reads at a glance: amber calm → orange warning → red critical, with audio cue unchanged.
- Panel feels like a single premium tactical module against Foundry's canvas, not a generic framework dialog.
- **Dire Peril is a showstopper:** the full-screen animation plays once, dominates the viewport for ~5.5s, and hands off cleanly to the persistent corner indicator. Letter flash cascade is readable (~120ms per letter) and builds to the word slam — not a blur. The indicator is unmistakable, obviously purple, and clearly dismissible.
- **Dire Peril integrates cleanly:** the new GM button sits in the command row without breaking the grid. Dismissing the indicator returns the HUD to its normal state. Late-join shows the indicator but not the animation.
- Module functional behavior unchanged for existing features: drag, socket sync, state reset, exempt-user hiding, audio triggers, scene-change reset. Dire Peril is additive and follows the same patterns.
