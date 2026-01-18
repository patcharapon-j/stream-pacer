import { MODULE_ID, GM_SIGNAL } from './settings.js';
import { PacerManager } from './PacerManager.js';

export class PacerOverlay {
  constructor() {
    this._element = null;
    this._contentEl = null;
    this._unsubscribe = null;
    this._resizeObserver = null;
    this._segmentCount = 8;
  }

  initialize() {
    this._createElement();

    this._unsubscribe = PacerManager.subscribe((state) => {
      this._update(state);
    });

    // Watch for resize to adjust segment count
    this._resizeObserver = new ResizeObserver(() => {
      this._adjustSegments();
    });
    this._resizeObserver.observe(document.body);

    this._update(PacerManager.getState());
  }

  _createElement() {
    this._element = document.createElement('div');
    this._element.id = 'stream-pacer-overlay';
    this._element.className = 'stream-pacer-overlay';

    this._contentEl = document.createElement('div');
    this._contentEl.className = 'overlay-content';
    this._element.appendChild(this._contentEl);

    document.body.appendChild(this._element);

    // Initial segment creation
    this._adjustSegments();
  }

  _adjustSegments() {
    if (!this._contentEl) return;

    // Calculate how many segments needed to fill 2x viewport width (for seamless loop)
    const viewportWidth = window.innerWidth;
    const segmentWidth = 350; // Approximate width of one segment
    const neededSegments = Math.ceil((viewportWidth * 2.5) / segmentWidth);

    // Only rebuild if count changed significantly
    if (Math.abs(neededSegments - this._segmentCount) > 2) {
      this._segmentCount = Math.max(6, neededSegments);
      this._rebuildSegments();
    }
  }

  _rebuildSegments() {
    if (!this._contentEl) return;

    let html = '';
    for (let i = 0; i < this._segmentCount; i++) {
      html += this._createTickerSegment();
    }
    this._contentEl.innerHTML = html;

    // Re-apply current state
    this._update(PacerManager.getState());
  }

  _createTickerSegment() {
    return `
      <span class="ticker-segment">
        <span class="overlay-icon"><i class="fas fa-exclamation-triangle"></i></span>
        <span class="overlay-message"></span>
        <span class="overlay-countdown"></span>
      </span>
      <span class="ticker-separator"></span>
    `;
  }

  _update(state) {
    if (!this._element) return;

    const messageEls = this._element.querySelectorAll('.overlay-message');
    const countdownEls = this._element.querySelectorAll('.overlay-countdown');
    const iconEls = this._element.querySelectorAll('.overlay-icon i');

    if (state.gmSignal === GM_SIGNAL.SOFT) {
      this._element.classList.add('active', 'soft-signal');
      this._element.classList.remove('countdown-signal', 'floor-open-signal', 'urgency-warning', 'urgency-critical');

      const message = game.i18n.localize('STREAM_PACER.SoftSignalMessage');
      iconEls.forEach(el => el.className = 'fas fa-exclamation-triangle');
      messageEls.forEach(el => el.textContent = message);
      countdownEls.forEach(el => el.textContent = '');
    } else if (state.gmSignal === GM_SIGNAL.FLOOR_OPEN) {
      this._element.classList.add('active', 'floor-open-signal');
      this._element.classList.remove('soft-signal', 'countdown-signal', 'urgency-warning', 'urgency-critical');

      const message = game.i18n.localize('STREAM_PACER.FloorOpenMessage');
      iconEls.forEach(el => el.className = 'fas fa-microphone');
      messageEls.forEach(el => el.textContent = message);
      countdownEls.forEach(el => el.textContent = '');
    } else if (state.gmSignal === GM_SIGNAL.COUNTDOWN) {
      this._element.classList.add('active', 'countdown-signal');
      this._element.classList.remove('soft-signal', 'floor-open-signal');

      const message = game.i18n.localize('STREAM_PACER.CountdownMessage');
      iconEls.forEach(el => el.className = 'fas fa-clock');
      messageEls.forEach(el => el.textContent = message);

      const remaining = state.countdownRemaining;
      if (remaining !== null) {
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        countdownEls.forEach(el => el.textContent = timeStr);

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

  destroy() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    if (this._element) {
      this._element.remove();
      this._element = null;
      this._contentEl = null;
    }
  }
}
