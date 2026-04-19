# Stream Pacer UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the HUD, ticker, and hand-raise bar into an Arknights "Operator Panel" aesthetic, then add a new Dire Peril GM signal with a cinematic full-screen kinetic-typography animation and persistent corner indicator.

**Architecture:** CSS-led for the three existing surfaces (structure and behavior are 90% unchanged; the redesign is a visual rewrite plus small template additions for section wrappers and index markers). Dire Peril is a new isolated module — its own manager state field, socket events, template pair, overlay class, and CSS block — built additively on the existing patterns (same `subscribe` / `SocketHandler.emit*` shape as the other signals).

**Tech Stack:** Foundry VTT v13 (ApplicationV2, Handlebars), vanilla JavaScript ES modules, CSS3 (`clip-path`, `backdrop-filter`, `mask-image`), Font Awesome 6 (already loaded by Foundry), Google Fonts (Rajdhani + JetBrains Mono via `@import`).

**Test Strategy:** Foundry modules run only inside the Foundry Electron host; this project has no automated test harness and the redesign is primarily visual/UI. Each task uses **manual validation in Foundry** after implementation — open the world, exercise the feature, confirm the visual and behavioral change. Where a task is logic-only (Manager state, socket events), validation is console-driven (`game.streamPacer.manager.state`, `game.streamPacer.manager.declareDirePeril()`). Commit after every passing validation.

**Reference spec:** `docs/superpowers/specs/2026-04-19-ui-redesign-design.md`

---

## File Map

**Modified:**
- `styles/stream-pacer.css` — full visual rewrite + new Dire Peril block (~1400 lines total)
- `templates/pacer-hud.hbs` — section wrappers, index markers, 5th GM button, accent stripe div
- `scripts/PacerHUD.js` — one new click-handler case (`declare-peril`), disable the button when peril is active
- `scripts/PacerManager.js` — new state field, declare/dismiss methods, resetAll updates, sync updates
- `scripts/PacerOverlay.js` — ticker segment markup additions (index marker, diamond separator)
- `scripts/HandRaiseSidebar.js` — updated content markup (PRIORITY chip, trailing tag)
- `scripts/socket-handler.js` — two new event types, emit + receive
- `scripts/settings.js` — persist `direPerilActive` in `pacerState` default
- `scripts/module.js` — register `PerilOverlay`, expose in `game.streamPacer.peril`, late-join indicator restoration
- `languages/en.json` — all new copy keys
- `module.json` — version bump to 1.2.0

**Created:**
- `scripts/PerilOverlay.js` — Dire Peril stage + indicator lifecycle
- `templates/peril-stage.hbs` — full-screen animation markup
- `templates/peril-indicator.hbs` — persistent corner indicator markup

**Not touched:**
- `scripts/AudioManager.js`, `templates/exempt-users.hbs`

---

## Phase 1 — Foundation (palette, typography, legacy cleanup)

### Task 1: Update palette tokens + font imports + remove legacy scan-line rule

**Files:**
- Modify: `styles/stream-pacer.css:1-19` (replace `:root` block)
- Modify: `styles/stream-pacer.css:82-99` (remove the `#stream-pacer-container::before` scan-line block — replaced by the new grain overlay in Task 2)

- [ ] **Step 1: Replace the file header with the new font import, comment, and root tokens**

Replace lines 1–19 of `styles/stream-pacer.css` with:

```css
/* Stream Pacer — UI Redesign v1.2
   Base module: Arknights "Operator Panel" — amber primary, clipped corners, grain overlay.
   Dire Peril: royal purple + red touch, kinetic-typography full-screen reveal.
*/

@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

:root {
  /* Ink — panel background tones */
  --sp-ink-0: #06080b;
  --sp-ink-1: #0f131a;
  --sp-ink-2: #151a22;
  --sp-ink-3: #1e2530;

  /* Text */
  --sp-text: #e8ecf0;
  --sp-muted: #6a7684;
  --sp-muted-2: #8a96a4;

  /* Lines */
  --sp-line: rgba(255, 255, 255, 0.06);
  --sp-line-strong: rgba(255, 255, 255, 0.10);

  /* Primary accent — amber (engaged, soft signal, panel stripe) */
  --sp-amber: #e4b055;
  --sp-amber-dim: rgba(228, 176, 85, 0.22);
  --sp-amber-glow: rgba(228, 176, 85, 0.4);

  /* Status colors */
  --sp-cyan: #47c8ff;      /* GM badge, floor open */
  --sp-blue: #5aa3f0;      /* hand raised */
  --sp-purple: #a684ff;    /* need time */
  --sp-green: #64c08f;     /* ready */
  --sp-red: #ef6464;       /* countdown critical */
  --sp-warn: #f0a850;      /* countdown warning */

  /* Dire Peril — royal purple + red touch */
  --sp-peril: #a52dc0;
  --sp-peril-deep: #3d0848;
  --sp-peril-bright: #f3b8ff;
  --sp-peril-glow: rgba(175, 45, 185, 0.55);
  --sp-peril-red: #ff2e5a;
  --sp-peril-red-glow: rgba(255, 46, 90, 0.45);
}
```

- [ ] **Step 2: Delete the legacy `::before` scan-line block**

Locate the block starting `#stream-pacer-container::before {` (around line 82) and delete the entire rule (content, position, inset, background with `repeating-linear-gradient`, pointer-events, z-index — through the closing `}`). The new grain overlay will be added in Task 2.

- [ ] **Step 3: Manual validation — fonts load in Foundry**

1. Launch Foundry, load the test world, enable the module.
2. Open browser devtools → Network tab.
3. Refresh the Foundry world.
4. Confirm Google Fonts requests appear for `css2?family=Rajdhani...` and return 200.
5. Open devtools → Elements → inspect any `#stream-pacer-container` element.
6. In Styles panel, confirm `--sp-peril: #a52dc0` appears on `:root`.

Expected: fonts load; root variables present. Layout may look broken since other styles still reference old tokens — that's expected, next tasks fix it.

- [ ] **Step 4: Commit**

```bash
git add styles/stream-pacer.css
git commit -m "styles: swap to new palette + Rajdhani/JetBrains Mono imports

Replace :root token set with the unified Operator Panel + Dire Peril
palette. Remove the legacy scan-line pseudo on #stream-pacer-container
in favor of the grain overlay added in Task 2."
```

---

## Phase 2 — HUD visual rewrite

### Task 2: HUD panel container (clip-path, gradient, grain, accent stripe)

**Files:**
- Modify: `styles/stream-pacer.css` — find the existing `#stream-pacer-container { ... }` block (around line 64) and replace it
- Modify: `templates/pacer-hud.hbs:1-2` — add `<div class="sp-accent"></div>` as first child of `#stream-pacer-container`

- [ ] **Step 1: Replace `#stream-pacer-container` block with:**

```css
#stream-pacer-container {
  position: relative;
  width: 300px;
  background: linear-gradient(180deg, var(--sp-ink-2) 0%, var(--sp-ink-1) 100%);
  color: var(--sp-text);
  font-family: 'Rajdhani', 'Signika', sans-serif;
  font-size: 11px;
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
  backdrop-filter: blur(6px);
  box-shadow:
    0 14px 40px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.03),
    inset 0 -20px 30px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(228, 176, 85, 0.1);
  transition: box-shadow 0.3s ease;
  animation: sp-panel-drift 14s ease-in-out infinite alternate;
}

/* Grain overlay — two layered repeating gradients */
#stream-pacer-container::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(0deg, transparent 0 2px, rgba(255, 255, 255, 0.012) 2px 3px),
    repeating-linear-gradient(45deg, transparent 0 22px, rgba(255, 255, 255, 0.018) 22px 23px);
  pointer-events: none;
  z-index: 1;
}

/* Top inner-highlight hairline */
#stream-pacer-container::after {
  content: '';
  position: absolute;
  top: 0;
  left: 14px;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.12) 30%, rgba(255, 255, 255, 0.12) 70%, transparent);
  pointer-events: none;
  z-index: 3;
}

/* Left accent stripe — inserted in template */
#stream-pacer-container .sp-accent {
  position: absolute;
  top: 0;
  bottom: 14px;
  left: 0;
  width: 2px;
  background: linear-gradient(180deg, var(--sp-amber) 0%, rgba(228, 176, 85, 0.1) 100%);
  box-shadow: 0 0 8px var(--sp-amber-glow);
  z-index: 2;
}

#stream-pacer-container .sp-accent::after {
  content: '';
  position: absolute;
  top: 56px;
  left: 2px;
  width: 10px;
  height: 1px;
  background: var(--sp-amber);
  box-shadow: 0 0 6px var(--sp-amber);
}

/* Signal-active and countdown urgency override the accent stripe color */
#stream-pacer-container.signal-active .sp-accent {
  background: linear-gradient(180deg, var(--sp-amber) 0%, var(--sp-amber) 50%, rgba(228, 176, 85, 0.3) 100%);
}

#stream-pacer-container.countdown-active .sp-accent {
  background: linear-gradient(180deg, var(--sp-red) 0%, rgba(239, 100, 100, 0.3) 100%);
  box-shadow: 0 0 10px rgba(239, 100, 100, 0.45);
}

@keyframes sp-panel-drift {
  0% {
    box-shadow:
      0 14px 40px rgba(0, 0, 0, 0.55),
      inset 0 1px 0 rgba(255, 255, 255, 0.03),
      inset 0 -20px 30px rgba(0, 0, 0, 0.4),
      0 0 0 1px rgba(228, 176, 85, 0.08);
  }
  100% {
    box-shadow:
      0 14px 50px rgba(0, 0, 0, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.04),
      inset 0 -20px 34px rgba(0, 0, 0, 0.45),
      0 0 0 1px rgba(228, 176, 85, 0.16);
  }
}
```

- [ ] **Step 2: Update `templates/pacer-hud.hbs` to add the accent stripe**

Open `templates/pacer-hud.hbs`. Line 1 currently starts:

```hbs
<div id="stream-pacer-container" class="{{#if hasActiveSignal}}signal-active{{/if}} {{#if isCountdown}}countdown-active urgency-{{countdownUrgency}}{{/if}}">
  {{!-- Header --}}
```

Insert `<div class="sp-accent"></div>` as the first child, directly after the opening `<div>`:

```hbs
<div id="stream-pacer-container" class="{{#if hasActiveSignal}}signal-active{{/if}} {{#if isCountdown}}countdown-active urgency-{{countdownUrgency}}{{/if}}">
  <div class="sp-accent"></div>
  {{!-- Header --}}
```

- [ ] **Step 3: Manual validation**

1. Reload Foundry world.
2. HUD renders with: a 300px-wide dark panel, diagonal clipped corners at top-left and bottom-right, a thin amber stripe down the left edge with a visible horizontal notch ~56px from the top, subtle diagonal grain visible against the gradient, and a faint ambient shadow breathing animation.
3. Open devtools, inspect the container. Confirm `.sp-accent` is the first child.

Expected visual: dark clipped panel + amber stripe + notch + breathing shadow. Interior content (header, chips, buttons) will look misaligned — next tasks fix.

- [ ] **Step 4: Commit**

```bash
git add styles/stream-pacer.css templates/pacer-hud.hbs
git commit -m "styles: HUD panel container with clip-path, grain, accent stripe"
```

---

### Task 3: HUD header + section wrappers (template + CSS)

**Files:**
- Modify: `templates/pacer-hud.hbs` — wrap the operators list and GM controls each in a `.p-sec` block with labeled section headers; add `.p-ix` index marker + title re-tracking in header
- Modify: `styles/stream-pacer.css` — replace `.pacer-header`, `.pacer-title`, `.gm-badge`, `.drag-handle` blocks; add `.p-sec` and `.p-lbl` blocks

- [ ] **Step 1: Rewrite the header portion of `templates/pacer-hud.hbs`**

Replace the existing `.pacer-header` block (lines 3–11) with:

```hbs
  {{!-- Header --}}
  <div class="pacer-header">
    <div class="drag-handle" title="{{localize 'STREAM_PACER.DragToMove'}}">
      <i class="fa-solid fa-grip-vertical"></i>
    </div>
    <span class="p-ix">01</span>
    <span class="pacer-title">{{localize "STREAM_PACER.Title"}}</span>
    {{#if isGM}}
    <div class="gm-badge">GM</div>
    {{/if}}
  </div>
```

- [ ] **Step 2: Wrap the operators list in a `.p-sec` block with a section label**

Replace the existing `.pacer-players` block (lines 13–23) with:

```hbs
  {{!-- Operators Section --}}
  <div class="p-sec">
    <div class="p-lbl">
      <span class="num">01</span>
      <span>{{localize "STREAM_PACER.SectionOperators"}}</span>
      <span class="rule"></span>
    </div>
    <div class="pacer-players">
      {{#each players}}
      <div class="player-status {{statusClass}}" title="{{name}}: {{statusTitle}}">
        <i class="fa-solid {{statusIcon}}"></i>
        <span class="player-name">{{name}}</span>
      </div>
      {{else}}
      <div class="no-players">{{localize "STREAM_PACER.NoPlayers"}}</div>
      {{/each}}
    </div>
  </div>
```

- [ ] **Step 3: Wrap the status buttons (non-GM) in a `.p-sec` block**

Replace the existing `.pacer-my-status` block (lines 25–51) with:

```hbs
  {{!-- Player Status Buttons (non-GM only) --}}
  {{#unless isGM}}
  <div class="p-sec pacer-my-status">
    <div class="p-lbl">
      <span class="num">02</span>
      <span>{{localize "STREAM_PACER.SectionStatus"}}</span>
      <span class="rule"></span>
    </div>
    <div class="status-buttons">
      <button type="button" class="status-btn status-engaged {{#if myStatusEngaged}}active{{/if}}"
              data-action="set-status" data-status="engaged"
              title="{{localize 'STREAM_PACER.Status.engaged'}}">
        <i class="fa-solid fa-hourglass-half"></i>
      </button>
      <button type="button" class="status-btn status-hand-raised {{#if myStatusHandRaised}}active{{/if}}"
              data-action="set-status" data-status="hand_raised"
              title="{{localize 'STREAM_PACER.Status.hand_raised'}}">
        <i class="fa-solid fa-hand"></i>
      </button>
      <button type="button" class="status-btn status-need-time {{#if myStatusNeedTime}}active{{/if}}"
              data-action="set-status" data-status="need_time"
              title="{{localize 'STREAM_PACER.Status.need_time'}}">
        <i class="fa-solid fa-brain"></i>
      </button>
      <button type="button" class="status-btn status-ready {{#if myStatusReady}}active{{/if}}"
              data-action="set-status" data-status="ready"
              title="{{localize 'STREAM_PACER.Status.ready'}}">
        <i class="fa-solid fa-circle-check"></i>
      </button>
    </div>
  </div>
  {{/unless}}
```

- [ ] **Step 4: Wrap the GM controls in a `.p-sec` block with label**

Replace the existing `.pacer-gm-controls` block (lines 71–101) with:

