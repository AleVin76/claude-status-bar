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
| ⏳ Cache | Time of the last main-loop API response (`turn.step` hook) plus `cacheTtl` | Every second (`$.clock.every` + `$.ui.invalidate`) |
| 🧠 Context | `context.percent` | `session.measure` |
| 🕒 5-hour limit | `rateLimits` entry `five_hour` (`percentUsed`, `resetsAt`) | `session.measure` |
| 📅 Weekly limit | `rateLimits` entry `seven_day` | `session.measure` |
| 🤖 Model | `$.session.model()` | Session start and each request |
| 🤖 Effort | `effort` of the last request (`turn.step`) | Each request |
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

## Prompt cache countdown

Anthropic's prompt cache keeps a prefix for a fixed time (5 minutes by default, 1 hour when extended) and every request that reads it restarts the timer. The mod therefore:

- records the time each main-loop request completes (subagents run on their own prefix and are ignored);
- shows `ttl - (now - last request)` as a bar and a `m:ss` / `h:mm:ss` countdown;
- shows `scaduta` when the time is up: the next request will write the cache again (higher cost, slower first token);
- resets to `--:--` after `/clear`, which starts a new conversation.

The countdown is an estimate computed on the client: it assumes the prefix was cached by the last request and that the server TTL matches `cacheTtl`.

## Cost

`💲` is what the session would have cost at API list prices. Claude Code computes it for every session, including those on a Pro/Max subscription, where it is not billed.

## Limits

- 🕒 and 📅 appear only on a subscription plan: with an API key there are no plan windows to show.
- Effort is known only after the first request of the session.
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
