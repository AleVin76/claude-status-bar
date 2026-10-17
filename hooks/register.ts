import type { Color, EngineInterface, Register, RenderInput, RenderElement, SessionRateLimit, SessionUsage } from 'claude-code'

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
    const { exitCode, stdout } = await $.process.run(['defaults', 'read', '-g', 'AppleLocale'], { timeoutMs: 5_000 })
    if (exitCode === 0) return intlFormatter(posixToBcp47(stdout.trim()))
  } catch {
    // Not macOS
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

function segments(): Segment[] {
  const list = [cacheSegment()]
  const { usage, model, effort } = state

  if (usage) {
    const context = contextPercent(usage.context)
    list.push({ icon: '🧠', percent: context, text: pct(context) })
    const fiveHour = limitSegment('🕒', usage.rateLimits.find(l => l.kind === 'five_hour'))
    const weekly = limitSegment('📅', usage.rateLimits.find(l => l.kind === 'seven_day'))
    if (fiveHour) list.push(fiveHour)
    if (weekly) list.push(weekly)
  }
  if (model) {
    // A numeric effort has no named level: shown in the default color
    const style = effort ? EFFORT_STYLE[effort] : undefined
    list.push({ icon: '🤖', text: model, ...(effort ? { accent: { text: effort, ...style } } : {}) })
  }
  if (usage?.cost) list.push({ icon: '💲', text: usage.cost.usd.toFixed(2) })
  return list
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

  const isLocked = state.ttlSource === 'force' || state.ttlSource === 'env'
  // Last in the row, right before the engine's own [-] collapse mark
  const ttlControl = isLocked
    ? Text({ dimColor: true, children: [`🔒 ${state.ttl}`] })
    : Button({ key: 'ttl', label: `⇄ ${state.ttl}`, plain: true, onPress: () => void switchTtl($) })

  // Full band width with the segments growing into the free space, so the switch sits at the right edge
  return Box({
    key: 'statusbar-row',
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    columnGap: 1,
    children: [
      Box({ flexGrow: 1, flexShrink: 1, children: [Text({ wrap: 'truncate-end', children })] }),
      Box({ key: 'ttl-switch', flexShrink: 0, children: [ttlControl] }),
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

  on('session.start', async ($, e, next) => {
    // An explicit locale wins; otherwise the OS regional settings, resolved once per session
    if (locale === '') state.dates = await systemFormatter($)
    state.usage = await $.session.usage()
    state.model = await $.session.model()
    await resolveTtl($)
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
    if (e.agentId === undefined) await resolveTtl($)
    const ttlForRequest = state.ttl
    const result = yield* next(e)
    if (e.agentId === undefined) {
      state.lastResponseAt = await $.clock.now()
      state.requestTtl = ttlForRequest
      state.model = await $.session.model()
      if (e.effort !== undefined) state.effort = String(e.effort)
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
