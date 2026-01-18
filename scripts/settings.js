export const MODULE_ID = 'stream-pacer';

export const PLAYER_STATUS = {
  ENGAGED: 'engaged',
  HAND_RAISED: 'hand_raised',
  NEED_TIME: 'need_time',
  READY: 'ready'
};

export const GM_SIGNAL = {
  NONE: 'none',
  SOFT: 'soft',
  COUNTDOWN: 'countdown',
  FLOOR_OPEN: 'floor_open'
};

export function registerSettings() {
  // Hidden state storage for persistence
  game.settings.register(MODULE_ID, 'pacerState', {
    name: 'Pacer State',
    scope: 'world',
    config: false,
    type: Object,
    default: {
      playerStates: {},
      gmSignal: GM_SIGNAL.NONE,
      countdownEnd: null
    }
  });

  // Default countdown duration (1-10 minutes)
  game.settings.register(MODULE_ID, 'defaultCountdown', {
    name: game.i18n.localize('STREAM_PACER.Settings.DefaultCountdown'),
    hint: game.i18n.localize('STREAM_PACER.Settings.DefaultCountdownHint'),
    scope: 'world',
    config: true,
    type: Number,
    default: 60,
    range: {
      min: 60,
      max: 600,
      step: 30
    }
  });

  // Auto-reset on scene change
  game.settings.register(MODULE_ID, 'resetOnSceneChange', {
    name: game.i18n.localize('STREAM_PACER.Settings.ResetOnSceneChange'),
    hint: game.i18n.localize('STREAM_PACER.Settings.ResetOnSceneChangeHint'),
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  // Exempt users (won't see the pacer UI - useful for streaming)
  game.settings.register(MODULE_ID, 'exemptUsers', {
    name: game.i18n.localize('STREAM_PACER.Settings.ExemptUsers'),
    hint: game.i18n.localize('STREAM_PACER.Settings.ExemptUsersHint'),
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });

  // Register menu for exempt users
  game.settings.registerMenu(MODULE_ID, 'exemptUsersMenu', {
    name: game.i18n.localize('STREAM_PACER.Settings.ExemptUsers'),
    label: game.i18n.localize('STREAM_PACER.Settings.ExemptUsersLabel'),
    hint: game.i18n.localize('STREAM_PACER.Settings.ExemptUsersHint'),
    icon: 'fas fa-users-slash',
    type: ExemptUsersConfig,
    restricted: true
  });

  // Client-side HUD position memory
  game.settings.register(MODULE_ID, 'hudPosition', {
    name: 'HUD Position',
    scope: 'client',
    config: false,
    type: Object,
    default: { top: 10 }
  });
}

// Configuration app for selecting exempt users
class ExemptUsersConfig extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'stream-pacer-exempt-users',
      title: game.i18n.localize('STREAM_PACER.Settings.ExemptUsers'),
      template: `modules/${MODULE_ID}/templates/exempt-users.hbs`,
      width: 400,
      height: 'auto'
    });
  }

  getData() {
    const exemptUsers = game.settings.get(MODULE_ID, 'exemptUsers');
    const users = game.users.map(u => ({
      id: u.id,
      name: u.name,
      isExempt: exemptUsers.includes(u.id)
    }));
    return { users };
  }

  async _updateObject(event, formData) {
    const exemptUsers = [];
    for (const [key, value] of Object.entries(formData)) {
      if (key.startsWith('user-') && value) {
        exemptUsers.push(key.replace('user-', ''));
      }
    }
    await game.settings.set(MODULE_ID, 'exemptUsers', exemptUsers);
  }
}