```hbs
  {{!-- GM Controls --}}
  {{#if isGM}}
  <div class="p-sec pacer-gm-controls-wrap">
    <div class="p-lbl">
      <span class="num">02</span>
      <span>{{localize "STREAM_PACER.SectionCommand"}}</span>
      <span class="rule"></span>
    </div>
    <div class="pacer-gm-controls">
      <button type="button" class="gm-btn soft-signal-btn {{#if isSoftSignal}}active{{/if}}"
              data-action="soft-signal"
              title="{{localize 'STREAM_PACER.SoftSignalTooltip'}}">
        <i class="fa-solid fa-triangle-exclamation"></i>
      </button>
      <button type="button" class="gm-btn countdown-btn {{#if isCountdown}}active{{/if}}"
              data-action="start-countdown"
              title="{{localize 'STREAM_PACER.CountdownTooltip'}}">
        <i class="fa-solid fa-clock"></i>
      </button>
      <button type="button" class="gm-btn floor-open-btn {{#if isFloorOpen}}active{{/if}}"
              data-action="open-floor"
              title="{{localize 'STREAM_PACER.FloorOpenTooltip'}}">
        <i class="fa-solid fa-microphone"></i>
      </button>
      {{#if hasActiveSignal}}
      <button type="button" class="gm-btn cancel-btn"
              data-action="cancel-signal"
              title="{{localize 'STREAM_PACER.CancelTooltip'}}">
        <i class="fa-solid fa-xmark"></i>
      </button>
      {{/if}}
      <button type="button" class="gm-btn reset-btn"
              data-action="reset-all"
              title="{{localize 'STREAM_PACER.ResetTooltip'}}">
        <i class="fa-solid fa-arrows-rotate"></i>
      </button>
    </div>
  </div>
  {{/if}}
```

- [ ] **Step 5: Replace the corresponding CSS blocks**

Find `.pacer-header`, `.drag-handle`, `.pacer-title`, `.gm-badge` blocks (around lines 130–183) and replace them with:

```css
/* ========================================
   HUD Header
   ======================================== */

#stream-pacer-container .pacer-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 12px 11px 18px;
  border-bottom: 1px solid var(--sp-line);
  position: relative;
  z-index: 2;
}

#stream-pacer-container .drag-handle {
  color: var(--sp-muted);
  font-size: 10px;
  cursor: grab;
  padding: 0 2px;
  transition: color 0.2s ease;
  flex-shrink: 0;
}

#stream-pacer-container .drag-handle:hover {
  color: var(--sp-amber);
}

#stream-pacer-container .drag-handle:active {
  cursor: grabbing;
}

#stream-pacer-container .p-ix {
  font-family: 'JetBrains Mono', monospace;
  color: var(--sp-amber);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-shadow: 0 0 6px var(--sp-amber-glow);
  flex-shrink: 0;
}

#stream-pacer-container .pacer-title {
  flex: 1;
  font-family: 'Rajdhani', sans-serif;
  font-weight: 600;
  font-size: 10.5px;
  letter-spacing: 3.5px;
  text-transform: uppercase;
  color: var(--sp-text);
}

#stream-pacer-container .gm-badge {
  font-family: 'Rajdhani', sans-serif;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 2px;
  padding: 2px 8px;
  background: linear-gradient(135deg, var(--sp-amber) 0%, #c0913a 100%);
  color: var(--sp-ink-0);
  clip-path: polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%);
  box-shadow: 0 0 8px rgba(228, 176, 85, 0.3);
  text-transform: uppercase;
  flex-shrink: 0;
}

/* ========================================
   Section wrapper + label
   ======================================== */

#stream-pacer-container .p-sec {
  padding: 10px 14px 12px 18px;
  border-bottom: 1px solid var(--sp-line);
  position: relative;
  z-index: 2;
}

#stream-pacer-container .p-sec:last-child {
  border-bottom: none;
}

#stream-pacer-container .p-lbl {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Rajdhani', sans-serif;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 2.5px;
  color: var(--sp-muted-2);
  text-transform: uppercase;
  margin-bottom: 9px;
}

#stream-pacer-container .p-lbl .num {
  font-family: 'JetBrains Mono', monospace;
  color: var(--sp-amber);
  font-size: 8.5px;
  letter-spacing: 0;
  text-shadow: 0 0 4px rgba(228, 176, 85, 0.3);
}

#stream-pacer-container .p-lbl .rule {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, var(--sp-line-strong), transparent);
}
```

- [ ] **Step 6: Manual validation**

1. Reload Foundry.
2. Expect header shows: grip icon, amber `01` index, `STREAM PACER` title with wide tracking, `GM` badge (if GM) with clipped chevron corner on the right.
3. Expect: each section (Operators, Status/Command) has a label row with `01` or `02` in amber monospace + uppercase section name + fading hairline rule.
4. GM view shows 2 sections: Operators and Command. Non-GM view shows 2 sections: Operators and Status.

Chip and button styling will still look unstyled (plain text / default buttons) until Tasks 4 and 5.

- [ ] **Step 7: Commit**

```bash
git add styles/stream-pacer.css templates/pacer-hud.hbs
git commit -m "styles: HUD header + section wrappers with index markers"
```

---

### Task 4: Player chip styling (status-engaged/hand-raised/ready/need-time)

**Files:**
- Modify: `styles/stream-pacer.css` — replace `.pacer-players` + `.player-status` + related rules (around lines 189–292)

- [ ] **Step 1: Replace the player chip block with:**

```css
/* ========================================
   Player chips
   ======================================== */

#stream-pacer-container .pacer-players {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

#stream-pacer-container .player-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px 3px 7px;
  background: rgba(255, 255, 255, 0.025);
  border-left: 2px solid var(--sp-muted);
  font-family: 'Rajdhani', sans-serif;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.3px;
  color: var(--sp-text);
  transition: all 0.25s cubic-bezier(0.2, 0.7, 0.3, 1);
  position: relative;
  overflow: hidden;
}

#stream-pacer-container .player-status i {
  font-size: 9px;
  width: 11px;
  text-align: center;
  flex-shrink: 0;
}

#stream-pacer-container .player-name {
  max-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Engaged — amber */
#stream-pacer-container .player-status.status-engaged {
  border-left-color: var(--sp-amber);
  background: rgba(228, 176, 85, 0.05);
}
#stream-pacer-container .player-status.status-engaged i {
  color: var(--sp-amber);
}

/* Ready — green */
#stream-pacer-container .player-status.status-ready {
  border-left-color: var(--sp-green);
  background: rgba(100, 192, 143, 0.08);
}
#stream-pacer-container .player-status.status-ready i {
  color: var(--sp-green);
}

/* Need Time — purple (soft lavender) */
#stream-pacer-container .player-status.status-need-time {
  border-left-color: var(--sp-purple);
  background: rgba(166, 132, 255, 0.08);
}
#stream-pacer-container .player-status.status-need-time i {
  color: var(--sp-purple);
}

/* Hand Raised — blue with glow + shimmer sweep */
#stream-pacer-container .player-status.status-hand-raised {
  border-left-color: var(--sp-blue);
  background: linear-gradient(135deg, rgba(90, 163, 240, 0.25) 0%, rgba(90, 163, 240, 0.08) 100%);
  box-shadow:
    0 0 14px rgba(90, 163, 240, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.15),
    inset 0 -1px 0 rgba(0, 0, 0, 0.2);
  animation: sp-hand-pulse 1.6s ease-in-out infinite;
}

#stream-pacer-container .player-status.status-hand-raised i {
  color: var(--sp-blue);
  filter: drop-shadow(0 0 4px rgba(90, 163, 240, 0.9));
  animation: sp-hand-icon-pulse 1.6s ease-in-out infinite;
}

#stream-pacer-container .player-status.status-hand-raised::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 70%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
  animation: sp-shimmer-sweep 2.6s ease-in-out infinite;
}

#stream-pacer-container .no-players {
  color: var(--sp-muted-2);
  font-style: italic;
  font-size: 10px;
  font-family: 'Rajdhani', sans-serif;
}

@keyframes sp-hand-pulse {
  0%, 100% {
    box-shadow:
      0 0 14px rgba(90, 163, 240, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.15),
      inset 0 -1px 0 rgba(0, 0, 0, 0.2);
  }
  50% {
    box-shadow:
      0 0 22px rgba(90, 163, 240, 0.65),
      0 0 40px rgba(90, 163, 240, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.25),
      inset 0 -1px 0 rgba(0, 0, 0, 0.2);
  }
}

@keyframes sp-hand-icon-pulse {
  0%, 100% { filter: drop-shadow(0 0 4px rgba(90, 163, 240, 0.9)); }
  50% { filter: drop-shadow(0 0 8px rgba(90, 163, 240, 1)); }
}

@keyframes sp-shimmer-sweep {
  0% { left: -100%; }
  60%, 100% { left: 200%; }
}
```

- [ ] **Step 2: Manual validation**

1. Reload Foundry.
2. With no status set, expect chips with 2px left-border in the amber color.
3. Use another player's account (or incognito session) and set their status to Hand Raised — the other client's HUD chip should show a blue pulsing glow and horizontal shimmer.
4. Test all four states: hourglass/amber, hand/blue-pulse, brain/purple, check-circle/green.

- [ ] **Step 3: Commit**

```bash
git add styles/stream-pacer.css
git commit -m "styles: player chip status colors + hand-raised pulse/shimmer"
```

---

### Task 5: Status buttons + GM control buttons styling

**Files:**
- Modify: `styles/stream-pacer.css` — replace `.pacer-my-status`, `.status-btn`, `.pacer-gm-controls`, `.gm-btn` blocks

- [ ] **Step 1: Replace the button blocks with:**

```css
/* ========================================
   Status buttons (player) + GM buttons
   Shared styling — only active-state colors differ.
   ======================================== */

#stream-pacer-container .status-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}

#stream-pacer-container .pacer-gm-controls {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
}

#stream-pacer-container .status-btn,
#stream-pacer-container .gm-btn {
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%);
  border: 1px solid var(--sp-line-strong);
  color: var(--sp-muted-2);
  font-size: 12px;
  cursor: pointer;
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.12s ease;
  clip-path: polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px);
  position: relative;
}

#stream-pacer-container .status-btn span,
#stream-pacer-container .gm-btn span {
  display: none;
}

#stream-pacer-container .status-btn::before,
#stream-pacer-container .gm-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.12) 50%, transparent);
  pointer-events: none;
}

#stream-pacer-container .status-btn:hover,
#stream-pacer-container .gm-btn:hover {
  color: var(--sp-text);
  border-color: rgba(255, 255, 255, 0.22);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02));
  transform: translateY(-1px);
}

#stream-pacer-container .status-btn:active,
#stream-pacer-container .gm-btn:active {
  transform: translateY(0);
  filter: brightness(0.9);
}

/* Hand-raised button — color-specific hover */
#stream-pacer-container .status-btn.status-hand-raised:hover:not(.active) {
  color: var(--sp-blue);
  border-color: rgba(90, 163, 240, 0.5);
  background: rgba(90, 163, 240, 0.1);
  box-shadow: 0 0 10px rgba(90, 163, 240, 0.3);
}

/* Active states — status buttons */
#stream-pacer-container .status-btn.status-engaged.active {
  color: var(--sp-amber);
  border-color: var(--sp-amber);
  background: linear-gradient(180deg, rgba(228, 176, 85, 0.18), rgba(228, 176, 85, 0.06));
  box-shadow: 0 0 10px rgba(228, 176, 85, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

#stream-pacer-container .status-btn.status-hand-raised.active {
  color: var(--sp-blue);
  border-color: var(--sp-blue);
  background: linear-gradient(135deg, rgba(90, 163, 240, 0.2), rgba(90, 163, 240, 0.08));
  box-shadow:
    0 0 15px rgba(90, 163, 240, 0.5),
    0 0 30px rgba(90, 163, 240, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  animation: sp-hand-btn-pulse 1.6s ease-in-out infinite;
  overflow: hidden;
}

#stream-pacer-container .status-btn.status-hand-raised.active::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%);
  animation: sp-shimmer-sweep 2s ease-in-out infinite;
}

#stream-pacer-container .status-btn.status-hand-raised.active i {
  filter: drop-shadow(0 0 4px rgba(90, 163, 240, 0.8));
}

#stream-pacer-container .status-btn.status-ready.active {
  color: var(--sp-green);
  border-color: var(--sp-green);
  background: linear-gradient(180deg, rgba(100, 192, 143, 0.18), rgba(100, 192, 143, 0.06));
  box-shadow: 0 0 10px rgba(100, 192, 143, 0.35);
}

#stream-pacer-container .status-btn.status-need-time.active {
  color: var(--sp-purple);
  border-color: var(--sp-purple);
  background: linear-gradient(180deg, rgba(166, 132, 255, 0.18), rgba(166, 132, 255, 0.06));
  box-shadow: 0 0 10px rgba(166, 132, 255, 0.35);
}

/* Active states — GM buttons */
#stream-pacer-container .gm-btn.soft-signal-btn:hover,
#stream-pacer-container .gm-btn.soft-signal-btn.active {
  color: var(--sp-amber);
  border-color: var(--sp-amber);
  background: linear-gradient(180deg, rgba(228, 176, 85, 0.18), rgba(228, 176, 85, 0.06));
  box-shadow: 0 0 12px rgba(228, 176, 85, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

#stream-pacer-container .gm-btn.soft-signal-btn.active {
  animation: sp-btn-pulse-amber 2.4s ease-in-out infinite;
}

#stream-pacer-container .gm-btn.countdown-btn:hover,
#stream-pacer-container .gm-btn.countdown-btn.active {
  color: var(--sp-red);
  border-color: var(--sp-red);
  background: linear-gradient(180deg, rgba(239, 100, 100, 0.18), rgba(239, 100, 100, 0.06));
  box-shadow: 0 0 12px rgba(239, 100, 100, 0.35);
}

#stream-pacer-container .gm-btn.floor-open-btn:hover,
#stream-pacer-container .gm-btn.floor-open-btn.active {
  color: var(--sp-cyan);
  border-color: var(--sp-cyan);
  background: linear-gradient(180deg, rgba(71, 200, 255, 0.18), rgba(71, 200, 255, 0.06));
  box-shadow: 0 0 12px rgba(71, 200, 255, 0.35);
}

#stream-pacer-container .gm-btn.cancel-btn:hover {
  color: var(--sp-red);
  border-color: var(--sp-red);
}

#stream-pacer-container .gm-btn.reset-btn {
  /* reset uses neutral hover */
}

@keyframes sp-hand-btn-pulse {
  0%, 100% {
    box-shadow:
      0 0 15px rgba(90, 163, 240, 0.5),
      0 0 30px rgba(90, 163, 240, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  50% {
    box-shadow:
      0 0 20px rgba(90, 163, 240, 0.7),
      0 0 40px rgba(90, 163, 240, 0.35),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
}

@keyframes sp-btn-pulse-amber {
  0%, 100% { box-shadow: 0 0 12px rgba(228, 176, 85, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.1); }
  50% { box-shadow: 0 0 18px rgba(228, 176, 85, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15); }
}
```

