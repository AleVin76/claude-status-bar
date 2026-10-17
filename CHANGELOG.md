# Changelog

## 1.4.0 — 2026-10-17

- 🕒 and 📅: once a limit is reached, the percentage and reset date are replaced by a live countdown to the reset (`reset tra 2:15:30`, `reset tra 2g 3:04:05`).

## 1.3.2 — 2026-10-17

- Installers always leave the plugin enabled: they run `claude plugin enable` after installing or updating (an update alone kept a disabled plugin disabled), then check `claude plugin list` and stop with an error if it is not enabled.
- Installers warn when `disableAllHooks` is `true`, which keeps every mod from loading.
- The `locale` option defaults to `system`; installers set it when unset, so Claude Code no longer reports an unconfigured option.

## 1.3.1 — 2026-10-14

- The ⇄ cache TTL switch is aligned to the right edge of the row.

## 1.3.0 — 2026-10-14

- ⇄ button at the end of the bar switches Claude Code's prompt cache TTL between 5m and 1h (`promptCacheTtl` in `settings.json`); 🔒 when an environment variable fixes it.
- The ⏳ countdown follows the TTL Claude Code actually uses (env variables, `promptCacheTtl`, automatic 1h on subscriptions) and the TTL of the last request.
- The `cacheTtl` plugin option is removed; installers' `-CacheTtl` / `--cache-ttl` now set `promptCacheTtl` and clean up the old option.

## 1.2.0 — 2026-10-14

- Weekly reset shows date and time.
- Reset dates and times follow the operating system's regional settings (Windows custom formats included); new `locale` option to override them.
- Cost shown without the `$` sign.

## 1.1.0 — 2026-10-14

- Bars colored green / yellow / red by level (50% and 80% thresholds).
- The row is drawn above the prompt without the `statusbar` label in front.

## 1.0.0 — 2026-10-14

- First release: prompt cache countdown, context, 5-hour and weekly limits, model/effort, API-equivalent cost.
- Automatic installers for Windows (PowerShell) and macOS/Linux (Bash).
