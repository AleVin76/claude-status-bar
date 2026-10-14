# Configuration

## Options

| Option | Values | Default | Description |
|---|---|---|---|
| `cacheTtl` | `5m`, `1h` | `5m` | Prompt cache lifetime used by the ⏳ countdown. Use `1h` if you enabled the 1-hour prompt cache. |

## Changing an option

**From Claude Code**: open `/config` and change the **Prompt cache TTL** row. The mod reloads with the new value.

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
      "options": { "cacheTtl": "1h" }
    }
  }
}
```

For a folder loaded with `--plugin-dir` or `CLAUDE_CODE_PLUGIN_DIRS`, the key is `statusbar@inline`.

## Coexistence with `statusLine`

The mod draws through `$.ui.status`, a line under the prompt next to Claude Code's own notices. It does not replace the command-based `statusLine` setting: if that is still configured, both are shown. The installer removes it for you; otherwise delete the `statusLine` block from `settings.json`.

## Turning it off

- One session: start Claude Code with `--safe-mode`.
- Permanently: disable the plugin in `/plugin` → **Installed**, or uninstall it (see the [README](../README.md#uninstall)).
