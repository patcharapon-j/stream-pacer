import { MODULE_ID } from './settings.js';

/**
 * Central appearance controller.
 *
 * Resolves two layered choices into a single applied theme:
 *   - Theme family (sci-fi | core | fantasy) selects the visual language:
 *     fonts, shapes, decorations. Exposed to CSS via a [data-sp-family]
 *     attribute on <html> and <body>.
 *   - Color preset (or custom pair) sets the accent + peril hues. Resolved
 *     into a flat map of CSS custom properties on :root so the whole UI
 *     re-themes live.
 *
 * Also exposes the derived Dire Peril color bed for the WebGL renderer.
 */

/** Built-in color presets. Names are family-neutral; each resolves to a base pair. */
export const THEME_PRESETS = {
  'arknights-amber': { accent: '#e4b055', peril: '#d6184a' },
  'endfield-blue':   { accent: '#5ad1ff', peril: '#2f7bff' },
  'crimson-protocol':{ accent: '#ff6a4d', peril: '#ff1030' },
  'void-violet':     { accent: '#a684ff', peril: '#c026d3' },
  'verdant-ops':     { accent: '#4fd18b', peril: '#19b36b' }
};

export const DEFAULT_PRESET = 'arknights-amber';

export const THEME_FAMILIES = ['sci-fi', 'core', 'fantasy'];
export const DEFAULT_FAMILY = 'core';

function clamp8(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || '').trim());
  if (!m) return { r: 228, g: 176, b: 85 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToHex({ r, g, b }) {
  const h = (v) => clamp8(v).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Mix two rgb objects; t=0 → a, t=1 → b. */
function mix(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  };
}

function lighten(rgb, t) {
  return mix(rgb, { r: 255, g: 255, b: 255 }, t);
}

function darken(rgb, t) {
  return mix(rgb, { r: 0, g: 0, b: 0 }, t);
}

function rgba(rgb, a) {
  return `rgba(${clamp8(rgb.r)}, ${clamp8(rgb.g)}, ${clamp8(rgb.b)}, ${a})`;
}

class ThemeManagerClass {
  constructor() {
    this._styleEl = null;
    this._peril = null; // cached { deep, mid, hot } as 0..1 rgb arrays
  }

  /** Resolve the configured base colors, falling back gracefully. */
  _resolveBase() {
    let family = DEFAULT_FAMILY;
    let preset = DEFAULT_PRESET;
    let accent = THEME_PRESETS[DEFAULT_PRESET].accent;
    let peril = THEME_PRESETS[DEFAULT_PRESET].peril;
    try {
      const f = game.settings.get(MODULE_ID, 'themeFamily');
      if (THEME_FAMILIES.includes(f)) family = f;
      preset = game.settings.get(MODULE_ID, 'themePreset') || DEFAULT_PRESET;
      if (preset === 'custom') {
        accent = game.settings.get(MODULE_ID, 'accentColor') || accent;
        peril = game.settings.get(MODULE_ID, 'perilColor') || peril;
      } else if (THEME_PRESETS[preset]) {
        accent = THEME_PRESETS[preset].accent;
        peril = THEME_PRESETS[preset].peril;
      }
    } catch (e) {
      /* settings not ready — use defaults */
    }
    return { family, preset, accent, peril };
  }

  /** Build the full CSS custom-property map from the two base colors. */
  _buildPalette(base) {
    const a = hexToRgb(base.accent);
    const p = hexToRgb(base.peril);

    // Derived accent tones — softer dim, brighter glow.
    const accentSoft = lighten(a, 0.18);

    // Derived peril tones — a deep near-black bed, a bright highlight, and a
    // hot "alert red" pushed toward saturated red-orange for the danger read.
    const perilDeep = darken(p, 0.82);
    const perilBright = lighten(p, 0.62);
    const perilHot = mix(p, { r: 255, g: 30, b: 48 }, 0.5);
    const perilGhost = lighten(mix(p, { r: 120, g: 220, b: 255 }, 0.6), 0.1);

    const vars = {
      '--sp-amber': rgbToHex(a),
      '--sp-amber-soft': rgbToHex(accentSoft),
      '--sp-amber-dim': rgba(a, 0.22),
      '--sp-amber-glow': rgba(a, 0.4),

      '--sp-peril': rgbToHex(p),
      '--sp-peril-deep': rgbToHex(perilDeep),
      '--sp-peril-bright': rgbToHex(perilBright),
      '--sp-peril-glow': rgba(lighten(p, 0.15), 0.6),
      '--sp-peril-red': rgbToHex(perilHot),
      '--sp-peril-red-glow': rgba(perilHot, 0.6),
      '--sp-peril-ghost': rgba(perilGhost, 0.35)
    };

    // WebGL color bed: 0..1 normalized rgb arrays.
    const norm = ({ r, g, b }) => [r / 255, g / 255, b / 255];
    this._peril = {
      deep: norm(darken(p, 0.6)),
      mid: norm(p),
      hot: norm(lighten(perilHot, 0.25))
    };

    return vars;
  }

  /** Write the resolved palette onto :root via a managed <style> element. */
  apply() {
    const base = this._resolveBase();
    const vars = this._buildPalette(base);
    const body = Object.entries(vars)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n');
    const css = `:root {\n${body}\n}`;

    if (!this._styleEl) {
      this._styleEl = document.createElement('style');
      this._styleEl.id = 'stream-pacer-theme-vars';
      document.head.appendChild(this._styleEl);
    }
    this._styleEl.textContent = css;

    // Stamp the family on root + body so CSS can branch off it.
    const family = base.family;
    document.documentElement.setAttribute('data-sp-family', family);
    if (document.body) document.body.setAttribute('data-sp-family', family);
  }

  /** Normalized peril colors for the WebGL shader. */
  getPerilWebGLColors() {
    if (!this._peril) this._buildPalette(this._resolveBase());
    return this._peril;
  }

  /** Currently active family — convenience for any caller that needs it. */
  getFamily() {
    return this._resolveBase().family;
  }

  initialize() {
    this.apply();
  }
}

export const ThemeManager = new ThemeManagerClass();
