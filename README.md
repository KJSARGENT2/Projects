# Projects

## Fenrir Arcade

Open `index.html` (serve the folder over http, e.g. `python3 -m http.server`, so the games can load inside it) for the Fenrir Arcade hub: levels, coins and gems, daily spin, missions, streaks, trophies and a Game of the Week. Rewards are virtual only and saved in the browser. Each game reports round results to the hub.

## Fenrir LIVE games

Single-file browser games built for streaming with the [Fenrir](https://fenrirapp.com) app, styled in Fenrir's black and neon blue. Open any `index.html` in a browser to play.

| Game | Folder | Style |
| --- | --- | --- |
| Fenrir Unbound | `fenrir-breaker/` | Brick breaker |
| Fenrir Bubbles | `fenrir-bubbles/` | Bubble Wand-style bubble shooter |
| Fenrir's Tower | `fenrir-stacker/` | Block stacker |
| Fenrir Flight | `fenrir-flight/` | Jetpack-style endless runner |
| Fenrir Volley | `fenrir-volley/` | Ballz-style volley block breaker |
| Fenrir Siege | `fenrir-siege/` | Clash-style base raid |

All of them share the same stream setup:

- **Viewer actions on keys 1–6.** In Fenrir, bind TikTok LIVE gifts, likes or chat keywords to these keys. Each game lists its six actions on the title screen, and each action shows an on-screen banner when triggered. Some help the streamer, some fight back.
- **9:16 portrait layout** to match TikTok LIVE.
- **Hands-free:** Enter or Space starts; rounds last 3:00 (Volley is endless) and restart on their own after a countdown.
- **H** hides the header and buttons so only the game shows in a window capture.
- **P** or **Esc** pauses.
