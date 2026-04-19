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
