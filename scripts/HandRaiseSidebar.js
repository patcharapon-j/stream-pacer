import { MODULE_ID, PLAYER_STATUS } from './settings.js';
import { PacerManager } from './PacerManager.js';

/**
 * HandRaiseBar - Horizontal scrolling ticker at the bottom for GM
 * Shows players who have raised their hands prominently
 * Positioned ABOVE the existing GM signal overlay bar
 * Auto-shows when hands are raised, auto-hides when none
 */
export class HandRaiseSidebar {
  constructor() {
    this._element = null;
    this._contentEl = null;
    this._unsubscribe = null;
    this._isVisible = false;
    this._currentPlayers = [];
  }

  /**
   * Initialize the bar (GM only)
   */
  initialize() {
    // Only for GM
    if (!game.user.isGM) return;

    this._createElement();

    // Subscribe to state updates
    this._unsubscribe = PacerManager.subscribe((state) => {
      this._update(state);
    });

    // Initial update
    this._update(PacerManager.getState());
  }

  /**
   * Create the bar DOM structure - horizontal ticker at bottom
   */
  _createElement() {
    this._element = document.createElement('div');
    this._element.id = 'stream-pacer-hand-bar';
    this._element.className = 'stream-pacer-hand-bar';

    // Content container for scrolling
    this._contentEl = document.createElement('div');
    this._contentEl.className = 'hand-bar-content';
    this._element.appendChild(this._contentEl);

    document.body.appendChild(this._element);
  }

  /**
   * Update bar based on current state
   */
  _update(state) {
    // Get players with raised hands
    const allPlayerStates = PacerManager.getAllPlayerStates();
    const handRaisedPlayers = Object.values(allPlayerStates)
      .filter(p => p.status === PLAYER_STATUS.HAND_RAISED);

    // Check if we need to update content
    const playerIds = handRaisedPlayers.map(p => p.userId).sort().join(',');
    const currentIds = this._currentPlayers.map(p => p.userId).sort().join(',');

    if (playerIds !== currentIds) {
      this._currentPlayers = handRaisedPlayers;
      this._rebuildContent();
    }

    // Show/hide based on count
    if (handRaisedPlayers.length > 0 && !this._isVisible) {
      this._show();
    } else if (handRaisedPlayers.length === 0 && this._isVisible) {
      this._hide();
    }
  }

  /**
   * Rebuild the content - static centered display
   */
  _rebuildContent() {
    if (!this._contentEl) return;

    if (this._currentPlayers.length === 0) {
      this._contentEl.innerHTML = '';
      return;
    }

    // Build simple centered content: hand icon + player names
    const playerNames = this._currentPlayers.map(p => p.name).join(', ');
    
    this._contentEl.innerHTML = `
      <span class="hand-icon"><i class="fas fa-hand-paper"></i></span>
      <span class="player-names">${playerNames}</span>
    `;
  }

  /**
   * Show the bar with animation
   */
  _show() {
    if (!this._element) return;
    this._isVisible = true;
    this._element.classList.add('active');
    
    // Notify the main overlay to adjust its position
    document.body.classList.add('hand-bar-visible');
  }

  /**
   * Hide the bar with animation
   */
  _hide() {
    if (!this._element) return;
    this._isVisible = false;
    this._element.classList.remove('active');
    
    // Notify the main overlay to reset its position
    document.body.classList.remove('hand-bar-visible');
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    if (this._element) {
      this._element.remove();
      this._element = null;
      this._contentEl = null;
    }
    this._currentPlayers = [];
    document.body.classList.remove('hand-bar-visible');
  }
}
