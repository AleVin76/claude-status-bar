# How it works

The mod is a single hooks module, [`hooks/register.ts`](../hooks/register.ts), that runs inside Claude Code. It keeps a small in-memory snapshot and draws one row in the band above the prompt (`ui.render` hook on the `AbovePrompt` site). Unlike `$.ui.status`, that site accepts colored text and shows no plugin label.

## Colors

| Level | Color (theme key) |
|---|---|
| < 50% | green (`success`) |
| 50–79% | yellow (`warning`) |
| ≥ 80% | red (`error`) |

The thresholds are `WARNING_FROM` and `ERROR_FROM` at the top of `hooks/register.ts`. The ⏳ bar shows the time left, while its color is judged on the elapsed share: green right after a request, red near expiry.

## Data sources

| Segment | Source | Refreshed |
|---|---|---|
| ⏳ Cache | Time of the last main-loop API response (`turn.step` hook) plus the TTL that request used | Every second (`$.clock.every` + `$.ui.invalidate`) |
| ⇄ TTL | Same order Claude Code uses (below) | Session start, each request, each plan-limit change, each `settings.json` change |
| 🧠 Context | `context.tokens / context.window` (Claude Code's own `context.percent` is rounded to a whole number) | `session.measure` |
| 🕒 5-hour limit | `rateLimits` entry `five_hour` (`percentUsed`, `resetsAt`) | `session.measure` |
| 📅 Weekly limit | `rateLimits` entry `seven_day` | `session.measure` |
| 🤖 Model | `$.session.model()` | Session start and each request |
| 🤖 Effort | `effort` of the current request (`turn.step`); before the first request, `CLAUDE_CODE_EFFORT_LEVEL` or the `effortLevel` setting | Session start, start of each request, each `settings.json` change |
| 💲 Cost | `cost.usd`, the same total as `/cost`, in US dollars | `session.measure` |

`session.measure` is raised by Claude Code after every turn and whenever a plan limit moves, so those segments carry the same figures as the native status line.

## Date and time format

Reset labels show the time for the 5-hour window and date + time (without the year) for the weekly window. The format is resolved once per session:

| Source | Used when |
|---|---|
| `locale` option | Set to a non-empty value |
| Windows: `Get-Culture` short date and short time patterns | Windows. Honors custom formats set in **Settings → Time & language → Region** (date order, separators, 12/24 h) |
| `LC_ALL`, `LC_TIME`, `LANG` | macOS/Linux with a locale in the environment |
| `defaults read -g AppleLocale` | macOS without a locale in the environment |
| `en-US` | Nothing above is available |

Examples for the weekly reset: `20/10 11:00` (it-IT, `dd/MM/yyyy` + `HH:mm`), `10/20 11:00 AM` (en-US), `20.10 11:00` (de-DE).

The mod's runtime does not inherit the system locale by itself, which is why it is read explicitly.

## Effort colors

The effort is shown as its first two letters after the model name.

| Effort | Shown | Color (theme key) |
|---|---|---|
| `low` | `lo` | gray (`inactive`) |
| `medium` | `me` | green (`success`) |
| `high` | `hi` | yellow (`warning`) |
| `xhigh` | `xh` | orange (`claude`) |
| `max` | `ma` | red, bold (`error`) |

A numeric effort has no named level and is shown in the default color. The mapping is `EFFORT_STYLE` at the top of `hooks/register.ts`.

## Precision of the percentages

| Segment | Decimals | Why |
|---|---|---|
| 🧠 Context | 2, exact | Computed from the token counts. Integer part on 3 columns: `  6.06%`, ` 85.06%`, `100.00%` |
| 🕒 / 📅 Plan limits | As received, without padding zeros. Integer part on 3 columns: `  5%`, ` 23.5%`, `100%` | Anthropic reports plan usage already rounded and Claude Code keeps at most one decimal. No more precise figure reaches Claude Code |

Padding uses a figure space (U+2007), as wide as a digit, so the columns stay aligned in the terminal and in the Desktop app.

## Reached limits

When a plan window reaches 100%, its segment drops the percentage and the reset date and shows a live countdown to the reset instead, with a full red bar:

```
🕒 ██████████ 2:15:30 | 📅 ██████████ 2g 3:04:05
```

The format is `m:ss`, `h:mm:ss`, or `Ng h:mm:ss` beyond a day. When the reset time has passed but Claude Code has not reported new figures yet, the segment reads `reset in corso` until the next response.

## Prompt cache countdown

Anthropic's prompt cache keeps a prefix for a fixed time (5 minutes by default, 1 hour when extended) and every request that reads it restarts the timer. The mod therefore:

- records the time each main-loop request completes (subagents run on their own prefix and are ignored);
- shows `ttl - (now - last request)` as a bar and a `m:ss` / `h:mm:ss` countdown;
- shows `scaduta` when the time is up: the next request will write the cache again (higher cost, slower first token);
- resets to `--:--` after `/clear`, which starts a new conversation.

The countdown is an estimate computed on the client: it assumes the prefix was cached by the last request with the TTL in effect at that moment. Switching TTL does not change the entry already cached: the countdown follows the new value from the next request on.

### Which TTL is in effect

The mod resolves the TTL in the same order as Claude Code:

1. `FORCE_PROMPT_CACHING_5M` → `5m` (locked)
2. `CLAUDE_CODE_PROMPT_CACHE_TTL` → its value (locked)
3. `promptCacheTtl` in the merged settings
4. `ENABLE_PROMPT_CACHING_1H` → `1h`
5. Automatic: `1h` when plan limits are reported and none is exhausted (a subscription within its limits), `5m` otherwise

Before the first response of a session no plan limit is known yet, so an automatic TTL reads `5m` until then.

## Cost

`💲` is what the session would have cost at API list prices. Claude Code computes it for every session, including those on a Pro/Max subscription, where it is not billed.

## Limits

- 🕒 and 📅 appear only on a subscription plan: with an API key there are no plan windows to show.
- Before the first request, effort comes from `CLAUDE_CODE_EFFORT_LEVEL` or `effortLevel`; with neither set, it appears when the first request starts.
- Reset times are shown in the computer's local time zone.

## Where it runs

| Where | Shown |
|---|---|
| `claude` in a terminal (including IDE terminals and the JetBrains plugin) | Yes |
| Code tab of Claude Desktop | Yes |
| VS Code extension chat panel, `claude -p`, Agent SDK | Hooks run, nothing is drawn |
| WSL sessions in Claude Desktop | No (plugins are not available there) |

## Troubleshooting

| Symptom | Check |
|---|---|
| No bar at all | `claude --version` ≥ 2.1.287; `/plugin` lists the mod as active; `disableAllHooks` is not `true` in `settings.json` |
| Two bars | `statusLine` is still in `settings.json`: remove it |
| Row briefly disappears | A survey is using the band above the prompt; the row comes back when it closes |
| ⏳ always `--:--` | No request sent yet in this session |
| 🕒 / 📅 missing | API-key login, or no response received yet |
| Errors | Start with `claude --debug` and look for lines starting with `statusbar:` |
