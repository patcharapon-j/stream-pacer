import { MODULE_ID, PLAYER_STATUS, GM_SIGNAL } from './settings.js';
import { PacerManager } from './PacerManager.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class PacerHUD extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this._unsubscribe = null;
  }

  static DEFAULT_OPTIONS = {
    id: 'stream-pacer-hud',
    classes: ['stream-pacer'],
    position: {
      width: 'auto',
      height: 'auto'
    },
    window: {
      frame: false,
      positioned: true
    }
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/pacer-hud.hbs`
    }
  };

  async _prepareContext(options) {
    const state = PacerManager.getState();
    const playerStates = PacerManager.getAllPlayerStates();

    // Format player states for template
    const players = Object.values(playerStates).map(p => ({
      ...p,
      isEngaged: p.status === PLAYER_STATUS.ENGAGED,
      isHandRaised: p.status === PLAYER_STATUS.HAND_RAISED,
      isNeedTime: p.status === PLAYER_STATUS.NEED_TIME,
      isReady: p.status === PLAYER_STATUS.READY,
      statusIcon: this._getStatusIcon(p.status),
      statusClass: this._getStatusClass(p.status),
      statusTitle: game.i18n.localize(`STREAM_PACER.Status.${p.status}`)
    }));

    // Current user's status
    const myStatus = PacerManager.getPlayerStatus(game.user.id);

    // Countdown formatting
    const countdownRemaining = state.countdownRemaining;
    let formattedCountdown = null;
    let countdownUrgency = 'normal';

    if (countdownRemaining !== null) {
      const minutes = Math.floor(countdownRemaining / 60);
      const seconds = countdownRemaining % 60;
      formattedCountdown = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      if (countdownRemaining <= 10) {
        countdownUrgency = 'critical';
      } else if (countdownRemaining <= 30) {
        countdownUrgency = 'warning';
      }
    }

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
      PLAYER_STATUS,
      GM_SIGNAL
    };
  }

  _getStatusIcon(status) {
    switch (status) {
      case PLAYER_STATUS.HAND_RAISED:
        return 'fa-hand-paper';
      case PLAYER_STATUS.NEED_TIME:
        return 'fa-brain';
      case PLAYER_STATUS.READY:
        return 'fa-check-circle';
      case PLAYER_STATUS.ENGAGED:
      default:
        return 'fa-hourglass';
    }
  }

  _getStatusClass(status) {
    switch (status) {
      case PLAYER_STATUS.HAND_RAISED:
        return 'status-hand-raised';
      case PLAYER_STATUS.NEED_TIME:
        return 'status-need-time';
      case PLAYER_STATUS.READY:
        return 'status-ready';
      case PLAYER_STATUS.ENGAGED:
      default:
        return 'status-engaged';
    }
  }

  _onFirstRender(context, options) {
    super._onFirstRender(context, options);

    // Subscribe to manager updates
    this._unsubscribe = PacerManager.subscribe(() => {
      // Only re-render if we're still open
      if (this.rendered) {
        this.render(false);
      }
    });
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this._setupListeners();
  }

  _setupListeners() {
    const html = this.element;
    if (!html) return;

    // Remove old click handler if exists
    if (html._pacerClickHandler) {
      html.removeEventListener('click', html._pacerClickHandler);
    }

    // Add new click handler
    html._pacerClickHandler = (event) => {
      const target = event.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;

      switch (action) {
        case 'set-status':
          const status = target.dataset.status;
          PacerManager.setPlayerStatus(game.user.id, status);
          break;
        case 'soft-signal':
          if (game.user.isGM) PacerManager.activateSoftSignal();
          break;
        case 'start-countdown':
          if (game.user.isGM) this._showCountdownDialog();
          break;
        case 'open-floor':
          if (game.user.isGM) PacerManager.openFloor();
          break;
        case 'cancel-signal':
          if (game.user.isGM) PacerManager.cancelSignal();
          break;
        case 'reset-all':
          if (game.user.isGM) PacerManager.resetAll();
          break;
      }
    };
    html.addEventListener('click', html._pacerClickHandler);
  }

  async _showCountdownDialog() {
    const defaultDuration = game.settings.get(MODULE_ID, 'defaultCountdown');

    const content = `
      <form>
        <div class="form-group">
          <label>${game.i18n.localize('STREAM_PACER.CountdownDuration')}</label>
          <div class="form-fields">
            <input type="number" name="minutes" value="${Math.floor(defaultDuration / 60)}" min="1" max="10" style="width: 60px">
            <span>${game.i18n.localize('STREAM_PACER.Minutes')}</span>
          </div>
        </div>
      </form>
    `;

    new Dialog({
      title: game.i18n.localize('STREAM_PACER.StartCountdown'),
      content,
      buttons: {
        start: {
          icon: '<i class="fas fa-play"></i>',
          label: game.i18n.localize('STREAM_PACER.Start'),
          callback: (html) => {
            const minutes = parseInt(html.find('[name="minutes"]').val()) || 1;
            const seconds = Math.min(Math.max(minutes, 1), 10) * 60;
            PacerManager.startCountdown(seconds);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize('Cancel')
        }
      },
      default: 'start'
    }).render(true);
  }

  _onClose(options) {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    super._onClose(options);
  }
}