- [ ] **Step 2: Manual validation**

1. Reload Foundry as a non-GM player account. Click each status button; the active one fills with its color (amber / blue-glow / purple / green). Hover gives a subtle lift and brightens the border.
2. Reload as GM. Command row shows 5 slots (Soft, Countdown, Floor Open, Reset; Cancel appears as 6th only when a signal is active). Each has a clipped-corner button.
3. Click Soft Signal: it becomes active amber, pulses slowly. Click Countdown: opens the duration dialog, then starts and the button turns red. Click Floor Open: cyan. Cancel removes the active state.
4. All hover transitions are smooth.

- [ ] **Step 3: Commit**

```bash
git add styles/stream-pacer.css
git commit -m "styles: status + GM buttons with clip-path, gradients, active pulses"
```

---

### Task 6: Signal band styling (active signal + countdown urgency)

**Files:**
- Modify: `styles/stream-pacer.css` — replace `.pacer-signal`, `.countdown-timer`, urgency blocks

- [ ] **Step 1: Replace the signal band block with:**

```css
/* ========================================
   Active signal band
   Appears when a signal is active; sits between operators and command
   ======================================== */

#stream-pacer-container .pacer-signal {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px 9px 18px;
  font-family: 'Rajdhani', sans-serif;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  border-top: 1px solid var(--sp-amber-dim);
  border-bottom: 1px solid var(--sp-amber-dim);
  background: linear-gradient(90deg, rgba(228, 176, 85, 0.18), rgba(228, 176, 85, 0.04));
  color: var(--sp-amber);
  position: relative;
  z-index: 2;
  overflow: hidden;
  animation: sp-signal-glow 3s ease-in-out infinite;
}

#stream-pacer-container .pacer-signal i {
  filter: drop-shadow(0 0 6px rgba(228, 176, 85, 0.6));
  font-size: 12px;
}

#stream-pacer-container .pacer-signal.soft-signal {
  /* already amber by default — no override needed */
}

#stream-pacer-container .pacer-signal.floor-open-signal {
  border-top-color: rgba(71, 200, 255, 0.25);
  border-bottom-color: rgba(71, 200, 255, 0.25);
  background: linear-gradient(90deg, rgba(71, 200, 255, 0.18), rgba(71, 200, 255, 0.04));
  color: var(--sp-cyan);
}

#stream-pacer-container .pacer-signal.floor-open-signal i {
  filter: drop-shadow(0 0 6px rgba(71, 200, 255, 0.6));
}

#stream-pacer-container .pacer-signal.hard-signal {
  border-top-color: rgba(239, 100, 100, 0.3);
  border-bottom-color: rgba(239, 100, 100, 0.3);
  background: linear-gradient(90deg, rgba(239, 100, 100, 0.2), rgba(239, 100, 100, 0.05));
  color: var(--sp-red);
}

#stream-pacer-container .pacer-signal.hard-signal i {
  filter: drop-shadow(0 0 6px rgba(239, 100, 100, 0.6));
}

#stream-pacer-container .pacer-signal::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.12), transparent);
  animation: sp-shimmer-sweep 4s ease-in-out infinite;
}

#stream-pacer-container .countdown-timer {
  margin-left: auto;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--sp-text);
  text-shadow: 0 0 8px rgba(228, 176, 85, 0.4);
}

/* Urgency escalation */
#stream-pacer-container.countdown-active.urgency-warning {
  animation: sp-pulse-warning 2s ease-in-out infinite;
}
#stream-pacer-container.countdown-active.urgency-warning .pacer-signal {
  color: var(--sp-warn);
}
#stream-pacer-container.countdown-active.urgency-warning .countdown-timer {
  color: var(--sp-warn);
  text-shadow: 0 0 8px rgba(240, 168, 80, 0.5);
}

#stream-pacer-container.countdown-active.urgency-critical {
  animation: sp-pulse-critical 1s ease-in-out infinite;
}
#stream-pacer-container.countdown-active.urgency-critical .pacer-signal {
  color: var(--sp-red);
}
#stream-pacer-container.countdown-active.urgency-critical .countdown-timer {
  color: var(--sp-red);
  text-shadow: 0 0 8px rgba(239, 100, 100, 0.6);
  animation: sp-flash-critical 0.5s ease-in-out infinite;
}

@keyframes sp-signal-glow {
  0%, 100% { box-shadow: inset 0 0 20px rgba(228, 176, 85, 0.1); }
  50% { box-shadow: inset 0 0 30px rgba(228, 176, 85, 0.2); }
}

@keyframes sp-pulse-warning {
  0%, 100% { box-shadow: 0 0 15px rgba(240, 168, 80, 0.2), 0 14px 40px rgba(0, 0, 0, 0.55); }
  50% { box-shadow: 0 0 25px rgba(240, 168, 80, 0.35), 0 14px 40px rgba(0, 0, 0, 0.55); }
}

@keyframes sp-pulse-critical {
  0%, 100% { box-shadow: 0 0 18px rgba(239, 100, 100, 0.2), 0 14px 40px rgba(0, 0, 0, 0.55); }
  50% { box-shadow: 0 0 30px rgba(239, 100, 100, 0.4), 0 14px 40px rgba(0, 0, 0, 0.55); }
}

@keyframes sp-flash-critical {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
```

- [ ] **Step 2: Manual validation**

1. As GM, click Soft Signal. Signal band appears between Operators and Command sections with amber gradient, pulsing inner glow, warning-triangle icon, "GM would like to wrap up" text.
2. Click Countdown, set 2 minutes. Band becomes red, shows clock icon, "Scene ending in:" and `02:00` monospace right-aligned. Countdown ticks down.
3. When countdown hits 30s remaining, border turns orange and the panel pulses `sp-pulse-warning`.
4. When countdown hits 10s remaining, border turns red and digits flash every 0.5s.
5. Click Floor Open — band becomes cyan with microphone icon.

- [ ] **Step 3: Commit**

```bash
git add styles/stream-pacer.css
git commit -m "styles: signal band + countdown urgency states"
```

---

## Phase 3 — Ticker visual rewrite

### Task 7: Ticker container + tint + top rail + scroll mask

**Files:**
- Modify: `styles/stream-pacer.css` — replace `.stream-pacer-overlay` block and variants (around lines 536–721)

- [ ] **Step 1: Replace the ticker block with:**

```css
/* ========================================
   Bottom Ticker
   ======================================== */

.stream-pacer-overlay {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 38px;
  display: flex;
  align-items: center;
  pointer-events: none;
  z-index: 10;
  opacity: 0;
  visibility: hidden;
  overflow: hidden;
  transition: opacity 0.4s ease, visibility 0.4s ease, bottom 0.4s ease;
  color: var(--sp-text);
  font-family: 'Rajdhani', sans-serif;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(10, 13, 18, 0.6) 2%,
    rgba(20, 24, 32, 0.96) 7%,
    rgba(20, 24, 32, 0.96) 93%,
    rgba(10, 13, 18, 0.6) 98%,
    transparent 100%);
  box-shadow:
    0 -4px 18px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    inset 0 -1px 0 rgba(0, 0, 0, 0.3);
}

.stream-pacer-overlay.active {
  opacity: 1;
  visibility: visible;
}

/* Scan line overlay */
.stream-pacer-overlay::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(0deg, transparent 0 2px, rgba(255, 255, 255, 0.02) 2px 3px);
  pointer-events: none;
  z-index: 2;
}

/* Tint overlay — signal-colored band */
.stream-pacer-overlay .sp-tint {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg,
    transparent 0%,
    transparent 3%,
    rgba(228, 176, 85, 0.16) 10%,
    rgba(228, 176, 85, 0.08) 50%,
    rgba(228, 176, 85, 0.16) 90%,
    transparent 97%,
    transparent 100%);
  z-index: 1;
}

/* Top rail — signal-colored hairline */
.stream-pacer-overlay .sp-rail {
  position: absolute;
  top: 0;
  left: 3%;
  right: 3%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--sp-amber), transparent);
  box-shadow: 0 0 8px rgba(228, 176, 85, 0.6);
  z-index: 4;
}

/* Variant: soft signal (default amber) — already set above */

.stream-pacer-overlay.countdown-signal .sp-tint {
  background: linear-gradient(90deg,
    transparent 0%, transparent 3%,
    rgba(239, 100, 100, 0.16) 10%,
    rgba(239, 100, 100, 0.08) 50%,
    rgba(239, 100, 100, 0.16) 90%,
    transparent 97%, transparent 100%);
}
.stream-pacer-overlay.countdown-signal .sp-rail {
  background: linear-gradient(90deg, transparent, var(--sp-red), transparent);
  box-shadow: 0 0 8px rgba(239, 100, 100, 0.6);
}

.stream-pacer-overlay.floor-open-signal .sp-tint {
  background: linear-gradient(90deg,
    transparent 0%, transparent 3%,
    rgba(71, 200, 255, 0.16) 10%,
    rgba(71, 200, 255, 0.08) 50%,
    rgba(71, 200, 255, 0.16) 90%,
    transparent 97%, transparent 100%);
}
.stream-pacer-overlay.floor-open-signal .sp-rail {
  background: linear-gradient(90deg, transparent, var(--sp-cyan), transparent);
  box-shadow: 0 0 8px rgba(71, 200, 255, 0.6);
}

.stream-pacer-overlay.urgency-warning .sp-tint {
  background: linear-gradient(90deg,
    transparent 0%, transparent 3%,
    rgba(240, 168, 80, 0.2) 10%,
    rgba(240, 168, 80, 0.1) 50%,
    rgba(240, 168, 80, 0.2) 90%,
    transparent 97%, transparent 100%);
}

.stream-pacer-overlay.urgency-critical .sp-tint {
  background: linear-gradient(90deg,
    transparent 0%, transparent 3%,
    rgba(245, 60, 60, 0.22) 10%,
    rgba(245, 60, 60, 0.12) 50%,
    rgba(245, 60, 60, 0.22) 90%,
    transparent 97%, transparent 100%);
  animation: sp-ticker-glow 1s ease-in-out infinite;
}

/* Scrolling body with edge-fade mask */
.stream-pacer-overlay .overlay-content {
  position: relative;
  z-index: 5;
  display: flex;
  align-items: center;
  white-space: nowrap;
  animation: sp-ticker-scroll 28s linear infinite;
  -webkit-mask-image: linear-gradient(90deg, transparent, black 5%, black 95%, transparent);
          mask-image: linear-gradient(90deg, transparent, black 5%, black 95%, transparent);
}

@keyframes sp-ticker-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

@keyframes sp-ticker-glow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}
```

- [ ] **Step 2: Add the two helper elements to the ticker in `scripts/PacerOverlay.js`**

Open `scripts/PacerOverlay.js`. Replace the `_createElement()` method body (lines 34–46) with:

```javascript
  _createElement() {
    this._element = document.createElement('div');
    this._element.id = 'stream-pacer-overlay';
    this._element.className = 'stream-pacer-overlay';

    const tint = document.createElement('div');
    tint.className = 'sp-tint';
    this._element.appendChild(tint);

    const rail = document.createElement('div');
    rail.className = 'sp-rail';
    this._element.appendChild(rail);

    this._contentEl = document.createElement('div');
    this._contentEl.className = 'overlay-content';
    this._element.appendChild(this._contentEl);

    document.body.appendChild(this._element);

    this._adjustSegments();
  }
```

- [ ] **Step 3: Manual validation**

1. Reload Foundry as a player.
2. Have a GM click Soft Signal. Bottom ticker fades in with a soft amber band, solid dark center, thin amber hairline across the top, gradient faded edges.
3. Switch GM to Countdown. Ticker re-tints red, hairline turns red. Countdown running.
4. Switch to Floor Open. Ticker re-tints cyan.
5. Content still scrolls and is masked at the left/right edges.

- [ ] **Step 4: Commit**

```bash
git add styles/stream-pacer.css scripts/PacerOverlay.js
git commit -m "styles: ticker container tint + rail + scroll mask"
```

---

### Task 8: Ticker segment markup — NOTICE index markers + diamond separators

**Files:**
- Modify: `scripts/PacerOverlay.js` — update `_createTickerSegment()` to emit new markup
- Modify: `styles/stream-pacer.css` — add segment-item styles (inside and around the existing ticker block)

- [ ] **Step 1: Update `_createTickerSegment()` in `scripts/PacerOverlay.js`**

Replace the method (lines 81–90) with:

```javascript
  _createTickerSegment() {
    return `
      <span class="ticker-segment">
        <span class="overlay-ix"></span>
        <span class="overlay-icon"><i class="fa-solid fa-triangle-exclamation"></i></span>
        <span class="overlay-message"></span>
        <span class="overlay-countdown"></span>
      </span>
      <span class="ticker-separator"></span>
    `;
  }
```

- [ ] **Step 2: Update `_update()` in the same file to fill the index markers**

In `_update()`, the method currently updates `messageEls`, `countdownEls`, `iconEls`. Add a parallel `ixEls` cache and fill it per signal.

Replace the `_rebuildSegments()` refresh block (lines 72–76) with:

```javascript
    this._messageEls = this._element.querySelectorAll('.overlay-message');
    this._countdownEls = this._element.querySelectorAll('.overlay-countdown');
    this._iconEls = this._element.querySelectorAll('.overlay-icon i');
    this._ixEls = this._element.querySelectorAll('.overlay-ix');
```

Replace the full `_update()` method (lines 92–141) with:

```javascript
  _update(state) {
    if (!this._element) return;

    const messageEls = this._messageEls ?? this._element.querySelectorAll('.overlay-message');
    const countdownEls = this._countdownEls ?? this._element.querySelectorAll('.overlay-countdown');
    const iconEls = this._iconEls ?? this._element.querySelectorAll('.overlay-icon i');
    const ixEls = this._ixEls ?? this._element.querySelectorAll('.overlay-ix');

    if (state.gmSignal === GM_SIGNAL.SOFT) {
      this._element.classList.add('active', 'soft-signal');
      this._element.classList.remove('countdown-signal', 'floor-open-signal', 'urgency-warning', 'urgency-critical');

      iconEls.forEach(el => el.className = 'fa-solid fa-triangle-exclamation');
      messageEls.forEach(el => el.textContent = game.i18n.localize('STREAM_PACER.SoftSignalMessage'));
      countdownEls.forEach(el => el.textContent = '');
      ixEls.forEach(el => el.textContent = game.i18n.format('STREAM_PACER.TickerIndex', { n: '01' }));
    } else if (state.gmSignal === GM_SIGNAL.FLOOR_OPEN) {
      this._element.classList.add('active', 'floor-open-signal');
      this._element.classList.remove('soft-signal', 'countdown-signal', 'urgency-warning', 'urgency-critical');

      iconEls.forEach(el => el.className = 'fa-solid fa-microphone');
      messageEls.forEach(el => el.textContent = game.i18n.localize('STREAM_PACER.FloorOpenMessage'));
      countdownEls.forEach(el => el.textContent = '');
      ixEls.forEach(el => el.textContent = game.i18n.format('STREAM_PACER.TickerIndex', { n: '02' }));
    } else if (state.gmSignal === GM_SIGNAL.COUNTDOWN) {
      this._element.classList.add('active', 'countdown-signal');
      this._element.classList.remove('soft-signal', 'floor-open-signal');

      iconEls.forEach(el => el.className = 'fa-solid fa-clock');
      messageEls.forEach(el => el.textContent = game.i18n.localize('STREAM_PACER.CountdownMessage'));
      ixEls.forEach(el => el.textContent = game.i18n.format('STREAM_PACER.TickerIndex', { n: '03' }));

      const remaining = state.countdownRemaining;
      if (remaining !== null) {
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        countdownEls.forEach(el => el.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`);

        this._element.classList.remove('urgency-warning', 'urgency-critical');
        if (remaining <= 10) {
          this._element.classList.add('urgency-critical');
        } else if (remaining <= 30) {
          this._element.classList.add('urgency-warning');
        }
      }
    } else {
      this._element.classList.remove('active', 'soft-signal', 'countdown-signal', 'floor-open-signal', 'urgency-warning', 'urgency-critical');
    }
  }
