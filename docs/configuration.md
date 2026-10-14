# Configuration

## Options

| Option | Values | Default | Description |
|---|---|---|---|
| `cacheTtl` | `5m`, `1h` | `5m` | Prompt cache lifetime used by the ⏳ countdown. Use `1h` if you enabled the 1-hour prompt cache. |
| `locale` | BCP 47 tag (`it-IT`, `en-GB`, …) or empty | empty | Locale for reset dates and times. Empty uses the operating system's regional settings (see [How it works → Date and time format](how-it-works.md#date-and-time-format)). |

## Changing an option

**From Claude Code**: open `/config` and change the **Prompt cache TTL** or **Date/time locale** row. The mod reloads with the new value.

**At install time**:

```bash
claude plugin install statusbar@claude-status-bar --config cacheTtl=1h
```

or with the installer (`-CacheTtl 1h` / `--cache-ttl 1h`).

**In `settings.json`**: options live under `pluginConfigs`, keyed by plugin id:

```json
{
  "pluginConfigs": {
    "statusbar@claude-status-bar": {
      "options": { "cacheTtl": "1h", "locale": "" }
    }
  }
}
```

For a folder loaded with `--plugin-dir` or `CLAUDE_CODE_PLUGIN_DIRS`, the key is `statusbar@inline`.

## Coexistence with `statusLine`

The mod draws in the band directly above the prompt. It does not replace the command-based `statusLine` setting: if that is still configured, both are shown. The installer removes it for you; otherwise delete the `statusLine` block from `settings.json`.

## Turning it off

- One session: start Claude Code with `--safe-mode`.
- Permanently: disable the plugin in `/plugin` → **Installed**, or uninstall it (see the [README](../README.md#uninstall)).
