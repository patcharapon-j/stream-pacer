import { MODULE_ID, PLAYER_STATUS, GM_SIGNAL } from './settings.js';
import { SocketHandler } from './socket-handler.js';

class PacerManagerClass {
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

  initialize() {
    // Load persisted state if GM
    if (game.user.isGM) {
      this.loadFromSettings();
    }
  }

  // --- Subscriber Pattern ---

  subscribe(callback) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }

  /**
   * Register a callback for hand-raise events
   * @param {Function} callback - Called with userId when a player raises their hand
   * @returns {Function} Unsubscribe function
   */
  onHandRaise(callback) {
    this._handRaiseCallbacks.add(callback);
    return () => this._handRaiseCallbacks.delete(callback);
  }

  /**
   * Notify all hand-raise callbacks
   * @param {string} userId - The user who raised their hand
   */
  _notifyHandRaise(userId) {
    for (const callback of this._handRaiseCallbacks) {
      try {
        callback(userId);
      } catch (e) {
        console.error(`${MODULE_ID} | Hand raise callback error:`, e);
      }
    }
  }

  /**
   * Register a callback for Dire Peril declare/dismiss events.
   * @param {Function} callback - Called with ({ active, animate }) on state change
   * @returns {Function} Unsubscribe function
   */
  onDirePeril(callback) {
    this._direPerilCallbacks.add(callback);
    return () => this._direPerilCallbacks.delete(callback);
  }

  _notifyDirePeril(active, { animate = true } = {}) {
    for (const callback of this._direPerilCallbacks) {
      try {
        callback({ active, animate });
      } catch (e) {
        console.error(`${MODULE_ID} | Dire Peril callback error:`, e);
      }
    }
  }

  _notifySubscribers() {
    // Use requestAnimationFrame to batch updates and prevent UI freezing
    if (this._notifyPending) return;
    this._notifyPending = true;

    requestAnimationFrame(() => {
      this._notifyPending = false;
      const state = this.getState();
      for (const callback of this._subscribers) {
        try {
          callback(state);
        } catch (e) {
          console.error(`${MODULE_ID} | Subscriber error:`, e);
        }
      }
    });
  }

  // --- State Getters ---

  getState() {
    // Count players with hands raised
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

  getPlayerStatus(userId) {
    return this._playerStates[userId] || PLAYER_STATUS.ENGAGED;
  }

  getAllPlayerStates() {
    const states = {};
    // Get all active players (non-GM)
    for (const user of game.users) {
      if (!user.isGM && user.active) {
        states[user.id] = {
          userId: user.id,
          name: user.name,
          status: this._playerStates[user.id] || PLAYER_STATUS.ENGAGED
        };
      }
    }
    return states;
  }

  getCountdownRemaining() {
    if (!this._countdownEnd) return null;
    const remaining = Math.max(0, Math.ceil((this._countdownEnd - Date.now()) / 1000));
    return remaining;
  }

  // --- Player Actions ---

  setPlayerStatus(userId, status, broadcast = true) {
    const previousStatus = this._playerStates[userId];
    this._playerStates[userId] = status;

    // Detect hand raise event (status changed TO hand_raised)
    if (status === PLAYER_STATUS.HAND_RAISED && previousStatus !== PLAYER_STATUS.HAND_RAISED) {
      this._notifyHandRaise(userId);
    }

    if (broadcast) {
      SocketHandler.emitPlayerStatusChange(userId, status);
    }

    this._notifySubscribers();
    this._saveToSettings();
  }

  // --- GM Actions ---

  activateSoftSignal(broadcast = true) {
    if (!game.user.isGM && broadcast) return;

    this._gmSignal = GM_SIGNAL.SOFT;
    this._countdownEnd = null;
    this._clearCountdownInterval();

    if (broadcast) {
      SocketHandler.emitGmSoftSignal();
    }

    this._notifySubscribers();
    this._saveToSettings();
  }

  startCountdown(duration = null, broadcast = true) {
    if (!game.user.isGM && broadcast) return;

    const countdownDuration = duration || game.settings.get(MODULE_ID, 'defaultCountdown');
    this._gmSignal = GM_SIGNAL.COUNTDOWN;
    this._countdownEnd = Date.now() + (countdownDuration * 1000);

    this._clearCountdownInterval();
    this._countdownInterval = setInterval(() => this._tickCountdown(), 1000);

    if (broadcast) {
      SocketHandler.emitGmHardCountdown(this._countdownEnd);
    }

    this._notifySubscribers();
    this._saveToSettings();
  }

  openFloor(broadcast = true) {
    if (!game.user.isGM && broadcast) return;

    this._gmSignal = GM_SIGNAL.FLOOR_OPEN;
    this._countdownEnd = null;
    this._clearCountdownInterval();

    if (broadcast) {
      SocketHandler.emitGmFloorOpen();
    }

    this._notifySubscribers();
    this._saveToSettings();
  }

  cancelSignal(broadcast = true) {
    if (!game.user.isGM && broadcast) return;

    this._gmSignal = GM_SIGNAL.NONE;
    this._countdownEnd = null;
    this._clearCountdownInterval();

    if (broadcast) {
      SocketHandler.emitGmCancelSignal();
    }

    this._notifySubscribers();
    this._saveToSettings();
  }

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

  // --- State Sync (for socket updates) ---

  receivePlayerStatusChange(userId, status) {
    const previousStatus = this._playerStates[userId];
    this._playerStates[userId] = status;

    // Detect hand raise event from remote player
    if (status === PLAYER_STATUS.HAND_RAISED && previousStatus !== PLAYER_STATUS.HAND_RAISED) {
      this._notifyHandRaise(userId);
    }

    this._notifySubscribers();
    if (game.user.isGM) {
      this._saveToSettings();
    }
  }

  receiveGmSoftSignal() {
    this._gmSignal = GM_SIGNAL.SOFT;
    this._countdownEnd = null;
    this._clearCountdownInterval();
    this._notifySubscribers();
  }

  receiveGmHardCountdown(countdownEnd) {
    this._gmSignal = GM_SIGNAL.COUNTDOWN;
    this._countdownEnd = countdownEnd;

    this._clearCountdownInterval();
    this._countdownInterval = setInterval(() => this._tickCountdown(), 1000);
    this._notifySubscribers();
  }

  receiveGmCancelSignal() {
    this._gmSignal = GM_SIGNAL.NONE;
    this._countdownEnd = null;
    this._clearCountdownInterval();
    this._notifySubscribers();
  }

  receiveGmFloorOpen() {
    this._gmSignal = GM_SIGNAL.FLOOR_OPEN;
    this._countdownEnd = null;
    this._clearCountdownInterval();
    this._notifySubscribers();
  }

  receiveResetAll() {
    this._playerStates = {};
    this._gmSignal = GM_SIGNAL.NONE;
    this._countdownEnd = null;
    this._direPerilActive = false;
    this._clearCountdownInterval();
    this._notifyDirePeril(false);
    this._notifySubscribers();
  }

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

  receiveSyncState(state) {
    this._playerStates = state.playerStates || {};
    this._gmSignal = state.gmSignal || GM_SIGNAL.NONE;
    this._countdownEnd = state.countdownEnd || null;
    this._direPerilActive = state.direPerilActive === true;

    this._clearCountdownInterval();
    if (this._gmSignal === GM_SIGNAL.COUNTDOWN && this._countdownEnd) {
      this._countdownInterval = setInterval(() => this._tickCountdown(), 1000);
    }

    // Late-join: surface peril state to the overlay without replaying the animation.
    this._notifyDirePeril(this._direPerilActive, { animate: false });
    this._notifySubscribers();
  }

  // --- Internal Helpers ---

  _tickCountdown() {
    const remaining = this.getCountdownRemaining();
    if (remaining <= 0) {
      // Always clear our own interval. Only the GM broadcasts the cancel;
      // non-GM clients wait for the GM's socket event to arrive.
      this._clearCountdownInterval();
      if (game.user.isGM) {
        this.cancelSignal();
        return;
      }
    }
    this._notifySubscribers();
  }

  _clearCountdownInterval() {
    if (this._countdownInterval) {
      clearInterval(this._countdownInterval);
      this._countdownInterval = null;
    }
  }

  loadFromSettings() {
    try {
      const saved = game.settings.get(MODULE_ID, 'pacerState');
      if (saved) {
        this._playerStates = saved.playerStates || {};
        this._gmSignal = saved.gmSignal || GM_SIGNAL.NONE;
        this._countdownEnd = saved.countdownEnd || null;
        this._direPerilActive = saved.direPerilActive === true;

        // Restart countdown interval if needed
        if (this._gmSignal === GM_SIGNAL.COUNTDOWN && this._countdownEnd) {
          if (this._countdownEnd > Date.now()) {
            this._countdownInterval = setInterval(() => this._tickCountdown(), 1000);
          } else {
            // Countdown expired while offline
            this._gmSignal = GM_SIGNAL.NONE;
            this._countdownEnd = null;
          }
        }
      }
    } catch (e) {
      console.warn(`${MODULE_ID} | Failed to load settings:`, e);
    }
  }

  _saveToSettings() {
    if (!game.user.isGM) return;

    // Debounce rapid bursts (e.g. players toggling status during a countdown)
    // into a single DB write, while still flushing on a fresh state.
    clearTimeout(this._saveTimeout);
    this._saveTimeout = setTimeout(() => {
      this._saveTimeout = null;
      game.settings.set(MODULE_ID, 'pacerState', {
        playerStates: this._playerStates,
        gmSignal: this._gmSignal,
        countdownEnd: this._countdownEnd,
        direPerilActive: this._direPerilActive
      });
    }, 300);
  }
}

export const PacerManager = new PacerManagerClass();