```

- [ ] **Step 3: Add segment-item CSS to `styles/stream-pacer.css`**

Append after the `@keyframes sp-ticker-glow` rule:

```css
.stream-pacer-overlay .ticker-segment {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 0 22px;
}

.stream-pacer-overlay .overlay-ix {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9.5px;
  letter-spacing: 2px;
  color: var(--sp-amber);
  opacity: 0.9;
  text-transform: uppercase;
}

.stream-pacer-overlay.countdown-signal .overlay-ix { color: var(--sp-red); }
.stream-pacer-overlay.floor-open-signal .overlay-ix { color: var(--sp-cyan); }

.stream-pacer-overlay .overlay-icon {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  color: var(--sp-amber);
  filter: drop-shadow(0 0 6px rgba(228, 176, 85, 0.7));
}

.stream-pacer-overlay.countdown-signal .overlay-icon {
  color: var(--sp-red);
  filter: drop-shadow(0 0 6px rgba(239, 100, 100, 0.7));
}

.stream-pacer-overlay.floor-open-signal .overlay-icon {
  color: var(--sp-cyan);
  filter: drop-shadow(0 0 6px rgba(71, 200, 255, 0.7));
}

.stream-pacer-overlay .overlay-message {
  font-family: 'Rajdhani', sans-serif;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--sp-text);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}

.stream-pacer-overlay .overlay-countdown {
  font-family: 'JetBrains Mono', monospace;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--sp-red);
  text-shadow: 0 0 8px rgba(239, 100, 100, 0.5);
}

.stream-pacer-overlay.urgency-critical .overlay-countdown {
  animation: sp-flash-critical 0.5s ease-in-out infinite;
}

/* Diamond separator */
.stream-pacer-overlay .ticker-separator {
  width: 6px;
  height: 6px;
  background: var(--sp-amber);
  transform: rotate(45deg);
  display: inline-block;
  flex-shrink: 0;
  box-shadow: 0 0 8px rgba(228, 176, 85, 0.6);
}

.stream-pacer-overlay.countdown-signal .ticker-separator {
  background: var(--sp-red);
  box-shadow: 0 0 8px rgba(239, 100, 100, 0.6);
}

.stream-pacer-overlay.floor-open-signal .ticker-separator {
  background: var(--sp-cyan);
  box-shadow: 0 0 8px rgba(71, 200, 255, 0.6);
}
```

- [ ] **Step 4: Manual validation**

1. Reload Foundry. Trigger Soft Signal as GM.
2. Expect each ticker segment shows: `NOTICE / 01` (amber monospace) → triangle-exclamation icon → `GM WOULD LIKE TO WRAP UP` uppercase tracked → diamond separator (rotated square) → next segment.
3. Countdown: segments show `NOTICE / 03` red, clock icon, "Scene ending in:", `02:00` monospace right, diamond red.
4. Floor Open: `NOTICE / 02` cyan.
5. Segments loop seamlessly; edges mask.

- [ ] **Step 5: Commit**

```bash
git add styles/stream-pacer.css scripts/PacerOverlay.js
git commit -m "styles: ticker segments with NOTICE index markers + diamond separators"
```

---

## Phase 4 — Hand-raise bar visual rewrite

### Task 9: Hand-raise bar container (gradient + grain + shimmer)

**Files:**
- Modify: `styles/stream-pacer.css` — replace `.stream-pacer-hand-bar` block and associated animations (around lines 820–1008)

- [ ] **Step 1: Replace the hand-bar block with:**

```css
/* ========================================
   Hand-Raise Bar (GM only, top of screen)
   ======================================== */

.stream-pacer-hand-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 46px;
  display: flex;
  align-items: center;
  z-index: 100;
  color: #fff;
  font-family: 'Rajdhani', sans-serif;

  background: linear-gradient(90deg,
    transparent 0%,
    rgba(15, 19, 26, 0.55) 3%,
    rgba(30, 80, 140, 0.85) 8%,
    rgba(70, 140, 220, 0.92) 50%,
    rgba(30, 80, 140, 0.85) 92%,
    rgba(15, 19, 26, 0.55) 97%,
    transparent 100%);
  box-shadow:
    0 4px 18px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    inset 0 -1px 0 rgba(0, 0, 0, 0.3);

  opacity: 0;
  visibility: hidden;
  transform: translateY(-100%);
  transition: opacity 0.4s ease, visibility 0.4s ease, transform 0.4s ease;
  overflow: hidden;
}

.stream-pacer-hand-bar.active {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  animation: sp-handbar-breath 3s ease-in-out infinite;
}

/* Grain overlay */
.stream-pacer-hand-bar::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(0deg, transparent 0 2px, rgba(255, 255, 255, 0.02) 2px 3px),
    repeating-linear-gradient(45deg, transparent 0 22px, rgba(0, 0, 0, 0.04) 22px 23px);
  pointer-events: none;
  z-index: 1;
}

/* Shimmer sweep */
.stream-pacer-hand-bar::after {
  content: '';
  position: absolute;
  top: 0;
  left: -50%;
  width: 45%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
  animation: sp-handbar-sweep 5s ease-in-out infinite;
  z-index: 2;
}

@keyframes sp-handbar-breath {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.12); }
}

@keyframes sp-handbar-sweep {
  0% { left: -50%; opacity: 0; }
  15%, 85% { opacity: 1; }
  100% { left: 150%; opacity: 0; }
}
```

- [ ] **Step 2: Manual validation**

1. Reload as GM.
2. On a player client, raise a hand. The top bar slides in from the top with blue gradient, faded edges, grain overlay, and a white shimmer sweep crossing left-to-right.
3. Lower the hand. Bar slides up and out.
4. As a player (not GM), verify no hand bar appears (existing behavior).

Inner content will look plain until Task 10.

- [ ] **Step 3: Commit**

```bash
git add styles/stream-pacer.css
git commit -m "styles: hand-raise bar container gradient + grain + shimmer"
```

---

### Task 10: Hand-raise bar content (PRIORITY chip + icon animation + names + tag)

**Files:**
- Modify: `scripts/HandRaiseSidebar.js` — update `_rebuildContent()` markup
- Modify: `styles/stream-pacer.css` — replace the `.hand-bar-content` block and its children

- [ ] **Step 1: Update `_rebuildContent()` in `scripts/HandRaiseSidebar.js`**

Replace the method (lines 82–102) with:

```javascript
  _rebuildContent() {
    if (!this._contentEl) return;

    if (this._currentPlayers.length === 0) {
      this._contentEl.replaceChildren();
      return;
    }

    // Edge rules for decorative horizontal lines
    const edgeT = document.createElement('span');
    edgeT.className = 'hb-edge hb-edge-t';
    const edgeB = document.createElement('span');
    edgeB.className = 'hb-edge hb-edge-b';

    // Content row
    const row = document.createElement('span');
    row.className = 'hb-row';

    // PRIORITY / 01 index chip
    const ix = document.createElement('span');
    ix.className = 'hb-ix';
    ix.textContent = game.i18n.format('STREAM_PACER.PriorityIndex', { n: '01' });

    // Hand icon
    const icon = document.createElement('span');
    icon.className = 'hb-icon';
    const iconI = document.createElement('i');
    iconI.className = 'fa-solid fa-hand';
    icon.appendChild(iconI);

    // Names (textContent only — player names are untrusted strings)
    const names = document.createElement('span');
    names.className = 'hb-names';
    names.textContent = this._currentPlayers.map(p => p.name).join(', ');

    // Trailing tag
    const tag = document.createElement('span');
    tag.className = 'hb-tag';
    tag.textContent = game.i18n.localize('STREAM_PACER.HandRaisedTag');

    row.append(ix, icon, names, tag);
    this._contentEl.replaceChildren(edgeT, edgeB, row);
  }
```

- [ ] **Step 2: Replace the hand-bar content CSS**

Append after `@keyframes sp-handbar-sweep`:

```css
.stream-pacer-hand-bar .hand-bar-content {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0 24px;
}

.stream-pacer-hand-bar .hb-edge {
  position: absolute;
  left: 7%;
  right: 7%;
  height: 1px;
  z-index: 2;
}
.stream-pacer-hand-bar .hb-edge-t {
  top: 6px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.35), transparent);
}
.stream-pacer-hand-bar .hb-edge-b {
  bottom: 6px;
  background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.35), transparent);
}

.stream-pacer-hand-bar .hb-row {
  display: inline-flex;
  align-items: center;
  gap: 18px;
  position: relative;
  z-index: 3;
}

.stream-pacer-hand-bar .hb-ix {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 3px;
  padding: 3px 8px;
  background: rgba(0, 0, 0, 0.35);
  color: rgba(255, 255, 255, 0.85);
  clip-path: polygon(5px 0, 100% 0, calc(100% - 5px) 100%, 0 100%);
  border-left: 2px solid rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
}

.stream-pacer-hand-bar .hb-icon {
  font-size: 22px;
  color: #fff;
  flex-shrink: 0;
  animation: sp-hb-icon 1.6s ease-in-out infinite;
}

.stream-pacer-hand-bar .hb-icon i {
  filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.9));
}

@keyframes sp-hb-icon {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  30% {
    transform: translateY(-2px) rotate(-6deg);
  }
  60% {
    transform: translateY(-2px) rotate(6deg);
  }
}

.stream-pacer-hand-bar .hb-names {
  font-family: 'Rajdhani', sans-serif;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: #fff;
  text-shadow:
    0 0 10px rgba(255, 255, 255, 0.6),
    0 0 24px rgba(90, 163, 240, 0.5),
    0 2px 4px rgba(0, 0, 0, 0.5);
  animation: sp-hb-text-glow 2s ease-in-out infinite;
}

@keyframes sp-hb-text-glow {
  0%, 100% {
    text-shadow:
      0 0 10px rgba(255, 255, 255, 0.6),
      0 0 24px rgba(90, 163, 240, 0.5),
      0 2px 4px rgba(0, 0, 0, 0.5);
  }
  50% {
    text-shadow:
      0 0 20px rgba(255, 255, 255, 0.85),
      0 0 40px rgba(90, 163, 240, 0.65),
      0 2px 4px rgba(0, 0, 0, 0.5);
  }
}

.stream-pacer-hand-bar .hb-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.75);
  text-transform: uppercase;
}
```

- [ ] **Step 3: Manual validation**

1. Reload as GM.
2. Have a player raise their hand. Bar shows: clipped-corner `PRIORITY / 01` chip (black-background, white-left-stripe, monospace) → animated bouncing hand icon with white glow → `NAME` in bold tracked uppercase white with blue halo glow → `// HAND RAISED` monospace trailing tag.
3. Multiple players with hands up: names joined by `, ` — bar scales with them.
4. All within the edge-faded blue gradient.

- [ ] **Step 4: Commit**

```bash
git add styles/stream-pacer.css scripts/HandRaiseSidebar.js
git commit -m "styles: hand-raise bar content — priority chip, icon bounce, glow text"
```

---

## Phase 5 — Icon upgrade + reduced motion

### Task 11: FA 6 icon class upgrade + reduced-motion media query

**Files:**
- Modify: `scripts/PacerHUD.js:99-109` — update `_getStatusIcon()` return values
- Modify: `scripts/HandRaiseSidebar.js` — (already done in Task 10 with `fa-solid fa-hand`)
- Modify: `scripts/PacerOverlay.js` — (already done in Tasks 7–8 with `fa-solid` classes)
- Modify: `templates/pacer-hud.hbs` — (already done in Task 3 with `fa-solid`, `fa-xmark`, `fa-arrows-rotate`)
- Modify: `styles/stream-pacer.css` — append reduced-motion block at end

- [ ] **Step 1: Update `_getStatusIcon()` in `scripts/PacerHUD.js`**

Replace the method body (lines 98–110) with:

```javascript
  _getStatusIcon(status) {
    switch (status) {
      case PLAYER_STATUS.HAND_RAISED:
        return 'fa-hand';
      case PLAYER_STATUS.NEED_TIME:
        return 'fa-brain';
      case PLAYER_STATUS.READY:
        return 'fa-circle-check';
      case PLAYER_STATUS.ENGAGED:
      default:
        return 'fa-hourglass-half';
    }
  }
```

- [ ] **Step 2: Append reduced-motion block to `styles/stream-pacer.css`**

Add at the very end of the file:

```css
/* ========================================
   Reduced motion — disable animations for users who prefer it
   ======================================== */

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

- [ ] **Step 3: Manual validation**

1. Reload Foundry. All chip icons render correctly (hourglass, hand, brain, circle-check).
2. Ticker icon (triangle-exclamation / clock / microphone) renders.
3. Hand-bar icon (hand) renders.
4. In devtools, emulate CSS `prefers-reduced-motion: reduce`. Trigger each signal. Confirm animations stop — no shimmer, no pulse, no bounce — but visual states are still correct.

- [ ] **Step 4: Commit**

```bash
git add styles/stream-pacer.css scripts/PacerHUD.js
git commit -m "styles: upgrade FA6 icon classes + prefers-reduced-motion support"
```

---

## Phase 6 — Dire Peril: state + socket

### Task 12: Add `direPerilActive` to settings default + manager state field

**Files:**
- Modify: `scripts/settings.js:76-81` — add `direPerilActive: false` to `pacerState` default
- Modify: `scripts/PacerManager.js:5-13` — add `this._direPerilActive = false` to constructor

- [ ] **Step 1: Update the `pacerState` default in `scripts/settings.js`**

Replace the `default` block (lines 76–80) with:

```javascript
    default: {
      playerStates: {},
      gmSignal: GM_SIGNAL.NONE,
      countdownEnd: null,
      direPerilActive: false
    }
