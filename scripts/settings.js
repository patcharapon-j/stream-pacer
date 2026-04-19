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

// Configuration app for selecting exempt users.
// Defined before registerSettings() so registerMenu can reference it without
// hitting the class-declaration temporal dead zone.
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

async function saveExemptUsers(_event, _form, formData) {
  const data = formData?.object ?? {};
  const exemptUsers = [];
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('user-') && value) {
      exemptUsers.push(key.replace('user-', ''));
    }
  }
  await game.settings.set(MODULE_ID, 'exemptUsers', exemptUsers);
}

class ExemptUsersConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'stream-pacer-exempt-users',
    classes: ['stream-pacer-exempt-users'],
    tag: 'form',
    window: {
      title: 'STREAM_PACER.Settings.ExemptUsers',
      icon: 'fas fa-users-slash'
    },
    position: {
      width: 400,
      height: 'auto'
    },
    form: {
      handler: saveExemptUsers,
      closeOnSubmit: true
    }
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/exempt-users.hbs`
    }
  };

  async _prepareContext() {
    const exemptUsers = game.settings.get(MODULE_ID, 'exemptUsers');
    const users = game.users.map(u => ({
      id: u.id,
      name: u.name,
      isExempt: exemptUsers.includes(u.id)
    }));
    return { users };
  }
}

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
  // Pass raw i18n keys — Foundry localizes them lazily when the settings
  // sheet is rendered. Calling game.i18n.localize() here (during 'init')
  // runs before language files are fully loaded and returns the raw key.
  game.settings.register(MODULE_ID, 'defaultCountdown', {
    name: 'STREAM_PACER.Settings.DefaultCountdown',
    hint: 'STREAM_PACER.Settings.DefaultCountdownHint',
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
    name: 'STREAM_PACER.Settings.ResetOnSceneChange',
    hint: 'STREAM_PACER.Settings.ResetOnSceneChangeHint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  // Exempt users (won't see the pacer UI - useful for streaming)
  game.settings.register(MODULE_ID, 'exemptUsers', {
    name: 'STREAM_PACER.Settings.ExemptUsers',
    hint: 'STREAM_PACER.Settings.ExemptUsersHint',
    scope: 'world',
    config: false,
    type: Array,
    default: []
  });

  // Register menu for exempt users
  game.settings.registerMenu(MODULE_ID, 'exemptUsersMenu', {
    name: 'STREAM_PACER.Settings.ExemptUsers',
    label: 'STREAM_PACER.Settings.ExemptUsersLabel',
    hint: 'STREAM_PACER.Settings.ExemptUsersHint',
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
    default: { left: null, top: null }
  });

  // Hand raise audio notification enabled (GM only setting)
  game.settings.register(MODULE_ID, 'handRaiseAudioEnabled', {
    name: 'STREAM_PACER.Settings.HandRaiseAudioEnabled',
    hint: 'STREAM_PACER.Settings.HandRaiseAudioEnabledHint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true
  });

  // Hand raise audio volume (0-1)
  game.settings.register(MODULE_ID, 'handRaiseAudioVolume', {
    name: 'STREAM_PACER.Settings.HandRaiseAudioVolume',
    hint: 'STREAM_PACER.Settings.HandRaiseAudioVolumeHint',
    scope: 'client',
    config: true,
    type: Number,
    default: 0.5,
    range: {
      min: 0,
      max: 1,
      step: 0.1
    }
  });
}
