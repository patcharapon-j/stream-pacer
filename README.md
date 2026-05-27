# Stream Pacer

A communication tool for GMs and players to signal scene readiness and pacing during gameplay in Foundry VTT v13–v14, optimized for streaming.

## Features

- **Player Status Indicators** - Players can signal their current state:
  - **Engaged** - Actively participating in the scene
  - **Hand Raised** - Want to do or say something
  - **Need Time** - Still thinking/processing
  - **Ready** - Done with the current scene

- **GM Signals** - GMs can send scene pacing signals:
  - **Soft Signal** - Gentle nudge that you'd like to wrap up
  - **Countdown** - Visual countdown timer for scene ending
  - **Floor Open** - Signal for players to raise their hands for actions

- **Real-Time Synchronization** - All players see status changes instantly via sockets

- **Streaming Optimized** - Exempt specific users (like streaming overlay accounts) from seeing the UI

- **Scene Change Reset** - Optionally reset all statuses when changing scenes

## Installation

### Manifest URL
```
https://github.com/patcharapon-j/stream-pacer/releases/latest/download/module.json
```

### Manual Installation
1. Download the latest release from the [Releases](https://github.com/patcharapon-j/stream-pacer/releases) page
2. Extract the `module.zip` to your `Data/modules/` folder
3. Enable the module in your Foundry VTT world

## Usage

### For Players
The Stream Pacer HUD appears on screen, allowing you to:
- Click status buttons to signal your current state
- See the GM's signals and countdowns
- Coordinate scene pacing with the group

### For GMs
- View all player statuses at a glance
- Send soft signals to nudge players toward wrapping up
- Start countdown timers for scene transitions
- Open the floor for player actions
- Reset all player statuses

## Settings

| Setting | Description |
|---------|-------------|
| Default Countdown Duration | Duration for countdown timer (1-10 minutes) |
| Reset on Scene Change | Automatically reset statuses when scene changes |
| Exempt Users | Users who won't see the Stream Pacer UI |
| Appearance / Tech Display | Pick a color preset (Arknights Amber, Endfield Blue, Crimson Protocol, Void Violet, Verdant Ops) or set custom accent/peril colors. Re-themes the whole HUD and the Dire Peril screen. |
| Dire Peril Text (GM) | Customize the reveal wording — title line 1, title line 2, hazard tag, and subtitle. Shared with all players; blank fields fall back to defaults. |
| Dire Peril WebGL Effect | Toggle the cinematic WebGL danger field on the Dire Peril reveal (disable on low-end machines). |

## API

Access the module API via `game.streamPacer`:

```javascript
// Access the pacer manager
game.streamPacer.manager

// Access the socket handler
game.streamPacer.socket

// Access the HUD
game.streamPacer.hud

// Access the overlay
game.streamPacer.overlay
```

## Compatibility

- **Foundry VTT**: v13–v14 (verified on v14)
- **System**: System agnostic (works with any game system)

## License

MIT License - See [LICENSE](LICENSE) for details.

## Credits

Created by Patcharapon Joksamut