```

- [ ] **Step 2: Add state field to `PacerManager.js` constructor**

Replace the constructor (lines 4–13) with:

```javascript
  constructor() {
    this._playerStates = {};
    this._gmSignal = GM_SIGNAL.NONE;
    this._countdownEnd = null;
    this._countdownInterval = null;
    this._direPerilActive = false;
    this._subscribers = new Set();
    this._handRaiseCallbacks = new Set();
    this._direPerilCallbacks = new Set();
    this._notifyPending = false;
  }
```

- [ ] **Step 3: Extend `getState()` to return the new field**

Find `getState()` (line 73). Replace with:

```javascript
  getState() {
    const handRaisedCount = Object.values(this._playerStates)
      .filter(status => status === PLAYER_STATUS.HAND_RAISED).length;

    return {
      playerStates: { ...this._playerStates },
      gmSignal: this._gmSignal,
      countdownEnd: this._countdownEnd,
      countdownRemaining: this.getCountdownRemaining(),
      handRaisedCount,
      direPerilActive: this._direPerilActive
    };
  }
```

- [ ] **Step 4: Extend `loadFromSettings()` to read the field**

In `loadFromSettings()` (lines 303–325), replace the inside of the `if (saved)` block with:

```javascript
      if (saved) {
        this._playerStates = saved.playerStates || {};
        this._gmSignal = saved.gmSignal || GM_SIGNAL.NONE;
        this._countdownEnd = saved.countdownEnd || null;
        this._direPerilActive = saved.direPerilActive === true;

        if (this._gmSignal === GM_SIGNAL.COUNTDOWN && this._countdownEnd) {
          if (this._countdownEnd > Date.now()) {
            this._countdownInterval = setInterval(() => this._tickCountdown(), 1000);
          } else {
            this._gmSignal = GM_SIGNAL.NONE;
            this._countdownEnd = null;
          }
        }
      }
```

- [ ] **Step 5: Extend `_saveToSettings()` to persist the field**

In `_saveToSettings()` (lines 327–341), replace the `game.settings.set` call with:

```javascript
      game.settings.set(MODULE_ID, 'pacerState', {
        playerStates: this._playerStates,
        gmSignal: this._gmSignal,
        countdownEnd: this._countdownEnd,
        direPerilActive: this._direPerilActive
      });
```

- [ ] **Step 6: Extend `receiveSyncState()`**

In `receiveSyncState()` (line 267), replace the function with:

```javascript
  receiveSyncState(state) {
    this._playerStates = state.playerStates || {};
    this._gmSignal = state.gmSignal || GM_SIGNAL.NONE;
    this._countdownEnd = state.countdownEnd || null;
    this._direPerilActive = state.direPerilActive === true;

    this._clearCountdownInterval();
    if (this._gmSignal === GM_SIGNAL.COUNTDOWN && this._countdownEnd) {
      this._countdownInterval = setInterval(() => this._tickCountdown(), 1000);
    }

    this._notifySubscribers();
  }
```

- [ ] **Step 7: Update `socket-handler.js`'s `_sendSyncState` to include the field**

In `scripts/socket-handler.js`, replace `_sendSyncState()` (lines 145–155) with:

```javascript
  _sendSyncState(targetUserId) {
    const state = PacerManager.getState();
    this._emit(EVENTS.SYNC_STATE, {
      targetUserId,
      state: {
        playerStates: state.playerStates,
        gmSignal: state.gmSignal,
        countdownEnd: state.countdownEnd,
        direPerilActive: state.direPerilActive
      }
    });
  }
```

- [ ] **Step 8: Manual validation**

1. Reload Foundry as GM.
2. Open browser console: `game.streamPacer.manager.getState()`.
3. Confirm return object includes `direPerilActive: false`.

- [ ] **Step 9: Commit**

```bash
git add scripts/settings.js scripts/PacerManager.js scripts/socket-handler.js
git commit -m "feat(peril): add direPerilActive state field + persistence + sync"
```

---

### Task 13: Add manager methods (declare, dismiss, sync receive)

**Files:**
- Modify: `scripts/PacerManager.js` — add methods + callback registration pattern

- [ ] **Step 1: Add callback-registration helper for Dire Peril events**

After the `onHandRaise()` method (line 37), insert:

```javascript
  /**
   * Register a callback for Dire Peril declare/dismiss events.
   * @param {Function} callback - Called with ({ active: boolean }) on state change
   * @returns {Function} Unsubscribe function
   */
  onDirePeril(callback) {
    this._direPerilCallbacks.add(callback);
    return () => this._direPerilCallbacks.delete(callback);
  }

  _notifyDirePeril(active) {
    for (const callback of this._direPerilCallbacks) {
      try {
        callback({ active });
      } catch (e) {
        console.error(`${MODULE_ID} | Dire Peril callback error:`, e);
      }
    }
  }
```

- [ ] **Step 2: Add `declareDirePeril()` and `dismissDirePeril()` GM actions**

After the `resetAll()` method (line 210), insert:

```javascript
  declareDirePeril(broadcast = true) {
    if (!game.user.isGM && broadcast) return;
    if (this._direPerilActive) return; // already active — ignore re-triggers

    this._direPerilActive = true;

    if (broadcast) {
      SocketHandler.emitDirePerilDeclare();
    }

    this._notifyDirePeril(true);
    this._notifySubscribers();
    this._saveToSettings();
  }

  dismissDirePeril(broadcast = true) {
    if (!game.user.isGM && broadcast) return;
    if (!this._direPerilActive) return;

    this._direPerilActive = false;

    if (broadcast) {
      SocketHandler.emitDirePerilDismiss();
    }

    this._notifyDirePeril(false);
    this._notifySubscribers();
    this._saveToSettings();
  }
```

- [ ] **Step 3: Add socket-receive methods**

After `receiveResetAll()` (line 265), insert:

```javascript
  receiveDirePerilDeclare() {
    if (this._direPerilActive) return;
    this._direPerilActive = true;
    this._notifyDirePeril(true);
    this._notifySubscribers();
    if (game.user.isGM) {
      this._saveToSettings();
    }
  }

  receiveDirePerilDismiss() {
    if (!this._direPerilActive) return;
    this._direPerilActive = false;
    this._notifyDirePeril(false);
    this._notifySubscribers();
    if (game.user.isGM) {
      this._saveToSettings();
    }
  }
```

- [ ] **Step 4: Include peril in `resetAll()` and `receiveResetAll()`**

In `resetAll()` (line 196), extend the function body to also reset peril:

```javascript
  resetAll(broadcast = true) {
    if (!game.user.isGM && broadcast) return;

    this._playerStates = {};
    this._gmSignal = GM_SIGNAL.NONE;
    this._countdownEnd = null;
    this._direPerilActive = false;
    this._clearCountdownInterval();

    if (broadcast) {
      SocketHandler.emitResetAll();
    }

    this._notifyDirePeril(false);
    this._notifySubscribers();
    this._saveToSettings();
  }
```

In `receiveResetAll()` (line 259), extend similarly:

```javascript
  receiveResetAll() {
    this._playerStates = {};
    this._gmSignal = GM_SIGNAL.NONE;
    this._countdownEnd = null;
    this._direPerilActive = false;
    this._clearCountdownInterval();
    this._notifyDirePeril(false);
    this._notifySubscribers();
  }
```

- [ ] **Step 5: Manual validation**

1. Reload as GM. Console: `game.streamPacer.manager.declareDirePeril()`.
2. Console: `game.streamPacer.manager.getState()` → expect `direPerilActive: true`.
3. Call `dismissDirePeril()` → returns to false.
4. `declareDirePeril()` again, then `resetAll()` → peril clears alongside other state.

(Socket events won't fire yet until Task 14 wires them — that's expected.)

- [ ] **Step 6: Commit**

```bash
git add scripts/PacerManager.js
git commit -m "feat(peril): manager methods — declare, dismiss, receive, reset"
```

---

### Task 14: Add socket events for Dire Peril

**Files:**
- Modify: `scripts/socket-handler.js` — add `EVENTS.DIRE_PERIL_DECLARE`, `DIRE_PERIL_DISMISS`, emit + receive

- [ ] **Step 1: Add events to the EVENTS dict**

Replace the `EVENTS` block (lines 6–15) with:

```javascript
const EVENTS = {
  PLAYER_STATUS_CHANGE: 'playerStatusChange',
  GM_SOFT_SIGNAL: 'gmSoftSignal',
  GM_HARD_COUNTDOWN: 'gmHardCountdown',
  GM_FLOOR_OPEN: 'gmFloorOpen',
  GM_CANCEL_SIGNAL: 'gmCancelSignal',
  REQUEST_STATE: 'requestState',
  SYNC_STATE: 'syncState',
  RESET_ALL: 'resetAll',
  DIRE_PERIL_DECLARE: 'direPerilDeclare',
  DIRE_PERIL_DISMISS: 'direPerilDismiss'
};
```

- [ ] **Step 2: Add `case` branches to `_handleMessage()`**

In `_handleMessage()` (around line 52), find the `case EVENTS.RESET_ALL:` block. After its `break;`, add:

```javascript
      case EVENTS.DIRE_PERIL_DECLARE:
        if (!senderIsGM) break;
        PacerManager.receiveDirePerilDeclare();
        break;

      case EVENTS.DIRE_PERIL_DISMISS:
        if (!senderIsGM) break;
        PacerManager.receiveDirePerilDismiss();
        break;
```

- [ ] **Step 3: Add emit methods**

After `emitResetAll()` (line 157), append:

```javascript
  emitDirePerilDeclare() {
    this._emit(EVENTS.DIRE_PERIL_DECLARE);
  }

  emitDirePerilDismiss() {
    this._emit(EVENTS.DIRE_PERIL_DISMISS);
  }
