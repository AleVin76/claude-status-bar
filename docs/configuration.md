# Configuration

## Options

| Option | Values | Default | Description |
|---|---|---|---|
| `locale` | `system` or a BCP 47 tag (`it-IT`, `en-GB`, …) | `system` | Locale for reset dates and times. `system` (or empty) uses the operating system's regional settings (see [How it works → Date and time format](how-it-works.md#date-and-time-format)). |

## Changing an option

**From Claude Code**: open `/config` and change the **Date/time locale** row. The mod reloads with the new value.

**At install time**:

```bash
claude plugin install statusbar@claude-status-bar --config locale=it-IT
```

**In `settings.json`**: options live under `pluginConfigs`, keyed by plugin id:

```json
{
  "pluginConfigs": {
    "statusbar@claude-status-bar": {
      "options": { "locale": "system" }
    }
  }
}
```

For a folder loaded with `--plugin-dir` or `CLAUDE_CODE_PLUGIN_DIRS`, the key is `statusbar@inline`.

## Prompt cache TTL

The cache duration is Claude Code's own setting, not an option of the mod: the mod reads it to drive the ⏳ countdown and lets you change it from the bar.

| How | Effect |
|---|---|
| **≡ menu → ⇄ Cache** on the bar | Switches between `5m` and `1h` by writing `promptCacheTtl` to `~/.claude/settings.json`. Applies from the next request |
| `"promptCacheTtl": "5m"` or `"1h"` in `settings.json` | Same, by hand |
| Installer `-CacheTtl` / `--cache-ttl` | Same, at install time |
| Env `CLAUDE_CODE_PROMPT_CACHE_TTL=5m` / `1h` | Wins over the setting; the menu item shows 🔒 and cannot be chosen |
| Env `FORCE_PROMPT_CACHING_5M=1` | Forces 5 minutes over everything; the menu item shows 🔒 |
| Nothing set | Automatic: 1 hour on a Claude subscription within its limits, 5 minutes with an API key, Bedrock, Vertex or Foundry |

The 1-hour cache keeps the prefix warm across longer pauses, but with an API key its writes are billed at a higher rate.

A `promptCacheTtl` in a project's `.claude/settings.local.json` or `.claude/settings.json` wins over the user one: the button then reports that the project imposes another value.

Organizations whose managed settings restrict mods may stop the mod from writing `settings.json`; the button then has no effect.

Versions before 1.3.0 had a `cacheTtl` plugin option that only changed the countdown. It is ignored now, and the installer removes it.

## Coexistence with `statusLine`

The mod draws in the band directly above the prompt. It does not replace the command-based `statusLine` setting: if that is still configured, both are shown. The installer removes it for you; otherwise delete the `statusLine` block from `settings.json`.

## Turning it off

- One session: start Claude Code with `--safe-mode`.
- Permanently: disable the plugin in `/plugin` → **Installed**, or uninstall it (see the [README](../README.md#uninstall)).
