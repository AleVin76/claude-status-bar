# Claude Status Bar

A [Claude Code mod](https://code.claude.com/docs/it/plugins/mods/overview) that adds a single colored status row directly above the prompt with everything you need to keep an eye on during a session:

```
⏳ ███████░░░ 3:41 | 🧠 █░░░░░░░░░   6.00% | 🕒 █░░░░░░░░░   5% (11:00) | 📅 ░░░░░░░░░░   1% (20/10 11:00) | 🤖 Opus 5.5 me | ⚡  75 tok/s | 💲 1.23        [≡] [-]
```

| Segment | Meaning |
|---|---|
| ⏳ | Time left before the prompt cache expires (`--:--` before the first request, `scaduta` once expired) |
| 🧠 | Context window usage |
| 🕒 | 5-hour plan limit, with reset time. Once the limit is reached: time left to the reset (`2:15:30`) |
| 📅 | Weekly plan limit, with reset date and time. Once the limit is reached: time left to the reset (`2g 3:04:05`) |
| ⚡ | Generation speed of the last answer, in output tokens per second |
| 🤖 | Model and reasoning effort as its first two letters, colored by strength: `lo` gray, `me` green, `hi` yellow, `xh` orange, `ma` red and bold |
| 💲 | What the session would have cost at API prices, in US dollars |
| [≡] | Menu, right-aligned at the end of the row, in the theme's `suggestion` color (brackets and menu frame). Click it (or Tab + Enter) to open a framed list of actions that grows upward from the bar, one per line; a choice, **Chiudi** or a second press closes it |

Menu actions:

| Action | Effect |
|---|---|
| `⇄ Cache 1h → 5m` | Switches Claude Code's prompt cache TTL between `5m` and `1h`. Shown as `🔒 Cache 5m (…)` when an environment variable fixes it |

| `⚙ Blocchi e righe…` | Opens the blocks editor: show, hide, order and place each block on row 1 or 2, with a preview |
| `🔔 Suono completamento: on` | Turns the completion sound on or off |
| `🔔 Suono domanda: on` | Turns the question sound on or off |
| `▶ Prova suoni` | Plays both sounds, to check them |

## Sounds

| Sound | Plays when | Default file |
|---|---|---|
| Completion | Claude finishes an answer that took at least 15 seconds (not for interrupted turns or subagents) | `sounds/complete.wav`, a rising three-note chime |
| Question | Claude asks you something: a multiple-choice question, a permission request, an MCP input request. One sound per burst | `sounds/question.wav`, two rising notes |

Each sound can be turned on or off on its own, and each can use your own WAV file: see [Configuration → Sounds](docs/configuration.md#sounds). Sounds play on the computer running Claude Code (terminal, or local sessions of the Desktop app); cloud sessions are silent.

Which blocks appear, in which order and on which of up to two rows, is set by the `blocks` option: see [Configuration → Blocks](docs/configuration.md#blocks).

Bars turn **green** below 50%, **yellow** from 50% and **red** from 80%, and the value next to each bar takes the same color. Each bar can be hidden on its own, leaving the colored value. The ⏳ bar drains as the cache ages and changes color on the elapsed share. Colors follow your Claude Code theme (`success`, `warning`, `error`). Reset dates and times follow the operating system's regional settings.

## Requirements

- Claude Code **2.1.287** or later (`claude --version`)
- Terminal or the Code tab of the Claude Desktop app (see [Where it runs](docs/how-it-works.md#where-it-runs))

## Installation

### Automatic

**Windows (PowerShell)**

```powershell
irm https://raw.githubusercontent.com/AleVin76/claude-status-bar/main/scripts/install.ps1 | iex
```

**macOS / Linux**

```bash
curl -fsSL https://raw.githubusercontent.com/AleVin76/claude-status-bar/main/scripts/install.sh | bash
```

The installer:

1. checks the Claude Code version;
2. registers this repository as a plugin marketplace (or refreshes it);
3. installs the `statusbar` mod at user scope (or updates it if already installed);
4. enables it, also when it had been disabled before (an update alone keeps a disabled plugin disabled);
5. edits `~/.claude/settings.json`, after saving a timestamped backup next to it: removes the old `statusLine`, sets `promptCacheTtl` when `-CacheTtl` is given, sets the `locale` option to `system` when unset, and drops the `cacheTtl` option used by versions before 1.3.0;
6. checks with `claude plugin list` that the mod is installed **and enabled**, and stops with an error otherwise. It also warns when `disableAllHooks` is `true`, since that setting keeps every mod from loading.

Restart Claude Code, or run `/reload-plugins` in an open session.

Installer options:

| PowerShell | Bash | Environment variable (one-liner) | Effect |
|---|---|---|---|
| `-CacheTtl 1h` | `--cache-ttl 1h` | `CSB_CACHE_TTL=1h` | Sets Claude Code's prompt cache TTL (`promptCacheTtl`) to `5m` or `1h`. Left out, the current setting is kept |
| `-KeepStatusLine` | `--keep-statusline` | `CSB_KEEP_STATUSLINE=1` | Leave `statusLine` in `settings.json` untouched |
| — | — | `CSB_SOURCE=<owner/repo or path>` | Install from a fork or a local clone |

Example with options in a one-liner:

```powershell
$env:CSB_CACHE_TTL = '1h'; irm https://raw.githubusercontent.com/AleVin76/claude-status-bar/main/scripts/install.ps1 | iex
```

```bash
curl -fsSL https://raw.githubusercontent.com/AleVin76/claude-status-bar/main/scripts/install.sh | bash -s -- --cache-ttl 1h
```

### From inside Claude Code

```
/plugin install statusbar --marketplace AleVin76/claude-status-bar
```

Answer `y` to add the marketplace, then pick the scope. This path does not touch `statusLine`: remove it from `settings.json` yourself if you want only one bar.

### Manual

See [docs/installation.md](docs/installation.md).

## Update

Run the installer again: it detects the existing installation and updates it. Alternatively:

```
claude plugin marketplace update claude-status-bar
claude plugin update statusbar@claude-status-bar
```

## Uninstall

**Windows**

```powershell
irm https://raw.githubusercontent.com/AleVin76/claude-status-bar/main/scripts/uninstall.ps1 -OutFile uninstall.ps1
.\uninstall.ps1 -RestoreStatusLine
```

**macOS / Linux**

```bash
curl -fsSL https://raw.githubusercontent.com/AleVin76/claude-status-bar/main/scripts/uninstall.sh | bash -s -- --restore-statusline
```

`-RestoreStatusLine` / `--restore-statusline` puts back the `statusLine` saved in the most recent backup.

## Documentation

- [Installation](docs/installation.md): automatic, plugin manager and manual installation
- [Configuration](docs/configuration.md): options and where they are stored
- [How it works](docs/how-it-works.md): data sources, cache countdown, limits
- [Development](docs/development.md): project layout, validation, tests, release

## License

[MIT](LICENSE)