```

- [ ] **Step 4: Manual validation**

1. Open Foundry as GM in one browser window, as a player in another (or use private browsing).
2. Both windows open console.
3. GM runs: `game.streamPacer.manager.declareDirePeril()`.
4. Player console: `game.streamPacer.manager.getState()` → expect `direPerilActive: true` (state synced via socket).
5. GM runs: `game.streamPacer.manager.dismissDirePeril()` → player's state returns to false.
6. Attempt in player console: `game.streamPacer.manager.declareDirePeril()` → no effect (non-GM branch short-circuits).

- [ ] **Step 5: Commit**

```bash
git add scripts/socket-handler.js
git commit -m "feat(peril): socket events — declare + dismiss"
```

---

## Phase 7 — Dire Peril: GM button

### Task 15: Add Dire Peril GM button (template + click handler + CSS)

**Files:**
- Modify: `templates/pacer-hud.hbs` — insert 5th GM button between Floor Open and Cancel/Reset
- Modify: `scripts/PacerHUD.js` — add `declare-peril` action + pass `direPerilActive` to template for disabled state
- Modify: `styles/stream-pacer.css` — append `.dire-peril-btn` styling

- [ ] **Step 1: Update the GM controls block in `templates/pacer-hud.hbs`**

Find the GM controls section (updated in Task 3). Replace the `<div class="pacer-gm-controls">` block with:

```hbs
    <div class="pacer-gm-controls">
      <button type="button" class="gm-btn soft-signal-btn {{#if isSoftSignal}}active{{/if}}"
              data-action="soft-signal"
              title="{{localize 'STREAM_PACER.SoftSignalTooltip'}}">
        <i class="fa-solid fa-triangle-exclamation"></i>
      </button>
      <button type="button" class="gm-btn countdown-btn {{#if isCountdown}}active{{/if}}"
              data-action="start-countdown"
              title="{{localize 'STREAM_PACER.CountdownTooltip'}}">
        <i class="fa-solid fa-clock"></i>
      </button>
      <button type="button" class="gm-btn floor-open-btn {{#if isFloorOpen}}active{{/if}}"
              data-action="open-floor"
              title="{{localize 'STREAM_PACER.FloorOpenTooltip'}}">
        <i class="fa-solid fa-microphone"></i>
      </button>
      <button type="button" class="gm-btn dire-peril-btn {{#if direPerilActive}}disabled{{/if}}"
              data-action="declare-peril"
              {{#if direPerilActive}}disabled{{/if}}
              title="{{localize 'STREAM_PACER.DirePerilTooltip'}}">
        <i class="fa-solid fa-skull"></i>
      </button>
      {{#if hasActiveSignal}}
      <button type="button" class="gm-btn cancel-btn"
              data-action="cancel-signal"
              title="{{localize 'STREAM_PACER.CancelTooltip'}}">
        <i class="fa-solid fa-xmark"></i>
      </button>
      {{/if}}
      <button type="button" class="gm-btn reset-btn"
              data-action="reset-all"
              title="{{localize 'STREAM_PACER.ResetTooltip'}}">
        <i class="fa-solid fa-arrows-rotate"></i>
      </button>
    </div>
```

- [ ] **Step 2: Pass `direPerilActive` to template context in `scripts/PacerHUD.js`**

In `_prepareContext()` (line 77), replace the return object with:

```javascript
    return {
      isGM: game.user.isGM,
      players,
      myStatus,
      myStatusEngaged: myStatus === PLAYER_STATUS.ENGAGED,
      myStatusHandRaised: myStatus === PLAYER_STATUS.HAND_RAISED,
      myStatusNeedTime: myStatus === PLAYER_STATUS.NEED_TIME,
      myStatusReady: myStatus === PLAYER_STATUS.READY,
      gmSignal: state.gmSignal,
      isSoftSignal: state.gmSignal === GM_SIGNAL.SOFT,
      isCountdown: state.gmSignal === GM_SIGNAL.COUNTDOWN,
      isFloorOpen: state.gmSignal === GM_SIGNAL.FLOOR_OPEN,
      hasActiveSignal: state.gmSignal !== GM_SIGNAL.NONE,
      formattedCountdown,
      countdownUrgency,
      handRaisedCount: state.handRaisedCount,
      direPerilActive: state.direPerilActive,
      PLAYER_STATUS,
      GM_SIGNAL
    };
```

- [ ] **Step 3: Add `declare-peril` case to the click handler**

In `_setupListeners()` (line 170), inside the `switch (action)`, after the `case 'reset-all':` block, add:

```javascript
        case 'declare-peril':
          if (game.user.isGM) PacerManager.declareDirePeril();
          break;
```

- [ ] **Step 4: Adjust the button grid to 5 columns**

The CSS in Task 5 already sets `grid-template-columns: repeat(5, 1fr)`. The Cancel button (only visible during active signals) will push to a second row automatically — this is acceptable. If it looks bad, fall back to `repeat(auto-fit, minmax(44px, 1fr))`. For now, leave 5-col and confirm in validation.

- [ ] **Step 5: Append Dire Peril button CSS at the end of `styles/stream-pacer.css`** (before the reduced-motion block)

```css
/* Dire Peril button */
#stream-pacer-container .gm-btn.dire-peril-btn {
  border-color: rgba(175, 45, 185, 0.55);
  color: var(--sp-peril-bright);
}

#stream-pacer-container .gm-btn.dire-peril-btn:hover:not(.disabled):not([disabled]) {
  color: #fff;
  border-color: var(--sp-peril);
  background: linear-gradient(180deg, rgba(175, 45, 185, 0.22), rgba(175, 45, 185, 0.08));
  box-shadow:
    0 0 12px var(--sp-peril-glow),
    inset 0 0 8px var(--sp-peril-red-glow);
}

#stream-pacer-container .gm-btn.dire-peril-btn.disabled,
#stream-pacer-container .gm-btn.dire-peril-btn[disabled] {
  opacity: 0.35;
  pointer-events: none;
  cursor: default;
}
```

- [ ] **Step 6: Manual validation**

1. Reload as GM. Command row shows 5 buttons: soft, countdown, floor, skull (purple outline), reset.
2. Click the skull button. Peril state flips to active (`game.streamPacer.manager.getState().direPerilActive === true`).
3. Re-render the HUD (any state change works — set any status). Skull button is now disabled (greyed out, no hover).
4. Call `game.streamPacer.manager.dismissDirePeril()`. Button becomes active again.
5. Hover on the button in the active state — purple glow + red inner glow appears.

- [ ] **Step 7: Commit**

```bash
git add templates/pacer-hud.hbs scripts/PacerHUD.js styles/stream-pacer.css
git commit -m "feat(peril): GM button + click handler + purple styling"
```

---

## Phase 8 — Dire Peril: full-screen animation stage

### Task 16: Create `peril-stage.hbs` template + `PerilOverlay.js` skeleton

**Files:**
- Create: `templates/peril-stage.hbs`
- Create: `scripts/PerilOverlay.js`

- [ ] **Step 1: Create `templates/peril-stage.hbs`**

```hbs
<div class="peril-wash"></div>
<div class="peril-watermark">PERIL</div>

<div class="peril-slash peril-slash-a"></div>
<div class="peril-slash peril-slash-b"></div>

<div class="peril-dot-pair peril-dot-pair-l"><span></span><span></span><span></span></div>
<div class="peril-dot-pair peril-dot-pair-r"><span></span><span></span><span></span></div>

<div class="peril-run peril-line-t">
  <div class="peril-run-track">
    <span>{{runTop}}</span>
    <span>{{runTop}}</span>
  </div>
</div>
<div class="peril-run peril-line-b">
  <div class="peril-run-track peril-run-track-rev">
    <span>{{runBottom}}</span>
    <span>{{runBottom}}</span>
  </div>
</div>

<div class="peril-vcol peril-vcol-l">
  <div class="peril-vcol-track">
    <span>{{columnLeft}}</span>
    <span>{{columnLeft}}</span>
  </div>
</div>
<div class="peril-vcol peril-vcol-r">
  <div class="peril-vcol-track peril-vcol-track-rev">
    <span>{{columnRight}}</span>
    <span>{{columnRight}}</span>
  </div>
</div>

<div class="peril-flash-stage">
  <span class="peril-l">D</span>
  <span class="peril-l">I</span>
  <span class="peril-l">R</span>
  <span class="peril-l">E</span>
  <span class="peril-l">P</span>
  <span class="peril-l">E</span>
  <span class="peril-l">R</span>
  <span class="peril-l">I</span>
  <span class="peril-l">L</span>
</div>

<div class="peril-impact"></div>

<div class="peril-title">
  <div class="peril-tag">{{tag}}</div>
  <div class="peril-word-dire">{{wordDire}}</div>
  <div class="peril-rule"></div>
  <div class="peril-word-peril">{{wordPeril}}</div>
  <div class="peril-sub">{{subtitle}}</div>
</div>
```

- [ ] **Step 2: Create `scripts/PerilOverlay.js`**

```javascript
import { MODULE_ID } from './settings.js';
import { PacerManager } from './PacerManager.js';

const STAGE_TEMPLATE = `modules/${MODULE_ID}/templates/peril-stage.hbs`;
const INDICATOR_TEMPLATE = `modules/${MODULE_ID}/templates/peril-indicator.hbs`;

/** Full animation duration (ms) from declare to indicator handoff. */
const STAGE_DURATION_MS = 5500;
/** Offset (ms) before end at which the indicator appears. */
const INDICATOR_LEAD_MS = 800;

export class PerilOverlay {
  constructor() {
    this._stageEl = null;        // persistent container element
    this._indicatorEl = null;    // persistent container element
    this._stageTimer = null;
    this._indicatorTimer = null;
    this._unsubscribe = null;
  }

  initialize() {
    this._createStageContainer();
    this._createIndicatorContainer();

    // Subscribe to peril events from the manager
    this._unsubscribe = PacerManager.onDirePeril(({ active }) => {
      if (active) {
        this._playStageAndShowIndicator();
      } else {
        this._hideIndicator();
      }
    });
  }

  /**
   * Late-join helper — render just the indicator with no animation,
   * used by module.js when a client joins and peril is already active.
   */
  showIndicatorOnly() {
    if (this._indicatorEl && this._indicatorEl.childElementCount > 0) return;
    this._renderIndicator();
  }

  _createStageContainer() {
    if (this._stageEl) return;
    const el = document.createElement('div');
    el.className = 'stream-pacer-peril-stage';
    document.body.appendChild(el);
    this._stageEl = el;
  }

  _createIndicatorContainer() {
    if (this._indicatorEl) return;
    const el = document.createElement('div');
    el.className = 'stream-pacer-peril-indicator-wrap';
    document.body.appendChild(el);
    this._indicatorEl = el;
  }

  async _playStageAndShowIndicator() {
    await this._renderStage();
    this._scheduleHandoff();
  }

  async _renderStage() {
    if (!this._stageEl) this._createStageContainer();

    const context = {
      tag: game.i18n.localize('STREAM_PACER.DirePerilTag'),
      wordDire: game.i18n.localize('STREAM_PACER.DirePerilTitleDire'),
      wordPeril: game.i18n.localize('STREAM_PACER.DirePerilTitlePeril'),
      subtitle: game.i18n.localize('STREAM_PACER.DirePerilSubtitle'),
      runTop: game.i18n.localize('STREAM_PACER.DirePerilRunTop'),
      runBottom: game.i18n.localize('STREAM_PACER.DirePerilRunBottom'),
      columnLeft: game.i18n.localize('STREAM_PACER.DirePerilColumnLeft'),
      columnRight: game.i18n.localize('STREAM_PACER.DirePerilColumnRight')
    };

    const html = await renderTemplate(STAGE_TEMPLATE, context);
    this._stageEl.innerHTML = html;
    // Force reflow then add the playing class to kick off CSS animations
    void this._stageEl.offsetWidth;
    this._stageEl.classList.add('playing');
  }

  _scheduleHandoff() {
    clearTimeout(this._indicatorTimer);
    clearTimeout(this._stageTimer);

    // Mount the indicator during the stage's fade-out
    this._indicatorTimer = setTimeout(() => {
      this._renderIndicator();
    }, STAGE_DURATION_MS - INDICATOR_LEAD_MS);

    // Remove the stage content after the full duration
    this._stageTimer = setTimeout(() => {
      this._unmountStage();
    }, STAGE_DURATION_MS);
  }

  _unmountStage() {
    if (!this._stageEl) return;
    this._stageEl.classList.remove('playing');
    // Wait a tick before clearing innerHTML so CSS transitions complete
    setTimeout(() => {
      if (this._stageEl) this._stageEl.innerHTML = '';
    }, 300);
  }

  async _renderIndicator() {
    if (!this._indicatorEl) this._createIndicatorContainer();

    const context = {
      isGM: game.user.isGM,
      label: game.i18n.localize('STREAM_PACER.DirePerilTitle'),
      header: game.i18n.localize('STREAM_PACER.DirePerilHazardActive'),
      dismissTooltip: game.i18n.localize('STREAM_PACER.DirePerilDismiss')
    };

    const html = await renderTemplate(INDICATOR_TEMPLATE, context);
    this._indicatorEl.innerHTML = html;

    // Wire dismiss button (GM only — template guards render)
    const dismissBtn = this._indicatorEl.querySelector('[data-action="dismiss-peril"]');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        PacerManager.dismissDirePeril();
      });
    }

    // Force reflow then add visible class for enter animation
    void this._indicatorEl.offsetWidth;
    this._indicatorEl.classList.add('visible');
  }

  _hideIndicator() {
    clearTimeout(this._indicatorTimer);
    clearTimeout(this._stageTimer);
    this._unmountStage();
    if (!this._indicatorEl) return;
    this._indicatorEl.classList.remove('visible');
    setTimeout(() => {
      if (this._indicatorEl) this._indicatorEl.innerHTML = '';
    }, 400);
  }

  destroy() {
    clearTimeout(this._stageTimer);
    clearTimeout(this._indicatorTimer);
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    if (this._stageEl) {
      this._stageEl.remove();
      this._stageEl = null;
    }
    if (this._indicatorEl) {
      this._indicatorEl.remove();
      this._indicatorEl = null;
    }
  }
}
```

- [ ] **Step 3: Register PerilOverlay in `scripts/module.js`**

Replace the import block (lines 1–7) with:

```javascript
import { MODULE_ID, registerSettings } from './settings.js';
import { PacerManager } from './PacerManager.js';
import { SocketHandler } from './socket-handler.js';
import { PacerHUD } from './PacerHUD.js';
import { PacerOverlay } from './PacerOverlay.js';
import { AudioManager } from './AudioManager.js';
import { HandRaiseSidebar } from './HandRaiseSidebar.js';
import { PerilOverlay } from './PerilOverlay.js';
```

Add variable:

```javascript
let perilOverlay = null;
```

(next to the other `let` declarations around line 12)

In the `Hooks.once('ready', ...)` block, inside the `if (!isExempt) { ... }` branch, after the `pacerOverlay.initialize();` line, add:

```javascript
    perilOverlay = new PerilOverlay();
    perilOverlay.initialize();
```

Expose in `game.streamPacer`:

```javascript
  game.streamPacer = {
    manager: PacerManager,
    socket: SocketHandler,
    hud: pacerHUD,
    overlay: pacerOverlay,
    audio: audioManager,
    handSidebar: handRaiseSidebar,
    peril: perilOverlay
  };
```

Add late-join indicator restoration at the very end of the `ready` hook body, just before the closing `})`:

```javascript
  // Late-join: if peril is already active, show the indicator only (no replay).
  if (!isExempt && PacerManager.getState().direPerilActive) {
    perilOverlay.showIndicatorOnly();
  }
```

- [ ] **Step 4: Manual validation**

1. Reload Foundry. Confirm no errors in console.
2. Console: `game.streamPacer.peril` — returns the PerilOverlay instance.
3. The stage and indicator containers exist in the DOM but are empty.

(No visible animation yet — CSS comes in Tasks 17–20.)

- [ ] **Step 5: Commit**

```bash
git add templates/peril-stage.hbs scripts/PerilOverlay.js scripts/module.js
git commit -m "feat(peril): PerilOverlay skeleton + stage template + registration"
```

---

### Task 17: Dire Peril stage CSS — backdrop, watermark, slashes, dot pairs

**Files:**
- Modify: `styles/stream-pacer.css` — append Dire Peril stage block (before reduced-motion at the end)

- [ ] **Step 1: Append the stage foundation block**

Add before the `@media (prefers-reduced-motion: reduce)` block:

```css
/* ========================================
   Dire Peril — Full-Screen Stage
   Plays once (5500ms) then hands off to the corner indicator.
   ======================================== */

.stream-pacer-peril-stage {
  position: fixed;
  inset: 0;
  z-index: 9999;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  background: #000;
  color: #fff;
  font-family: 'Rajdhani', sans-serif;
  transition: opacity 1s ease-in 4.5s, visibility 0s linear 5.5s;
}

.stream-pacer-peril-stage.playing {
  opacity: 1;
  visibility: visible;
}

/* Faint scan lines across entire stage */
.stream-pacer-peril-stage::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(0deg, transparent 0 2px, rgba(255, 255, 255, 0.014) 2px 3px);
  pointer-events: none;
  z-index: 0;
}

/* Radial purple → black backdrop */
.stream-pacer-peril-stage .peril-wash {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: radial-gradient(ellipse at 50% 50%, rgba(60, 15, 120, 0.6), #000 75%);
  opacity: 0;
  animation: sp-peril-wash 5500ms ease-in-out forwards;
}

@keyframes sp-peril-wash {
  0% { opacity: 0; }
  4% { opacity: 1; }
  82% { opacity: 1; }
  100% { opacity: 0; }
}

/* Giant stroked-outline "PERIL" watermark behind title */
.stream-pacer-peril-stage .peril-watermark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.5);
  z-index: 12;
  font-family: 'Rajdhani', sans-serif;
  font-size: 340px;
  font-weight: 700;
  color: transparent;
  -webkit-text-stroke: 2px rgba(175, 45, 185, 0.25);
  letter-spacing: 4px;
  text-transform: uppercase;
  line-height: 1;
  white-space: nowrap;
  opacity: 0;
  animation: sp-peril-watermark 5500ms cubic-bezier(0.25, 1, 0.4, 1) forwards;
}

@keyframes sp-peril-watermark {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
  18% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
  28% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  82% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; }
}

/* Diagonal purple→red slashes */
.stream-pacer-peril-stage .peril-slash {
  position: absolute;
  z-index: 14;
  height: 3px;
  background: linear-gradient(90deg, transparent, var(--sp-peril) 30%, var(--sp-peril-red) 50%, var(--sp-peril) 70%, transparent);
  box-shadow: 0 0 12px var(--sp-peril-red-glow), 0 0 28px var(--sp-peril-glow);
  opacity: 0;
}

.stream-pacer-peril-stage .peril-slash-a {
  top: 18%;
  left: -5%;
  width: 45%;
  transform: rotate(-6deg);
  animation: sp-peril-slash-a 5500ms ease-out forwards;
}

.stream-pacer-peril-stage .peril-slash-b {
  bottom: 18%;
  right: -5%;
  width: 45%;
  transform: rotate(-6deg);
  animation: sp-peril-slash-b 5500ms ease-out forwards;
}

@keyframes sp-peril-slash-a {
  0%, 47% { opacity: 0; left: -50%; }
  55% { opacity: 1; left: -5%; }
  82% { opacity: 1; left: -5%; }
  100% { opacity: 0; }
}

@keyframes sp-peril-slash-b {
  0%, 49% { opacity: 0; right: -50%; }
  57% { opacity: 1; right: -5%; }
  82% { opacity: 1; right: -5%; }
  100% { opacity: 0; }
}

/* Side dot pairs (small decorative) */
.stream-pacer-peril-stage .peril-dot-pair {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 24;
  display: flex;
  flex-direction: column;
  gap: 4px;
  opacity: 0;
  animation: sp-peril-dot 5500ms ease-out forwards;
}

.stream-pacer-peril-stage .peril-dot-pair-l { left: 9%; }
.stream-pacer-peril-stage .peril-dot-pair-r { right: 9%; }

.stream-pacer-peril-stage .peril-dot-pair span {
  width: 4px;
  height: 4px;
  background: var(--sp-peril-red);
  border-radius: 50%;
  box-shadow: 0 0 6px var(--sp-peril-red);
}
.stream-pacer-peril-stage .peril-dot-pair span:nth-child(even) {
  background: var(--sp-peril);
  box-shadow: 0 0 6px var(--sp-peril);
}

