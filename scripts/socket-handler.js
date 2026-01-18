import { MODULE_ID } from './settings.js';
import { PacerManager } from './PacerManager.js';

const SOCKET_NAME = `module.${MODULE_ID}`;

const EVENTS = {
  PLAYER_STATUS_CHANGE: 'playerStatusChange',
  GM_SOFT_SIGNAL: 'gmSoftSignal',
  GM_HARD_COUNTDOWN: 'gmHardCountdown',
  GM_FLOOR_OPEN: 'gmFloorOpen',
  GM_CANCEL_SIGNAL: 'gmCancelSignal',
  REQUEST_STATE: 'requestState',
  SYNC_STATE: 'syncState',
  RESET_ALL: 'resetAll'
};

class SocketHandlerClass {
  initialize() {
    game.socket.on(SOCKET_NAME, (data) => this._handleMessage(data));

    // Request current state from GM when joining
    if (!game.user.isGM) {
      setTimeout(() => {
        this.requestState();
      }, 500);
    }
  }

  _handleMessage(data) {
    const { event, payload, senderId } = data;

    switch (event) {
      case EVENTS.PLAYER_STATUS_CHANGE:
        PacerManager.receivePlayerStatusChange(payload.userId, payload.status);
        break;

      case EVENTS.GM_SOFT_SIGNAL:
        PacerManager.receiveGmSoftSignal();
        break;

      case EVENTS.GM_HARD_COUNTDOWN:
        PacerManager.receiveGmHardCountdown(payload.countdownEnd);
        break;

      case EVENTS.GM_FLOOR_OPEN:
        PacerManager.receiveGmFloorOpen();
        break;

      case EVENTS.GM_CANCEL_SIGNAL:
        PacerManager.receiveGmCancelSignal();
        break;

      case EVENTS.REQUEST_STATE:
        // Only GM responds to state requests
        if (game.user.isGM) {
          this._sendSyncState(senderId);
        }
        break;

      case EVENTS.SYNC_STATE:
        // Only process if this message is for us
        if (payload.targetUserId === game.user.id) {
          PacerManager.receiveSyncState(payload.state);
        }
        break;

      case EVENTS.RESET_ALL:
        PacerManager.receiveResetAll();
        break;
    }
  }

  _emit(event, payload = {}) {
    game.socket.emit(SOCKET_NAME, {
      event,
      payload,
      senderId: game.user.id
    });
  }

  // --- Emit Methods ---

  emitPlayerStatusChange(userId, status) {
    this._emit(EVENTS.PLAYER_STATUS_CHANGE, { userId, status });
  }

  emitGmSoftSignal() {
    this._emit(EVENTS.GM_SOFT_SIGNAL);
  }

  emitGmHardCountdown(countdownEnd) {
    this._emit(EVENTS.GM_HARD_COUNTDOWN, { countdownEnd });
  }

  emitGmFloorOpen() {
    this._emit(EVENTS.GM_FLOOR_OPEN);
  }

  emitGmCancelSignal() {
    this._emit(EVENTS.GM_CANCEL_SIGNAL);
  }

  requestState() {
    this._emit(EVENTS.REQUEST_STATE);
  }

  _sendSyncState(targetUserId) {
    const state = PacerManager.getState();
    this._emit(EVENTS.SYNC_STATE, {
      targetUserId,
      state: {
        playerStates: state.playerStates,
        gmSignal: state.gmSignal,
        countdownEnd: state.countdownEnd
      }
    });
  }

  emitResetAll() {
    this._emit(EVENTS.RESET_ALL);
  }
}

export const SocketHandler = new SocketHandlerClass();
