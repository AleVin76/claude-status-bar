import type { Color, EngineInterface, Register, RenderInput, RenderElement, SessionRateLimit, SessionUsage } from 'claude-code'

const BAR_WIDTH = 10
const TTL_MS = { '5m': 300_000, '1h': 3_600_000 } as const
const WARNING_FROM = 50
const ERROR_FROM = 80

type Segment = {
  icon: string
  // Fill level of the bar and the value its color is judged on (0-100); absent for plain text
  percent?: number
  text: string
}

type Snapshot = {
  ttlMs: number
  dates: DateFormatter
  // Last main-loop API response: every request restarts the prompt cache TTL
  lastResponseAt?: number
  effort?: string
  model?: string
  usage?: Omit<SessionUsage, 'startedAt'>
  now: number
}

const state: Snapshot = { ttlMs: TTL_MS['5m'], dates: intlFormatter(undefined), now: 0 }

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

function pct(value: number): string {
  return `${value.toFixed(2)}%`
}

function countdown(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
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

function limitSegment(icon: string, limit: SessionRateLimit | undefined): Segment | undefined {
  return limit && { icon, percent: limit.percentUsed, text: `${pct(limit.percentUsed)}${resetLabel(limit)}` }
}

function cacheSegment(): Segment {
  if (state.lastResponseAt === undefined) return { icon: '⏳', percent: 0, text: '--:--' }
  const left = state.lastResponseAt + state.ttlMs - state.now
  // Elapsed share drives the color: green when fresh, red close to expiry
  return left > 0
    ? { icon: '⏳', percent: 100 - (left / state.ttlMs) * 100, text: countdown(left) }
    : { icon: '⏳', percent: 100, text: 'scaduta' }
}

function segments(): Segment[] {
  const list = [cacheSegment()]
  const { usage, model, effort } = state

  if (usage) {
    const context = usage.context.percent ?? 0
    list.push({ icon: '🧠', percent: context, text: pct(context) })
    const fiveHour = limitSegment('🕒', usage.rateLimits.find(l => l.kind === 'five_hour'))
    const weekly = limitSegment('📅', usage.rateLimits.find(l => l.kind === 'seven_day'))
    if (fiveHour) list.push(fiveHour)
    if (weekly) list.push(weekly)
  }
  if (model) list.push({ icon: '🤖', text: `${model}${effort ? ` ${effort}` : ''}` })
  if (usage?.cost) list.push({ icon: '💲', text: usage.cost.usd.toFixed(2) })
  return list
}

function draw($: EngineInterface, e: RenderInput): RenderElement {
  const { Box, Text } = $.ui.resolve(e)
  const children: RenderElement[] = []

  segments().forEach((segment, i) => {
    if (i > 0) children.push(Text({ dimColor: true, children: [' | '] }))
    if (segment.percent === undefined) {
      children.push(Text({ children: [`${segment.icon} ${segment.text}`] }))
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

  return Box({ flexDirection: 'row', children: [Text({ wrap: 'truncate-end', children })] })
}

async function tick($: EngineInterface): Promise<void> {
  state.now = await $.clock.now()
  $.ui.invalidate('ui.render')
}

export const register: Register = (on, options) => {
  state.ttlMs = options.cacheTtl === '1h' ? TTL_MS['1h'] : TTL_MS['5m']
  const locale = typeof options.locale === 'string' ? options.locale.trim() : ''
  if (locale !== '') state.dates = intlFormatter(locale)

  on('session.start', async ($, e, next) => {
    // An explicit locale wins; otherwise the OS regional settings, resolved once per session
    if (locale === '') state.dates = await systemFormatter($)
    state.usage = await $.session.usage()
    state.model = await $.session.model()
    await tick($)
    // 1 s tick drives the cache countdown; the other figures arrive via session.measure
    $.clock.every(1000, () => void tick($))
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    state.usage = { context: e.context, rateLimits: e.rateLimits, cost: e.cost }
    await tick($)
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    if (e.agentId === undefined) {
      state.lastResponseAt = await $.clock.now()
      state.model = await $.session.model()
      if (e.effort !== undefined) state.effort = String(e.effort)
      await tick($)
    }
    return result
  })

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