@keyframes sp-peril-dot {
  0%, 55% { opacity: 0; }
  65% { opacity: 1; }
  82% { opacity: 1; }
  100% { opacity: 0; }
}
```

- [ ] **Step 2: Manual validation**

1. Reload Foundry.
2. Console: `game.streamPacer.manager.declareDirePeril()`.
3. Screen goes to full-screen purple radial wash, a giant stroked-outline "PERIL" fades in behind center, diagonal slashes sweep in, side dot-pairs appear. After 5.5s everything fades.
4. Letter flash, title, and running text are missing (Tasks 18–20) — that's expected.

- [ ] **Step 3: Commit**

```bash
git add styles/stream-pacer.css
git commit -m "styles(peril): stage — wash, watermark, slashes, dot pairs"
```

---

### Task 18: Dire Peril stage CSS — letter flash cascade + impact flash

**Files:**
- Modify: `styles/stream-pacer.css` — append after the dot-pair block

- [ ] **Step 1: Append the letter-flash and impact-flash CSS**

```css
/* Letter flash cascade — each letter of DIRE PERIL appears ~120ms, center-stage */
.stream-pacer-peril-stage .peril-flash-stage {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 30;
  pointer-events: none;
}

.stream-pacer-peril-stage .peril-l {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(1.15);
  font-family: 'Rajdhani', sans-serif;
  font-size: 280px;
  font-weight: 700;
  color: #fff;
  line-height: 0.9;
  text-transform: uppercase;
  text-shadow:
    0 0 30px #fff,
    0 0 60px var(--sp-peril-glow),
    0 0 100px var(--sp-peril-red-glow);
  opacity: 0;
  animation: sp-peril-letter 5500ms linear forwards;
}

/* Per-letter delays (9 letters: D I R E P E R I L)
   D 220ms, I 320, R 420, E 520, (gap 100ms), P 720, E 820, R 920, I 1020, L 1120 */
.stream-pacer-peril-stage .peril-l:nth-child(1) { animation-delay: 220ms; }
.stream-pacer-peril-stage .peril-l:nth-child(2) { animation-delay: 320ms; }
.stream-pacer-peril-stage .peril-l:nth-child(3) { animation-delay: 420ms; }
.stream-pacer-peril-stage .peril-l:nth-child(4) { animation-delay: 520ms; }
.stream-pacer-peril-stage .peril-l:nth-child(5) { animation-delay: 720ms; }
.stream-pacer-peril-stage .peril-l:nth-child(6) { animation-delay: 820ms; }
.stream-pacer-peril-stage .peril-l:nth-child(7) { animation-delay: 920ms; }
.stream-pacer-peril-stage .peril-l:nth-child(8) { animation-delay: 1020ms; }
.stream-pacer-peril-stage .peril-l:nth-child(9) { animation-delay: 1120ms; }

@keyframes sp-peril-letter {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(1.15); }
  0.4% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  1.4% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  2% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
}

/* Impact flash at 1400–1500ms */
.stream-pacer-peril-stage .peril-impact {
  position: absolute;
  inset: 0;
  z-index: 40;
  background: radial-gradient(ellipse, rgba(255, 255, 255, 0.9), rgba(255, 46, 90, 0.3) 60%, transparent);
  opacity: 0;
  animation: sp-peril-impact 5500ms steps(1) forwards;
}

@keyframes sp-peril-impact {
  0%, 25.45% { opacity: 0; }
  25.46%, 27.27% { opacity: 1; }
  27.28%, 100% { opacity: 0; }
}
```

Note on percentages: 5500ms full → 25.45% ≈ 1400ms, 27.27% ≈ 1500ms.

- [ ] **Step 2: Manual validation**

1. Console: `game.streamPacer.manager.dismissDirePeril()` to clear prior state, then `declareDirePeril()`.
2. After the wash fades in, the 9 letters of `DIRE PERIL` flash in sequence center-stage, each ~120ms, with the word break visible between `E` and `P`. Immediately after the last letter fades, a bright white+red radial flash strikes the screen for 100ms.
3. The title composition is still missing — Task 19 adds it.

- [ ] **Step 3: Commit**

```bash
git add styles/stream-pacer.css
git commit -m "styles(peril): stage — letter flash cascade + impact"
```

---

### Task 19: Dire Peril stage CSS — title composition (tag, words, rule, subtitle)

**Files:**
- Modify: `styles/stream-pacer.css` — append after the impact block

- [ ] **Step 1: Append the title composition CSS**

```css
/* Settled title composition — appears after impact flash */
.stream-pacer-peril-stage .peril-title {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 22;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: 0;
  animation: sp-peril-title-fade 5500ms ease-out forwards;
}

@keyframes sp-peril-title-fade {
  0%, 22% { opacity: 0; }
  28% { opacity: 1; }
  82% { opacity: 1; }
  100% { opacity: 0; }
}

.stream-pacer-peril-stage .peril-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  letter-spacing: 6px;
  color: var(--sp-peril-red);
  text-transform: uppercase;
  font-weight: 500;
  margin-bottom: 8px;
  opacity: 0;
  animation: sp-peril-tag 5500ms ease-out forwards;
}

@keyframes sp-peril-tag {
  0%, 38% { opacity: 0; }
  46% { opacity: 1; }
  82% { opacity: 1; }
  100% { opacity: 0; }
}

.stream-pacer-peril-stage .peril-word-dire,
.stream-pacer-peril-stage .peril-word-peril {
  font-family: 'Rajdhani', sans-serif;
  font-size: 140px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 8px;
  text-transform: uppercase;
  line-height: 0.9;
  text-shadow:
    0 0 30px var(--sp-peril-glow),
    0 0 60px var(--sp-peril-red-glow),
    0 4px 10px #000;
  opacity: 0;
}

.stream-pacer-peril-stage .peril-word-dire {
  transform: translateX(-800px);
  animation: sp-peril-word-dire 5500ms cubic-bezier(0.2, 1, 0.3, 1) forwards;
}

.stream-pacer-peril-stage .peril-word-peril {
  transform: translateX(800px);
  animation: sp-peril-word-peril 5500ms cubic-bezier(0.2, 1, 0.3, 1) forwards;
}

@keyframes sp-peril-word-dire {
  0%, 27% { opacity: 0; transform: translateX(-800px); }
  33% { opacity: 1; transform: translateX(-16px); }
  36% { opacity: 1; transform: translateX(0); }
  82% { opacity: 1; transform: translateX(0); }
  100% { opacity: 0; }
}

@keyframes sp-peril-word-peril {
  0%, 29% { opacity: 0; transform: translateX(800px); }
  35% { opacity: 1; transform: translateX(16px); }
  38% { opacity: 1; transform: translateX(0); }
  82% { opacity: 1; transform: translateX(0); }
  100% { opacity: 0; }
}

.stream-pacer-peril-stage .peril-rule {
  height: 2px;
  width: 0;
  background: linear-gradient(90deg, transparent, var(--sp-peril-red) 30%, var(--sp-peril) 50%, var(--sp-peril-red) 70%, transparent);
  box-shadow: 0 0 10px var(--sp-peril-red-glow);
  margin: 4px 0;
  animation: sp-peril-rule 5500ms ease-out forwards;
}

@keyframes sp-peril-rule {
  0%, 37% { width: 0; opacity: 0; }
  42% { width: 360px; opacity: 1; }
  82% { width: 360px; opacity: 1; }
  100% { width: 0; opacity: 0; }
}

.stream-pacer-peril-stage .peril-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  letter-spacing: 6px;
  color: var(--sp-peril-bright);
  text-transform: uppercase;
  margin-top: 10px;
  white-space: nowrap;
  overflow: hidden;
  max-width: 0;
  animation: sp-peril-sub 5500ms steps(40) forwards;
}

@keyframes sp-peril-sub {
  0%, 45% { max-width: 0; }
  56% { max-width: 520px; }
  82% { max-width: 520px; }
  100% { max-width: 0; }
}
```

- [ ] **Step 2: Manual validation**

1. Console: `game.streamPacer.manager.dismissDirePeril()` then `declareDirePeril()`.
2. After impact flash, title composition appears:
   - Tag `// OPERATIONAL HAZARD //` on top in monospace red
   - `DIRE` slams in from left
   - `PERIL` slams in from right, stacked below DIRE
   - Thin red-purple rule draws between
   - Subtitle `// DEATH IS ON THE TABLE //` types in underneath
3. Entire composition holds for ~3s then fades out.

- [ ] **Step 3: Commit**

```bash
git add styles/stream-pacer.css
git commit -m "styles(peril): stage — title composition with word slams + rule + subtitle"
```

---

### Task 20: Dire Peril stage CSS — running lines + vertical columns

**Files:**
- Modify: `styles/stream-pacer.css` — append after the title block

- [ ] **Step 1: Append the running text + vertical column CSS**

```css
/* Horizontal running data lines */
.stream-pacer-peril-stage .peril-run {
  position: absolute;
  z-index: 25;
  left: 0;
  right: 0;
  height: 18px;
  overflow: hidden;
  white-space: nowrap;
  pointer-events: none;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--sp-peril-bright);
  -webkit-mask-image: linear-gradient(90deg, transparent, black 4%, black 96%, transparent);
          mask-image: linear-gradient(90deg, transparent, black 4%, black 96%, transparent);
  opacity: 0;
  animation: sp-peril-line 5500ms ease-out forwards;
}

.stream-pacer-peril-stage .peril-line-t { top: 46px; animation-delay: 0ms; }
.stream-pacer-peril-stage .peril-line-b { bottom: 46px; animation-delay: 100ms; }

@keyframes sp-peril-line {
  0%, 56% { opacity: 0; }
  65% { opacity: 0.85; }
  82% { opacity: 0.85; }
  100% { opacity: 0; }
}

.stream-pacer-peril-stage .peril-run-track {
  display: inline-flex;
  animation: sp-peril-run-lr 18s linear infinite;
}
.stream-pacer-peril-stage .peril-run-track-rev {
  animation: sp-peril-run-rl 22s linear infinite;
}
.stream-pacer-peril-stage .peril-run-track > span {
  padding: 0 26px;
}

@keyframes sp-peril-run-lr {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@keyframes sp-peril-run-rl {
  0% { transform: translateX(-50%); }
  100% { transform: translateX(0); }
}

/* Vertical upright English columns — one char per line, top-to-bottom */
.stream-pacer-peril-stage .peril-vcol {
  position: absolute;
  top: 20px;
  bottom: 20px;
  width: 24px;
  overflow: hidden;
  pointer-events: none;
  writing-mode: vertical-rl;
  text-orientation: upright;
  font-family: 'Rajdhani', sans-serif;
  font-size: 12px;
  letter-spacing: 8px;
  font-weight: 600;
  line-height: 1;
  color: var(--sp-peril-bright);
  -webkit-mask-image: linear-gradient(180deg, transparent, black 6%, black 94%, transparent);
          mask-image: linear-gradient(180deg, transparent, black 6%, black 94%, transparent);
  opacity: 0;
  animation: sp-peril-vcol 5500ms ease-out forwards;
  z-index: 22;
}

.stream-pacer-peril-stage .peril-vcol-l { left: 32px; animation-delay: 200ms; }
.stream-pacer-peril-stage .peril-vcol-r { right: 32px; animation-delay: 400ms; }

@keyframes sp-peril-vcol {
  0%, 56% { opacity: 0; }
  65% { opacity: 0.85; }
  82% { opacity: 0.85; }
  100% { opacity: 0; }
}

.stream-pacer-peril-stage .peril-vcol-track {
  display: inline-flex;
  animation: sp-peril-vcol-dn 20s linear infinite;
}
.stream-pacer-peril-stage .peril-vcol-track-rev {
  animation: sp-peril-vcol-up 24s linear infinite;
}
.stream-pacer-peril-stage .peril-vcol-track > span {
  padding: 32px 0;
  display: inline-block;
}

@keyframes sp-peril-vcol-dn {
  0% { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}
@keyframes sp-peril-vcol-up {
  0% { transform: translateY(-50%); }
  100% { transform: translateY(0); }
}
```

- [ ] **Step 2: Manual validation**

1. Console: `dismissDirePeril()` then `declareDirePeril()`.
2. After title lands, horizontal running data lines appear on top and bottom (English tech copy scrolling). Vertical columns on left and right, English letters stacked upright (one letter per line).
3. Full sequence now runs end-to-end. Total visible duration ~5.5s. Indicator won't yet appear — Task 22 adds it.

- [ ] **Step 3: Commit**

```bash
git add styles/stream-pacer.css
git commit -m "styles(peril): stage — running lines + vertical upright English columns"
```

---

## Phase 9 — Dire Peril: persistent indicator

### Task 21: Create `peril-indicator.hbs` template

**Files:**
- Create: `templates/peril-indicator.hbs`

- [ ] **Step 1: Create the indicator template**

```hbs
<div class="stream-pacer-peril-indicator">
  <div class="peril-ind-icon">
    <i class="fa-solid fa-skull"></i>
  </div>
  <div class="peril-ind-stack">
    <div class="peril-ind-header">{{header}}</div>
    <div class="peril-ind-main">{{label}}</div>
  </div>
  {{#if isGM}}
  <button type="button" class="peril-ind-dismiss" data-action="dismiss-peril"
          title="{{dismissTooltip}}">
    <i class="fa-solid fa-xmark"></i>
  </button>
  {{/if}}
</div>
```

- [ ] **Step 2: Manual validation**

No visible change yet — the indicator template renders via PerilOverlay (already wired in Task 16). But until the CSS in Task 22 exists, the indicator will look plain. Proceed to Task 22.

- [ ] **Step 3: Commit**

```bash
git add templates/peril-indicator.hbs
git commit -m "feat(peril): indicator template"
```

---

### Task 22: Dire Peril indicator CSS + enter/exit animations

**Files:**
- Modify: `styles/stream-pacer.css` — append before the reduced-motion block

- [ ] **Step 1: Append the indicator CSS**

