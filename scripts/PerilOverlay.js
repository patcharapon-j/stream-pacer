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
    this._stageEl = null;
    this._indicatorEl = null;
    this._stageTimer = null;
    this._indicatorTimer = null;
    this._unsubscribe = null;
    // Incremented whenever peril becomes inactive; in-flight async renders
    // check this token before writing DOM so a dismiss can cancel them.
    this._activationToken = 0;
  }

  initialize() {
    this._createStageContainer();
    this._createIndicatorContainer();

    this._unsubscribe = PacerManager.onDirePeril(({ active, animate }) => {
      if (active) {
        if (animate) {
          this._playStageAndShowIndicator();
        } else {
          this._renderIndicator();
        }
      } else {
        this._hideIndicator();
      }
    });
  }

  /**
   * Late-join helper — render just the indicator with no animation.
   * Safe to call multiple times; no-ops if already rendered.
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
    const token = ++this._activationToken;
    await this._renderStage(token);
    if (token !== this._activationToken) return;
    this._scheduleHandoff(token);
  }

  async _renderStage(token) {
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
    if (token !== this._activationToken) return;
    this._stageEl.innerHTML = html;
    void this._stageEl.offsetWidth;
    this._stageEl.classList.add('playing');
  }

  _scheduleHandoff(token) {
    clearTimeout(this._indicatorTimer);
    clearTimeout(this._stageTimer);

    this._indicatorTimer = setTimeout(() => {
      if (token !== this._activationToken) return;
      this._renderIndicator();
    }, STAGE_DURATION_MS - INDICATOR_LEAD_MS);

    this._stageTimer = setTimeout(() => {
      if (token !== this._activationToken) return;
      this._unmountStage();
    }, STAGE_DURATION_MS);
  }

  _unmountStage() {
    if (!this._stageEl) return;
    this._stageEl.classList.remove('playing');
    setTimeout(() => {
      if (this._stageEl) this._stageEl.innerHTML = '';
    }, 300);
  }

  async _renderIndicator() {
    if (!this._indicatorEl) this._createIndicatorContainer();
    const token = this._activationToken || 1;
    if (!this._activationToken) this._activationToken = token;

    const context = {
      isGM: game.user.isGM,
      label: game.i18n.localize('STREAM_PACER.DirePerilTitle'),
      header: game.i18n.localize('STREAM_PACER.DirePerilHazardActive'),
      dismissTooltip: game.i18n.localize('STREAM_PACER.DirePerilDismiss')
    };

    const html = await renderTemplate(INDICATOR_TEMPLATE, context);
    if (token !== this._activationToken) return;
    this._indicatorEl.innerHTML = html;

    const dismissBtn = this._indicatorEl.querySelector('[data-action="dismiss-peril"]');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        PacerManager.dismissDirePeril();
      });
    }

    void this._indicatorEl.offsetWidth;
    this._indicatorEl.classList.add('visible');
  }

  _hideIndicator() {
    this._activationToken++;
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
