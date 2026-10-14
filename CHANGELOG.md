# Changelog

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
