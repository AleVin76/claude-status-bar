import type { Color, EngineInterface, Register, RenderInput, RenderElement, SessionRateLimit, SessionUsage } from 'claude-code'
import {
  playCompleteSound,
  playQuestionSound,
  playSound,
  readSoundSettings,
  setSoundOption,
  type SoundSettings,
} from './sounds'

type Ttl = '5m' | '1h'

// Why the TTL has its value; `force` and `env` cannot be changed from the bar
type TtlSource = 'force' | 'env' | 'setting' | 'enable-1h' | 'auto'

const BAR_WIDTH = 10
const TTL_MS = { '5m': 300_000, '1h': 3_600_000 } as const
const WARNING_FROM = 50
const ERROR_FROM = 80

type Segment = {
  icon: string
  // Fill level of the bar and the value its color is judged on (0-100); absent for plain text
  percent?: number
  text: string
  // Trailing word drawn in its own color (the effort level)
  accent?: { text: string; color?: Color; bold?: boolean }
}

// Effort from weakest to strongest, on theme keys so light and dark themes both read well
const EFFORT_STYLE: Record<string, { color: Color; bold?: boolean }> = {
  low: { color: 'inactive' },
  medium: { color: 'success' },
  high: { color: 'warning' },
  xhigh: { color: 'claude' },
  max: { color: 'error', bold: true },
}

type Snapshot = {
  ttl: Ttl
  ttlSource: TtlSource
  // TTL the last request was sent with: a switch applies from the next request on
  requestTtl?: Ttl
  dates: DateFormatter
  // Output tokens per second of the last main-loop response
  speed?: number
  // Last main-loop API response: every request restarts the prompt cache TTL
  lastResponseAt?: number
  effort?: string
  model?: string
  usage?: Omit<SessionUsage, 'startedAt'>
  now: number
}

const state: Snapshot = { ttl: '5m', ttlSource: 'auto', dates: intlFormatter(undefined), now: 0 }

function clamp(percent: number): number {
  return Math.max(0, Math.min(100, percent))
}

function bar(percent: number): string {
  const filled = Math.round((clamp(percent) / 100) * BAR_WIDTH)
  return '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled)
}

