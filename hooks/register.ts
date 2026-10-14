import type { EngineInterface, Register, SessionRateLimit, SessionUsage } from 'claude-code'

const BAR_WIDTH = 10
const TTL_MS = { '5m': 300_000, '1h': 3_600_000 } as const

type Snapshot = {
  ttlMs: number
  // Last main-loop API response: every request restarts the prompt cache TTL
  lastResponseAt?: number
  effort?: string
  model?: string
  usage?: Omit<SessionUsage, 'startedAt'>
}

const state: Snapshot = { ttlMs: TTL_MS['5m'] }

function bar(percent: number): string {
  const filled = Math.max(0, Math.min(BAR_WIDTH, Math.round((percent / 100) * BAR_WIDTH)))
  return '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled)
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

function limitSegment(icon: string, limit: SessionRateLimit | undefined): string | undefined {
  return limit && `${icon} ${bar(limit.percentUsed)} ${pct(limit.percentUsed)}${resetLabel(limit)}`
}

function cacheSegment(now: number): string {
  if (state.lastResponseAt === undefined) return `⏳ ${bar(0)} --:--`
  const left = state.lastResponseAt + state.ttlMs - now
  return left > 0 ? `⏳ ${bar((left / state.ttlMs) * 100)} ${countdown(left)}` : `⏳ ${bar(0)} scaduta`
}

async function refresh($: EngineInterface): Promise<void> {
  const segments = [cacheSegment(await $.clock.now())]
  const { usage, model, effort } = state

  if (usage) {
    const context = usage.context.percent ?? 0
    segments.push(`🧠 ${bar(context)} ${pct(context)}`)
    const fiveHour = limitSegment('🕒', usage.rateLimits.find(l => l.kind === 'five_hour'))
    const weekly = limitSegment('📅', usage.rateLimits.find(l => l.kind === 'seven_day'))
    if (fiveHour) segments.push(fiveHour)
    if (weekly) segments.push(weekly)
  }
  if (model) segments.push(`🤖 ${model}${effort ? ` ${effort}` : ''}`)
  if (usage?.cost) segments.push(`💲 $${usage.cost.usd.toFixed(2)}`)

  $.ui.status(segments.join(' | '))
}

export const register: Register = (on, options) => {
  state.ttlMs = options.cacheTtl === '1h' ? TTL_MS['1h'] : TTL_MS['5m']

  on('session.start', async ($, e, next) => {
    state.usage = await $.session.usage()
    state.model = await $.session.model()
    await refresh($)
    // 1 s tick drives the cache countdown; the other figures arrive via session.measure
    $.clock.every(1000, () => void refresh($))
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    state.usage = { context: e.context, rateLimits: e.rateLimits, cost: e.cost }
    await refresh($)
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    if (e.agentId === undefined) {
      state.lastResponseAt = await $.clock.now()
      state.model = await $.session.model()
      if (e.effort !== undefined) state.effort = String(e.effort)
      await refresh($)
    }
    return result
  })

  // /clear starts a new conversation, so the previous cache prefix is no longer reused
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') state.lastResponseAt = undefined
    return next(e)
  })
}
