# Claude Status Bar

A [Claude Code mod](https://code.claude.com/docs/it/plugins/mods/overview) that adds a single colored status row directly above the prompt with everything you need to keep an eye on during a session:

```
⏳ ███████░░░ 3:41 | 🧠 █░░░░░░░░░ 6.00% | 🕒 █░░░░░░░░░ 5.00% (11:00) | 📅 ░░░░░░░░░░ 1.00% (20/10) | 🤖 Opus 5.5 medium | 💲 $1.23
```

| Segment | Meaning |
|---|---|
| ⏳ | Time left before the prompt cache expires (`--:--` before the first request, `scaduta` once expired) |
| 🧠 | Context window usage |
| 🕒 | 5-hour plan limit, with reset time |
| 📅 | Weekly plan limit, with reset date |
| 🤖 | Model and reasoning effort |
| 💲 | What the session would have cost at API prices |

Bars turn **green** below 50%, **yellow** from 50% and **red** from 80%. The ⏳ bar drains as the cache ages and changes color on the elapsed share. Colors follow your Claude Code theme (`success`, `warning`, `error`).

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
3. installs the `statusbar` mod (or updates it if already installed);
4. removes the old `statusLine` entry from `~/.claude/settings.json`, after saving a timestamped backup next to it.

Restart Claude Code, or run `/reload-plugins` in an open session.

Installer options:

| PowerShell | Bash | Environment variable (one-liner) | Effect |
|---|---|---|---|
| `-CacheTtl 1h` | `--cache-ttl 1h` | `CSB_CACHE_TTL=1h` | Countdown for the 1-hour prompt cache (default `5m`) |
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
