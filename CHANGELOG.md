# Changelog

## 1.5.3 — 2026-10-17

- Fix: 🤖 could show the `effortLevel` from `settings.json` (e.g. `xh`) instead of the effort actually in use. The bar now shows only the effort Claude Code sends with each request, and keeps it across reloads of the mod in the same session.

## 1.5.2 — 2026-10-17

- 🤖 effort shown from session start (`CLAUDE_CODE_EFFORT_LEVEL` or the `effortLevel` setting) and updated when a request starts, instead of only after the first answer; `/effort` changes show at once.

## 1.5.1 — 2026-10-17

- 🤖 effort shown as its first two letters (`lo`, `me`, `hi`, `xh`, `ma`), keeping its color.

## 1.5.0 — 2026-10-17

- 🤖 effort level colored by strength: low gray, medium green, high yellow, xhigh orange, max red and bold.

## 1.4.4 — 2026-10-17

- Percentages have a fixed-width integer part (3 columns) and, for context usage, always 2 decimals, so the row no longer shifts as values change.

## 1.4.3 — 2026-10-17

- 🕒 and 📅 percentages shown as received, without padding zeros (`5%`, `23.5%`).

## 1.4.2 — 2026-10-17

- 🧠 context usage computed from the token counts, so its two decimals are exact (Claude Code's own figure is a whole number).

## 1.4.1 — 2026-10-17

- Reached limits show the bare countdown, without the `reset tra` label.

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
