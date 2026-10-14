# Installation

## Automatic (recommended)

See the [README](../README.md#automatic). The scripts are idempotent: running them again updates the mod instead of installing it twice.

What they change:

| File / command | Change |
|---|---|
| `claude plugin marketplace add AleVin76/claude-status-bar` | Adds `claude-status-bar` under `extraKnownMarketplaces` in `~/.claude/settings.json` |
| `claude plugin install statusbar@claude-status-bar` | Enables the plugin (`enabledPlugins`) |
| `~/.claude/settings.json` | Removes `statusLine` (unless `-KeepStatusLine` / `--keep-statusline`); sets `promptCacheTtl` with `-CacheTtl` / `--cache-ttl`; drops the pre-1.3.0 `cacheTtl` option |
| `~/.claude/settings.json.<yyyyMMdd-HHmmss>.bak` | Backup written before any of the changes above |

On Windows `~` is `%USERPROFILE%`.

### Execution policy (Windows)

`irm … | iex` runs the script in memory and is not affected by the execution policy. To run a downloaded copy instead:

```powershell
irm https://raw.githubusercontent.com/AleVin76/claude-status-bar/main/scripts/install.ps1 -OutFile install.ps1
powershell -ExecutionPolicy Bypass -File .\install.ps1 -CacheTtl 1h
```

## Plugin manager

From the Claude Code prompt:

```
/plugin install statusbar --marketplace AleVin76/claude-status-bar
```

Or from the shell:

```bash
claude plugin marketplace add AleVin76/claude-status-bar
claude plugin install statusbar@claude-status-bar
```

## Manual (from a local folder)

1. Clone the repository or download the ZIP:

   ```bash
   git clone https://github.com/AleVin76/claude-status-bar.git
   ```

2. Load the folder in every session by adding it to `~/.claude/settings.json`:

   ```json
   {
     "env": {
       "CLAUDE_CODE_PLUGIN_DIRS": "C:\\path\\to\\claude-status-bar"
     }
   }
   ```

   Several folders are separated by `;` on Windows and `:` on macOS/Linux. For a single session use `claude --plugin-dir <folder>` instead.

3. Remove the `statusLine` block from the same file if you want only this bar.

A folder loaded this way is read as `statusbar@inline`; see [configuration](configuration.md) for how its options are stored.

## Verify

In Claude Code run `/plugin`: the line under the tabs shows `1 mod active · statusbar` (or the list of active mods). If the bar does not appear, see [How it works → Troubleshooting](how-it-works.md#troubleshooting).
