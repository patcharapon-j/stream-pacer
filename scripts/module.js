import { MODULE_ID, registerSettings } from './settings.js';
import { PacerManager } from './PacerManager.js';
import { SocketHandler } from './socket-handler.js';
import { PacerHUD } from './PacerHUD.js';
import { PacerOverlay } from './PacerOverlay.js';

let pacerHUD = null;
let pacerOverlay = null;
let isReady = false;
let isFirstCanvas = true;

Hooks.once('init', () => {
  console.log(`${MODULE_ID} | Initializing Stream Pacer`);
  registerSettings();
});

Hooks.once('ready', () => {
  console.log(`${MODULE_ID} | Stream Pacer Ready`);
  isReady = true;

  // Check if current user is exempt
  const exemptUsers = game.settings.get(MODULE_ID, 'exemptUsers');
  const isExempt = exemptUsers.includes(game.user.id);

  // Initialize the socket handler (always needed for state sync)
  SocketHandler.initialize();

  // Initialize the pacer manager
  PacerManager.initialize();

  // Only initialize UI components if not exempt
  if (!isExempt) {
    // Create and render the HUD
    pacerHUD = new PacerHUD();
    pacerHUD.render(true);

    // Initialize overlay for signals
    pacerOverlay = new PacerOverlay();
    pacerOverlay.initialize();
  }

  // Expose global API
  game.streamPacer = {
    manager: PacerManager,
    socket: SocketHandler,
    hud: pacerHUD,
    overlay: pacerOverlay
  };
});

// Handle scene changes - reset states if setting enabled
Hooks.on('canvasReady', () => {
  // Skip if game not ready yet or if this is the first canvas load
  if (!isReady) return;
  if (isFirstCanvas) {
    isFirstCanvas = false;
    return;
  }

  if (game.settings.get(MODULE_ID, 'resetOnSceneChange')) {
    if (game.user.isGM) {
      PacerManager.resetAll();
    }
  }
});