function levelColor(percent: number): Color {
  if (percent >= ERROR_FROM) return 'error'
  if (percent >= WARNING_FROM) return 'warning'
  return 'success'
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// Figure space: as wide as a digit in every font, and never collapsed like a plain space on the desktop surface
const DIGIT_SPACE = '\u2007'
const INTEGER_WIDTH = 3

function padInteger(integer: string): string {
  return integer.padStart(INTEGER_WIDTH, DIGIT_SPACE)
}

// Plan limits arrive with at most one decimal: integer part on 3 columns, decimals only when present ("  5%", " 23.5%")
function limitPct(value: number): string {
  const [integer = '0', decimals] = String(Number(value.toFixed(1))).split('.')
  return `${padInteger(integer)}${decimals ? `.${decimals}` : ''}%`
}

// Integer part on 3 columns, always 2 decimals ("  6.06%", " 85.06%", "100.00%")
function pct(value: number): string {
  const [integer = '0', decimals = '00'] = value.toFixed(2).split('.')
  return `${padInteger(integer)}.${decimals}%`
}

// m:ss, h:mm:ss, or "Ng h:mm:ss" past a day (weekly window)
function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const d = Math.floor(total / 86_400)
  const h = Math.floor((total % 86_400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (d > 0) return `${d}g ${h}:${pad(m)}:${pad(s)}`
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

type DateFormatter = { time: (d: Date) => string; dateTime: (d: Date) => string }

const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', ...TIME_FORMAT }

function intlFormatter(locale: string | undefined): DateFormatter {
  return {
    time: d => d.toLocaleTimeString(locale, TIME_FORMAT),
    dateTime: d => d.toLocaleString(locale, DATE_TIME_FORMAT),
  }
}

// Renders a .NET custom date/time pattern (Windows "Region" settings) for the tokens short patterns use
function formatDotNet(pattern: string, d: Date, locale: string | undefined): string {
  const h = d.getHours()
  const tokens: Record<string, string> = {
    MMMM: d.toLocaleString(locale, { month: 'long' }), MMM: d.toLocaleString(locale, { month: 'short' }),
    yyyy: String(d.getFullYear()), yy: pad(d.getFullYear() % 100),
    MM: pad(d.getMonth() + 1), M: String(d.getMonth() + 1),
    dd: pad(d.getDate()), d: String(d.getDate()),
    HH: pad(h), H: String(h),
    hh: pad(h % 12 || 12), h: String(h % 12 || 12),
    mm: pad(d.getMinutes()), m: String(d.getMinutes()),
    tt: h < 12 ? 'AM' : 'PM', t: h < 12 ? 'A' : 'P',
  }
  return pattern.replace(/'([^']*)'|MMMM|MMM|yyyy|yy|MM|M|dd|d|HH|H|hh|h|mm|m|tt|t/g, (match, literal: string | undefined) =>
    literal ?? tokens[match] ?? match,
  )
}

// Short date without the year: "dd/MM/yyyy" -> "dd/MM", "yyyy-MM-dd" -> "MM-dd"
function stripYear(pattern: string): string {
  return pattern.replace(/^y+[^dM]*|[^dM]*y+$/g, '').replace(/([^dM]+)y+[^dM]*/g, '$1')
}

function dotNetFormatter(shortDate: string, shortTime: string, locale: string | undefined): DateFormatter {
  const datePattern = stripYear(shortDate)
  return {
    time: d => formatDotNet(shortTime, d, locale),
    dateTime: d => `${formatDotNet(datePattern, d, locale)} ${formatDotNet(shortTime, d, locale)}`,
  }
}

// "it_IT.UTF-8" -> "it-IT"; "C"/"POSIX" carry no locale
function posixToBcp47(value: string | undefined): string | undefined {
  const tag = value?.split('.')[0]?.split('@')[0]?.replace('_', '-')
  return tag && tag !== 'C' && tag !== 'POSIX' ? tag : undefined
}

async function systemFormatter($: EngineInterface): Promise<DateFormatter> {
  if ((await $.env.get('OS')) === 'Windows_NT') {
    try {
      const { exitCode, stdout } = await $.process.run(
        ['powershell', '-NoProfile', '-NonInteractive', '-Command',
          '$c = Get-Culture; $c.DateTimeFormat.ShortDatePattern; $c.DateTimeFormat.ShortTimePattern; $c.Name'],
        { timeoutMs: 10_000 },
      )
      const [shortDate, shortTime, culture] = stdout.split(/\r?\n/).map(line => line.trim())
      if (exitCode === 0 && shortDate && shortTime) return dotNetFormatter(shortDate, shortTime, culture || undefined)
    } catch {
      // Fall through to the environment-based locale
    }
  }

  const fromEnv = posixToBcp47((await $.env.get('LC_ALL')) || (await $.env.get('LC_TIME')) || (await $.env.get('LANG')))
  if (fromEnv) return intlFormatter(fromEnv)

  try {
    // Only macOS has `defaults`: asking elsewhere just logs a missing-executable warning
    const uname = await $.process.run(['uname'], { timeoutMs: 5_000 })
    if (uname.stdout.trim() === 'Darwin') {
      const { exitCode, stdout } = await $.process.run(['defaults', 'read', '-g', 'AppleLocale'], { timeoutMs: 5_000 })
      if (exitCode === 0) return intlFormatter(posixToBcp47(stdout.trim()))
    }
  } catch {
    // No uname: not a Unix system
  }
  return intlFormatter(undefined)
}

function resetLabel(limit: SessionRateLimit): string {
  if (!limit.resetsAt) return ''
  const date = new Date(limit.resetsAt)
  return ` (${limit.kind === 'five_hour' ? state.dates.time(date) : state.dates.dateTime(date)})`
}

// Claude Code rounds context.percent to a whole number: recompute it from the token counts
function contextPercent(context: SessionUsage['context']): number {
  const { tokens, window } = context
  return tokens !== undefined && window > 0 ? (tokens / window) * 100 : (context.percent ?? 0)
}

function limitSegment(icon: string, limit: SessionRateLimit | undefined): Segment | undefined {
  if (!limit) return undefined
  // Limit reached: the only useful figure is how long until the window resets
  if (limit.percentUsed >= 100 && limit.resetsAt) {
    const left = Date.parse(limit.resetsAt) - state.now
    return { icon, percent: 100, text: left > 0 ? countdown(left) : 'reset in corso' }
  }
  return { icon, percent: limit.percentUsed, text: `${limitPct(limit.percentUsed)}${resetLabel(limit)}` }
}

function cacheSegment(): Segment {
  if (state.lastResponseAt === undefined) return { icon: '⏳', percent: 0, text: '--:--' }
  const ttlMs = TTL_MS[state.requestTtl ?? state.ttl]
  const left = state.lastResponseAt + ttlMs - state.now
  // Elapsed share drives the color: green when fresh, red close to expiry
  return left > 0
    ? { icon: '⏳', percent: 100 - (left / ttlMs) * 100, text: countdown(left) }
    : { icon: '⏳', percent: 100, text: 'scaduta' }
}

// Block ids for the `blocks` option, in their default order
const BLOCK_IDS = ['cache', 'context', '5h', '7d', 'model', 'speed', 'cost'] as const
type BlockId = (typeof BLOCK_IDS)[number]

// Blocks shown and their order; set from the `blocks` option at load
let blocks: BlockId[] = [...BLOCK_IDS]
let unknownBlocks: string[] = []

function isBlockId(value: string): value is BlockId {
  return (BLOCK_IDS as readonly string[]).includes(value)
}

// "cache, model, cost" -> those blocks in that order; empty or "default" -> every block
function parseBlocks(value: unknown): { ids: BlockId[]; unknown: string[] } {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (text === '' || text === 'default') return { ids: [...BLOCK_IDS], unknown: [] }
  const ids: BlockId[] = []
  const unknown: string[] = []
  for (const name of text.split(/[\s,;]+/).filter(Boolean)) {
    if (!isBlockId(name)) unknown.push(name)
    else if (!ids.includes(name)) ids.push(name)
  }
  return { ids, unknown }
}

function speedSegment(): Segment {
  const speed = state.speed
  return { icon: '⚡', text: `${padInteger(speed === undefined ? '-' : String(Math.round(speed)))} tok/s` }
}

function buildBlock(id: BlockId): Segment | undefined {
  const { usage, model, effort } = state
  switch (id) {
    case 'cache':
      return cacheSegment()
    case 'context': {
      if (!usage) return undefined
      const context = contextPercent(usage.context)
      return { icon: '🧠', percent: context, text: pct(context) }
    }
    case '5h':
      return usage && limitSegment('🕒', usage.rateLimits.find(l => l.kind === 'five_hour'))
    case '7d':
      return usage && limitSegment('📅', usage.rateLimits.find(l => l.kind === 'seven_day'))
    case 'model': {
      if (!model) return undefined
      // A numeric effort has no named level: shown in the default color
      const style = effort ? EFFORT_STYLE[effort] : undefined
      // Two letters keep the row short: lo, me, hi, xh, ma
      return { icon: '🤖', text: model, ...(effort ? { accent: { text: effort.slice(0, 2), ...style } } : {}) }
    }
    case 'speed':
      return speedSegment()
    case 'cost':
      return usage?.cost && { icon: '💲', text: usage.cost.usd.toFixed(2) }
  }
}

function segments(): Segment[] {
  return blocks.map(buildBlock).filter((segment): segment is Segment => segment !== undefined)
}

function isTruthy(value: string | undefined): boolean {
  return value !== undefined && ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function asTtl(value: unknown): Ttl | undefined {
  return value === '5m' || value === '1h' ? value : undefined
}

// Mirrors Claude Code's own order: FORCE_PROMPT_CACHING_5M, CLAUDE_CODE_PROMPT_CACHE_TTL,
// the promptCacheTtl setting, ENABLE_PROMPT_CACHING_1H, then automatic
// (1 hour on a subscription within its limits, 5 minutes otherwise)
// Only the engine knows the effort in use: it depends on /effort, --effort, per-model settings
// and model defaults. The bar shows what the last request reported, kept across reloads of the mod
type SavedEffort = { sessionId: string; model: string; effort: string }

async function restoreEffort($: EngineInterface): Promise<void> {
  const saved = (await $.store.get('effort')) as SavedEffort | undefined
  if (saved && saved.sessionId === (await $.session.id()) && saved.model === state.model) state.effort = saved.effort
}

async function saveEffort($: EngineInterface, effort: string): Promise<void> {
  const value: SavedEffort = { sessionId: await $.session.id(), model: state.model ?? '', effort }
  await $.store.set('effort', value)
}

async function resolveTtl($: EngineInterface): Promise<void> {
  if (isTruthy(await $.env.get('FORCE_PROMPT_CACHING_5M'))) {
    state.ttl = '5m'
    state.ttlSource = 'force'
    return
  }
  const fromEnv = asTtl(await $.env.get('CLAUDE_CODE_PROMPT_CACHE_TTL'))
  if (fromEnv) {
    state.ttl = fromEnv
    state.ttlSource = 'env'
    return
  }
  const fromSetting = asTtl((await $.settings.read()).promptCacheTtl)
  if (fromSetting) {
    state.ttl = fromSetting
    state.ttlSource = 'setting'
    return
  }
  if (isTruthy(await $.env.get('ENABLE_PROMPT_CACHING_1H'))) {
    state.ttl = '1h'
    state.ttlSource = 'enable-1h'
    return
  }
  const limits = state.usage?.rateLimits ?? []
  const isSubscription = limits.length > 0
  const isWithinLimits = limits.every(limit => limit.percentUsed < 100)
  state.ttl = isSubscription && isWithinLimits ? '1h' : '5m'
  state.ttlSource = 'auto'
}

async function userSettingsPath($: EngineInterface): Promise<string | undefined> {
  const configDir = await $.env.get('CLAUDE_CONFIG_DIR')
  if (configDir) return `${configDir}/settings.json`
  const home = (await $.env.get('USERPROFILE')) || (await $.env.get('HOME'))
  return home ? `${home}/.claude/settings.json` : undefined
}

// Writes promptCacheTtl to the user settings.json, which Claude Code reloads on change
async function switchTtl($: EngineInterface): Promise<void> {
  await resolveTtl($)
  if (state.ttlSource === 'force' || state.ttlSource === 'env') {
    $.ui.toast(`Durata cache bloccata da ${state.ttlSource === 'force' ? 'FORCE_PROMPT_CACHING_5M' : 'CLAUDE_CODE_PROMPT_CACHE_TTL'}`)
    return
  }

  const target: Ttl = state.ttl === '5m' ? '1h' : '5m'
  const path = await userSettingsPath($)
  if (!path) {
    $.ui.toast('Impossibile trovare settings.json')
    return
  }

  let settings: Record<string, unknown> = {}
  if (await $.fs.exists(path)) {
    try {
      const parsed: unknown = JSON.parse(await $.fs.read(path))
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
      settings = parsed as Record<string, unknown>
    } catch {
      $.ui.toast('settings.json non valido: durata cache non modificata')
      return
    }
  }
  await $.fs.write(path, `${JSON.stringify({ ...settings, promptCacheTtl: target }, null, 2)}\n`)

  await resolveTtl($)
  // A project or local settings file can still hold its own promptCacheTtl, which wins over the user's
  $.ui.toast(
    state.ttl === target
      ? `Durata cache: ${target} (dalla prossima richiesta)`
      : `Salvato ${target}, ma un'impostazione di progetto impone ${state.ttl}`,
  )
  $.ui.invalidate('ui.render')
}

// In the CP437 set, so Windows console fonts (Consolas, Cascadia) draw it narrow, focused or not;
// ☰ comes from a fallback font there and breaks the row when the focus inverts it
const MENU_SYMBOL = '≡'
// Accent for the menu (brackets and frame), distinct from the green/yellow/red/orange/gray of the bar
const MENU_COLOR: Color = 'suggestion'

// Whether the menu row under the bar is shown; closes again after any choice
let menuOpen = false

type MenuItem = {
  key: string
  label: string
  // Absent: the item is shown dimmed and cannot be chosen
  onPress?: () => Promise<void> | void
}

// Notification types that mean Claude Code is waiting for an answer
const QUESTION_NOTIFICATIONS = new Set([
  'permission_prompt',
  'worker_permission_prompt',
  'elicitation_dialog',
  'elicitation_url_dialog',
  'agent_needs_input',
])
const NOTIFICATION_WINDOW_MS = 10_000

// Sound settings from the plugin options; a menu toggle updates them at once, ahead of the reload it causes
let sounds: SoundSettings = readSoundSettings({})

function onOff(value: boolean): string {
  return value ? 'on' : 'off'
}

// New actions go here: each becomes one entry of the menu
function menuItems($: EngineInterface): MenuItem[] {
  const other: Ttl = state.ttl === '5m' ? '1h' : '5m'
  const isLocked = state.ttlSource === 'force' || state.ttlSource === 'env'
  const lockedBy = state.ttlSource === 'force' ? 'FORCE_PROMPT_CACHING_5M' : 'CLAUDE_CODE_PROMPT_CACHE_TTL'
  return [
    isLocked
      ? { key: 'ttl', label: `🔒 Cache ${state.ttl} (${lockedBy})` }
      : { key: 'ttl', label: `⇄ Cache ${state.ttl} → ${other}`, onPress: () => switchTtl($) },
    {
      key: 'sound-complete',
      label: `${sounds.onComplete ? '🔔' : '🔕'} Suono completamento: ${onOff(sounds.onComplete)}`,
      onPress: async () => {
        sounds = { ...sounds, onComplete: !sounds.onComplete }
        await setSoundOption($, 'soundOnComplete', sounds.onComplete)
      },
    },
    {
      key: 'sound-question',
      label: `${sounds.onQuestion ? '🔔' : '🔕'} Suono domanda: ${onOff(sounds.onQuestion)}`,
      onPress: async () => {
        sounds = { ...sounds, onQuestion: !sounds.onQuestion }
        await setSoundOption($, 'soundOnQuestion', sounds.onQuestion)
      },
    },
    {
      key: 'sound-test',
      label: '▶ Prova suoni',
      onPress: async () => {
        await playSound($, 'complete', sounds)
        await playSound($, 'question', sounds)
      },
    },
  ]
}

function draw($: EngineInterface, e: RenderInput): RenderElement {
  const { Box, Text, Button } = $.ui.resolve(e)
  const children: RenderElement[] = []

  segments().forEach((segment, i) => {
    if (i > 0) children.push(Text({ dimColor: true, children: [' | '] }))
    if (segment.percent === undefined) {
      children.push(Text({ children: [`${segment.icon} ${segment.text}`] }))
      if (segment.accent) {
        const { text, color, bold } = segment.accent
        children.push(Text({ children: [' '] }), Text({ color, bold, children: [text] }))
      }
      return
    }
    // Cache bar shows time left, so it drains while its color heats up
    const fill = segment.icon === '⏳' && segment.text !== '--:--' ? 100 - segment.percent : segment.percent
    children.push(
      Text({ children: [`${segment.icon} `] }),
      Text({ color: levelColor(segment.percent), children: [bar(fill)] }),
      Text({ children: [` ${segment.text}`] }),
    )
  })

  // Full band width with the segments growing into the free space, so the menu button sits at the right edge,
  // right before the engine's own [-] collapse mark
  const row = Box({
    key: 'statusbar-row',
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    columnGap: 1,
    children: [
      Box({ flexGrow: 1, flexShrink: 1, children: [Text({ wrap: 'truncate-end', children })] }),
      Box({
        key: 'menu-button',
        flexShrink: 0,
        flexDirection: 'row',
        // A Button label takes no color: the brackets are colored Text around it
        children: [
          Text({ color: MENU_COLOR, children: ['['] }),
          Button({
            key: 'menu',
            label: MENU_SYMBOL,
            plain: true,
            onPress: () => {
              menuOpen = !menuOpen
              $.ui.invalidate('ui.render')
            },
          }),
          Text({ color: MENU_COLOR, children: [']'] }),
        ],
      }),
    ],
  })
  if (!menuOpen) return row

  // One item per line, right-aligned under the symbol: the band sits above the prompt, so the menu grows upward
  const items = menuItems($).map(item =>
    item.onPress
      ? Button({
          key: item.key,
          label: item.label,
          plain: true,
          onPress: () => {
            menuOpen = false
            $.ui.invalidate('ui.render')
            void item.onPress?.()
          },
        })
      : Text({ dimColor: true, children: [item.label] }),
  )

  return Box({
    flexDirection: 'column',
    width: '100%',
    children: [
      Box({
        key: 'menu-items',
        flexDirection: 'column',
        alignItems: 'flex-end',
        borderStyle: 'round',
        borderColor: MENU_COLOR,
        paddingX: 1,
        alignSelf: 'flex-end',
        children: [
          ...items,
          Button({
            key: 'menu-close',
            label: 'Chiudi',
            plain: true,
            dimColor: true,
            onPress: () => {
              menuOpen = false
              $.ui.invalidate('ui.render')
            },
          }),
        ],
      }),
      row,
    ],
  })
}

async function tick($: EngineInterface): Promise<void> {
  state.now = await $.clock.now()
  $.ui.invalidate('ui.render')
}

export const register: Register = (on, options) => {
  // "system" (the default) or empty: the operating system's regional settings
  const configured = typeof options.locale === 'string' ? options.locale.trim() : ''
  const locale = configured.toLowerCase() === 'system' ? '' : configured
  if (locale !== '') state.dates = intlFormatter(locale)
  sounds = readSoundSettings(options)
  ;({ ids: blocks, unknown: unknownBlocks } = parseBlocks(options.blocks))

  on('session.start', async ($, e, next) => {
    // An explicit locale wins; otherwise the OS regional settings, resolved once per session
    if (locale === '') state.dates = await systemFormatter($)
    state.usage = await $.session.usage()
    state.model = await $.session.model()
    if (state.effort === undefined) await restoreEffort($)
    await resolveTtl($)
    if (unknownBlocks.length > 0) $.ui.toast(`Blocchi sconosciuti ignorati: ${unknownBlocks.join(', ')}. Validi: ${BLOCK_IDS.join(', ')}`)
    await tick($)
    // 1 s tick drives the cache countdown; the other figures arrive via session.measure
    $.clock.every(1000, () => void tick($))
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    state.usage = { context: e.context, rateLimits: e.rateLimits, cost: e.cost }
    // Automatic TTL depends on the plan limits
    await resolveTtl($)
    await tick($)
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      await resolveTtl($)
      // The request's effort is known before it is sent: show it now, not when the answer ends
      if (e.effort !== undefined) {
        state.effort = String(e.effort)
        state.model = await $.session.model()
        $.ui.invalidate('ui.render')
        await saveEffort($, state.effort)
      }
    }
    const ttlForRequest = state.ttl
    // Pass every chunk on unchanged, noting when the model starts producing output
    const stream = next(e)
    let firstOutputAt: number | undefined
    for await (const chunk of stream) {
      if (firstOutputAt === undefined && chunk.kind !== 'engine' && chunk.kind !== 'stop') firstOutputAt = await $.clock.now()
      yield chunk
    }
    const result = await stream.result
    if (e.agentId === undefined) {
      const endedAt = await $.clock.now()
      const outputTokens = result.usage?.output_tokens
      // Generation speed: output tokens (thinking included) over the time they streamed in
      if (firstOutputAt !== undefined && outputTokens && endedAt - firstOutputAt >= 100) {
        state.speed = outputTokens / ((endedAt - firstOutputAt) / 1000)
      }
      state.lastResponseAt = await $.clock.now()
      state.requestTtl = ttlForRequest
      state.model = await $.session.model()
      await tick($)
    }
    return result
  })

  // settings.json edited by hand or by another session
  on('classic.ConfigChange', async ($, e, next) => {
    await resolveTtl($)
    $.ui.invalidate('ui.render')
    return next(e)
  }).catch(($, e, next) => next(e))

  // Sounds never hold up the event: they play in the background
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && e.reason === 'answer') void playCompleteSound($, sounds, e.durationMs)
    return next(e)
  })

  // Every question that waits for an answer: Claude's own questions, permission dialogs, MCP input requests
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    void playQuestionSound($, sounds)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('classic.PermissionRequest', async ($, e, next) => {
    void playQuestionSound($, sounds)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('classic.Elicitation', async ($, e, next) => {
    void playQuestionSound($, sounds)
    return next(e)
  }).catch(($, e, next) => next(e))

  // Where the built-in guard (managed machines, Team and Enterprise plans) keeps user mods off
  // PermissionRequest, the notice Claude Code raises 6 s into a waiting prompt still reaches the mod.
  // The wider window keeps it silent when PermissionRequest already played for the same prompt
  on('classic.Notification', async ($, e, next) => {
    if (QUESTION_NOTIFICATIONS.has(e.notification_type)) void playQuestionSound($, sounds, NOTIFICATION_WINDOW_MS)
    return next(e)
  }).catch(($, e, next) => next(e))

  // /clear starts a new conversation, so the previous cache prefix is no longer reused
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') state.lastResponseAt = undefined
    return next(e)
  })

  // Drawn in the band above the prompt: unlike $.ui.status it takes colors and carries no plugin label
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    return draw($, e)
  })
}
