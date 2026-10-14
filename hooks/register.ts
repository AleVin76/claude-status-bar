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
  // Last main-loop API response: every request restarts the prompt cache TTL
  lastResponseAt?: number
  effort?: string
  model?: string
  usage?: Omit<SessionUsage, 'startedAt'>
  now: number
}

const state: Snapshot = { ttlMs: TTL_MS['5m'], now: 0 }

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

function resetLabel(limit: SessionRateLimit): string {
  if (!limit.resetsAt) return ''
  const d = new Date(limit.resetsAt)
  return limit.kind === 'five_hour'
    ? ` (${pad(d.getHours())}:${pad(d.getMinutes())})`
    : ` (${pad(d.getDate())}/${pad(d.getMonth() + 1)})`
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
  if (usage?.cost) list.push({ icon: '💲', text: `$${usage.cost.usd.toFixed(2)}` })
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

  on('session.start', async ($, e, next) => {
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