```css
/* ========================================
   Dire Peril — Persistent Corner Indicator
   ======================================== */

.stream-pacer-peril-indicator-wrap {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 100;
  pointer-events: none;
}

.stream-pacer-peril-indicator-wrap.visible .stream-pacer-peril-indicator {
  pointer-events: auto;
  opacity: 1;
  transform: translateY(0);
}

.stream-pacer-peril-indicator {
  min-width: 210px;
  padding: 9px 14px 9px 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #fff;
  font-family: 'Rajdhani', sans-serif;

  background: linear-gradient(180deg, rgba(45, 10, 90, 0.96), rgba(20, 4, 42, 0.98));
  border: 1px solid rgba(175, 45, 185, 0.5);
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  box-shadow:
    0 8px 22px rgba(0, 0, 0, 0.55),
    0 0 24px var(--sp-peril-glow);

  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.4s ease-out, transform 0.4s ease-out;
  animation: sp-peril-ind-pulse 2.4s ease-in-out infinite;
}

.stream-pacer-peril-indicator::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(0deg, transparent 0 2px, rgba(255, 255, 255, 0.02) 2px 3px);
  pointer-events: none;
}

/* Left edge gradient bar */
.stream-pacer-peril-indicator::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 2px;
  background: linear-gradient(180deg, var(--sp-peril), var(--sp-peril-red));
  box-shadow: 0 0 8px var(--sp-peril);
  animation: sp-peril-ind-bar 1.8s ease-in-out infinite;
}

.stream-pacer-peril-indicator .peril-ind-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--sp-peril-red);
  color: var(--sp-peril-red);
  clip-path: polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px);
  font-size: 16px;
  filter: drop-shadow(0 0 4px var(--sp-peril-red-glow));
}

.stream-pacer-peril-indicator .peril-ind-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stream-pacer-peril-indicator .peril-ind-header {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  letter-spacing: 2.5px;
  color: var(--sp-peril-red);
  text-transform: uppercase;
}

.stream-pacer-peril-indicator .peril-ind-main {
  font-family: 'Rajdhani', sans-serif;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 2.5px;
  text-transform: uppercase;
  color: #fff;
}

.stream-pacer-peril-indicator .peril-ind-dismiss {
  margin-left: auto;
  padding: 2px 5px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.55);
  background: transparent;
  border: 1px solid rgba(175, 45, 185, 0.3);
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease;
}

.stream-pacer-peril-indicator .peril-ind-dismiss:hover {
  color: #fff;
  border-color: var(--sp-peril);
}

@keyframes sp-peril-ind-pulse {
  0%, 100% {
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.55), 0 0 24px var(--sp-peril-glow);
  }
  50% {
    box-shadow:
      0 8px 22px rgba(0, 0, 0, 0.55),
      0 0 34px rgba(175, 45, 185, 0.7),
      0 0 48px var(--sp-peril-red-glow);
  }
}

@keyframes sp-peril-ind-bar {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}
```

- [ ] **Step 2: Manual validation**

1. Console: `dismissDirePeril()` (to ensure clean state), then `declareDirePeril()`.
2. Full-screen animation plays once. At ~4.7s into the sequence, the persistent indicator fades up at bottom-right: compact plaque with skull icon in red-bordered box, `// HAZARD ACTIVE` header, `DIRE PERIL` label, dismiss X on the right.
3. Indicator pulses purple + red glow, left bar pulses.
4. Full-screen stage finishes fading. Indicator remains.
5. Click the dismiss X. Indicator fades out. `getState().direPerilActive === false`.
6. Player client (non-GM) sees no dismiss button — the `{{#if isGM}}` branch guards the render.
7. Open a second player client after declaring peril. Late-join: they see the indicator (no animation replay) — validates `showIndicatorOnly()` path.

- [ ] **Step 3: Commit**

```bash
git add styles/stream-pacer.css
git commit -m "styles(peril): persistent corner indicator + enter/exit + pulse"
```

---

## Phase 10 — Localization + metadata

### Task 23: Add all new localization keys to `languages/en.json`

**Files:**
- Modify: `languages/en.json` — add all new keys

- [ ] **Step 1: Replace the full `languages/en.json` with:**

```json
{
  "STREAM_PACER": {
    "Title": "Scene Pacing",
    "SceneControl": "Stream Pacer",
    "NoPlayers": "No active players",
    "YourStatus": "Your Status",
    "HandsRaised": "Hands Raised",
    "HasHandRaised": "has their hand raised!",
    "DragToMove": "Drag to move",

    "SectionOperators": "Operators",
    "SectionStatus": "Status",
    "SectionCommand": "Command",

    "Status": {
      "engaged": "Engaged - actively participating",
      "hand_raised": "Hand Raised - I want to do/say something",
      "need_time": "Need Time - I'm still thinking/processing",
      "ready": "Ready - done with scene"
    },

    "StatusShort": {
      "engaged": "Engaged",
      "hand_raised": "Hand Up",
      "need_time": "Thinking",
      "ready": "Ready"
    },

    "SoftSignal": "Soft Signal",
    "SoftSignalTooltip": "Send a gentle nudge that you'd like to wrap up",
    "SoftSignalMessage": "GM would like to wrap up",

    "Countdown": "Countdown",
    "CountdownTooltip": "Start a countdown timer for scene ending",
    "CountdownMessage": "Scene ending in:",
    "CountdownDuration": "Countdown Duration",
    "StartCountdown": "Start Countdown",
    "Start": "Start",
    "Minutes": "minutes",

    "FloorOpen": "Open Floor",
    "FloorOpenTooltip": "Open the floor for player actions - raise your hand",
    "FloorOpenMessage": "Floor is open - raise your hand",

    "Cancel": "Cancel",
    "CancelTooltip": "Cancel the current signal",
    "Save": "Save",

    "Reset": "Reset",
    "ResetTooltip": "Reset all player statuses",

    "TickerIndex": "NOTICE / {n}",
    "PriorityIndex": "PRIORITY / {n}",
    "HandRaisedTag": "// HAND RAISED",

    "DirePerilTitle": "Dire Peril",
    "DirePerilTooltip": "Declare Dire Peril — death is on the table",
    "DirePerilTag": "// OPERATIONAL HAZARD //",
    "DirePerilTitleDire": "Dire",
    "DirePerilTitlePeril": "Peril",
    "DirePerilSubtitle": "// DEATH IS ON THE TABLE //",
    "DirePerilHazardActive": "// HAZARD ACTIVE",
    "DirePerilDismiss": "Dismiss Dire Peril",
    "DirePerilRunTop": "HAZARD CLASS [LETHAL] // PROTOCOL ENGAGED // ENCOUNTER [CRITICAL] // DEATH IS ON THE TABLE //",
    "DirePerilRunBottom": "T-0 // THREAT.LEVEL [MAX] // CASUALTY.RISK [CERTAIN] // COMMAND [ENGAGE] //",
    "DirePerilColumnLeft": "HAZARD / LETHAL / ENGAGED",
    "DirePerilColumnRight": "THREAT / RISK / ALERT",

    "Settings": {
      "DefaultCountdown": "Default Countdown Duration",
      "DefaultCountdownHint": "Default duration in seconds for the countdown timer (1-10 minutes)",
      "ResetOnSceneChange": "Reset on Scene Change",
      "ResetOnSceneChangeHint": "Automatically reset all player statuses when the scene changes",
      "ExemptUsers": "Exempt Users",
      "ExemptUsersLabel": "Configure Exempt Users",
      "ExemptUsersHint": "Select users who will not see the Stream Pacer UI (useful for streaming overlays or bots)",
      "HandRaiseAudioEnabled": "Hand Raise Audio Notification",
      "HandRaiseAudioEnabledHint": "Play a chime sound when a player raises their hand (GM only)",
      "HandRaiseAudioVolume": "Hand Raise Audio Volume",
      "HandRaiseAudioVolumeHint": "Volume level for the hand raise notification chime (0 = mute, 1 = full volume)"
    }
  }
}
```

- [ ] **Step 2: Manual validation**

1. Reload Foundry.
2. Ticker segments show `NOTICE / 01`, `NOTICE / 03`, `NOTICE / 02` correctly (not literal `{{n}}` placeholders).
3. Hand-raise bar shows `PRIORITY / 01` + `// HAND RAISED` trailing tag.
4. HUD section labels show `Operators`, `Command`, `Status`.
5. Dire Peril button tooltip: "Declare Dire Peril — death is on the table".
6. Running text in the full-screen animation uses the new English copy with bracketed emphasis words.
7. Indicator shows `// HAZARD ACTIVE` header + `Dire Peril` label.

- [ ] **Step 3: Commit**

```bash
git add languages/en.json
git commit -m "i18n: add all new keys for redesign + Dire Peril"
```

---

### Task 24: Bump version in `module.json`

**Files:**
- Modify: `module.json:5` — update version to `1.2.0`

- [ ] **Step 1: Update the version field**

In `module.json`, change:

```json
"version": "1.1.0",
```

to:

```json
"version": "1.2.0",
```

- [ ] **Step 2: Manual validation**

1. In Foundry, go to module settings. Confirm Stream Pacer shows version `1.2.0`.

- [ ] **Step 3: Commit**

```bash
git add module.json
git commit -m "chore: bump version to 1.2.0"
```

---

## Phase 11 — Final QA

### Task 25: End-to-end validation pass

**Files:** none (testing only)

- [ ] **Step 1: Prepare two sessions**

Open Foundry in two browser windows: one as GM, one as a player. Both join the same test world.

- [ ] **Step 2: Base HUD walkthrough (GM view)**

Confirm:
- HUD panel has clipped parallelogram corners, amber left stripe, grain, breathing shadow
- Header: grip handle + amber `01` index + `STREAM PACER` tracked title + `GM` chevron badge
- Operators section with label `01 OPERATORS`
- Command section with label `02 COMMAND` + 5 GM buttons (soft / countdown / floor / skull / reset)
- Cancel button appears only when a signal is active, making 6 buttons in that row
- Each button has clipped corners; hover lifts; active state glows in the button's semantic color
- Drag the panel by the grip — smooth drag, position persists across reload

- [ ] **Step 3: Base HUD walkthrough (player view)**

Confirm:
- Same panel look
- Operators section + Status section with 4 status buttons (hourglass / hand / brain / check-circle)
- Hand-Raised button shows blue pulsing glow + shimmer when active
- Status persists, syncs to GM, shown as chip in GM's Operators list

- [ ] **Step 4: Signals walkthrough**

- GM clicks Soft Signal: amber band appears between Operators and Command in HUD; ticker fades in amber with `NOTICE / 01` and scrolling "GM WOULD LIKE TO WRAP UP"
- GM clicks Countdown (2 min default): band turns red, timer in monospace; ticker re-tints red
- At 30s remaining: panel pulses warning orange; ticker follows
- At 10s remaining: panel pulses critical red; countdown digits flash
- Countdown auto-completes: panel + ticker clear
- GM clicks Floor Open: cyan band + cyan ticker

- [ ] **Step 5: Hand-raise walkthrough**

- Player clicks Hand Raised. On the player side, their button glows blue pulse + shimmer. Their chip in the HUD appears as a pulsing blue chip.
- On GM side, the hand-raise bar slides down from top with gradient + grain + shimmer + `PRIORITY / 01` chip + bouncing hand icon + glowing player name + `// HAND RAISED` tag.
- Player clicks Engaged: bar slides away on GM side.
- Hand-raise chime plays on GM side (audio unchanged).

- [ ] **Step 6: Dire Peril walkthrough**

- GM clicks the skull button. Full-screen animation plays once:
  1. Purple radial wash fades in
  2. Letters D I R E (pause) P E R I L flash center-stage in rapid sequence
  3. White+red impact flash
  4. `DIRE` slams from left, `PERIL` from right, thin red rule between, `// OPERATIONAL HAZARD //` tag above, `// DEATH IS ON THE TABLE //` typing subtitle below
  5. Horizontal running data lines top + bottom, vertical upright letter columns sides, diagonal slashes, side dot pairs, outline watermark PERIL behind
  6. Holds, fades to bottom-right indicator
- Indicator: skull in red-bordered clipped box + `// HAZARD ACTIVE` + `DIRE PERIL` + dismiss X (GM only)
- GM clicks dismiss. Indicator fades out. State clears. Skull button re-enables.
- GM re-declares peril. Player window plays the same animation; player sees the indicator **without** a dismiss button.
- Peril persists across scene change (not cleared by `resetOnSceneChange`).
- GM clicks Reset All — peril indicator clears alongside statuses.

- [ ] **Step 7: Late-join check**

- With peril active, have a third client join. Confirm the indicator appears at bottom-right on load — no full-screen replay.

- [ ] **Step 8: Exempt user check**

- Add the player user ID to exempt users via the settings menu.
- That client reloads: no HUD, no ticker, no hand-raise bar, no peril animation or indicator (per existing exempt logic).

- [ ] **Step 9: Reduced motion check**

- Enable `prefers-reduced-motion: reduce` in devtools rendering emulation.
- Trigger every signal in sequence. Confirm all animations (shimmer, pulse, scroll, bounce, letter flash) stop. Layouts still render; states still transition on click; no motion.

- [ ] **Step 10: Commit final polish or fixes (if any)**

If any issue surfaced during the walkthrough, fix it, validate again, and commit. If no issues, record a passing validation:

```bash
git commit --allow-empty -m "qa: end-to-end validation pass for UI redesign + Dire Peril"
```

---

## Self-Review

**Spec coverage:**

- §3.1 palette — covered in Task 1
- §3.2 typography — covered in Task 1 (font imports) + Tasks 2-10 (usage)
- §3.3 shape / §3.4 spacing — applied throughout Tasks 2–10
- §4.1 HUD Panel — Tasks 2–6
- §4.2 Bottom Ticker — Tasks 7–8
- §4.3 Hand-Raise Bar — Tasks 9–10
- §4.4 Dire Peril — Tasks 12–22
- §5 Animation Catalog — keyframes are defined per-surface in Tasks 2–10, 17–22
- §5.1 Reduced Motion — Task 11
- §6 Icon Mapping — Task 11 (plus usage in Tasks 3, 7, 8, 10, 15, 21)
- §7 Files Touched — all covered (new files in Tasks 16, 21; mods throughout)
- §8 Fallback & Compatibility — addressed by font `@import` (Task 1) + reduced-motion (Task 11); nothing else to do in code
- §9 Open Implementation Details — item 1 (width 300px) applied in Task 2, item 2 (signal band placement) preserved by keeping existing template order in Task 3, item 3 (grain vs scan-line) resolved in Task 1 + Task 2, item 4 (PRIORITY copy) applied in Task 10, item 5 (peril on exempt users) follows default exempt logic in Task 16 (no change to exempt logic needed), item 6 (5-button grid) Task 5 sets grid-template-columns to 5, item 7 (indicator z-index) Task 22 uses z-index: 100, item 8 (font loading) accepted via default fallback chain
- §10 Success Criteria — verified in Task 25 end-to-end walkthrough

**Placeholder scan:** no TBDs, TODOs, "implement later". Every step has concrete code or concrete verification. Types and method names consistent (`declareDirePeril`, `dismissDirePeril`, `receiveDirePerilDeclare`, `receiveDirePerilDismiss`, `onDirePeril`, `_notifyDirePeril`, `emitDirePerilDeclare`, `emitDirePerilDismiss` — consistent noun-verb ordering throughout).

**Type / name consistency:**
- `sp-*` CSS token prefix throughout (`--sp-ink-0`, `--sp-amber`, `--sp-peril`, etc.) — consistent
- CSS keyframes prefixed `sp-*` (`sp-panel-drift`, `sp-hand-pulse`, `sp-peril-letter`, etc.) — consistent
- Selectors `.peril-*` for stage internals, `.stream-pacer-peril-*` for top-level containers — consistent
- Template names `peril-stage.hbs`, `peril-indicator.hbs` — consistent
- Socket event names `direPerilDeclare`, `direPerilDismiss` — consistent

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-19-ui-redesign-implementation.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
