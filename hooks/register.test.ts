import type { On, SessionMeasureInput } from 'claude-code'
import { expect, mock, test, type Engine } from 'claude-code/testing'

const measure: SessionMeasureInput = {
  context: { window: 200_000, tokens: 170_123, percent: 85 },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 5, resetsAt: '2026-10-14T09:00:00Z' },
    { kind: 'seven_day', percentUsed: 60, resetsAt: '2026-10-20T09:00:00Z' },
  ],
  cost: { usd: 1.234 },
  changed: ['context', 'rateLimits', 'cost'],
}

const SETTINGS_PATH = '/home/u/.claude/settings.json'

type World = { env?: Record<string, string>; files?: Record<string, string>; now?: number }

// Answers the nouns the mod reads beneath it: clock, env, settings and an in-memory file system
function world(on: On, { env = {}, files = {}, now }: World = {}): Record<string, string> {
  mock.clock(on, now === undefined ? undefined : { now })
  mock.env(on, { HOME: '/home/u', ...env })
  on('settings.read', async () => {
    try {
      return { value: JSON.parse(files[SETTINGS_PATH] ?? '{}') as Record<string, unknown> }
    } catch {
      return { value: {} }
    }
  })
  on('fs.exists', async (_$, e) => ({ value: e.path in files }))
  on('fs.read', async (_$, e) => {
    const text = files[e.path]
    return text === undefined ? { deny: 'ENOENT' } : { value: text }
  })
  on('fs.write', async (_$, e) => {
    files[e.path] = e.text
    return { value: undefined }
  })
  on('session.measure', async (_$, e) => ({ changed: e.changed }))
  return files
}

const bandProps = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 200,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`colored row above the prompt on ${surface}`, async ($, on) => {
    world(on)
    await $.session.measure(measure)

    const ui = await $.ui.mount({ plugin: 'statusbar', surface, component: 'AbovePrompt', props: bandProps })

    const bars = await ui.findAll({ type: 'Text', text: /^[█░]{10}$/ })
    expect(bars.map(b => b.props.color)).toEqual(['success', 'error', 'success', 'warning'])

    const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('')
    expect(texts).not.toContain('statusbar')
    expect(texts).toContain('\u200785.06%')
    expect(texts).toContain('💲 1.23')
    expect(texts).not.toContain('$')
  })
}

for (const [locale, weekly] of [
  ['it-IT', /📅 .* \u200760% \(\d{2}\/\d{2}, \d{2}:\d{2}\)/],
  ['en-US', /📅 .* \u200760% \(\d{2}\/\d{2}, \d{2}:\d{2}\s?[AP]M\)/],
] as const) {
  test(`weekly reset shows date and time in ${locale}`, { options: { locale } }, async ($, on) => {
    world(on)
    await $.session.measure(measure)

    const ui = await $.ui.mount({ plugin: 'statusbar', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
    const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('')
    expect(texts).toMatch(weekly)
  })
}

test('Windows regional patterns drive the reset labels', async ($, on) => {
  world(on, { env: { OS: 'Windows_NT' } })
  on('process.run', async () => ({
    value: { exitCode: 0, stdout: 'dd.MM.yyyy\r\nHH:mm\r\nde-DE\r\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] } }))
  on('session.model', async () => ({ value: 'Opus 5.5' }))
  on('session.start', async (_$, e) => e)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.measure(measure)

  const ui = await $.ui.mount({ plugin: 'statusbar', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
  const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('')
  expect(texts).toMatch(/🕒 .* \u2007\u20075% \(\d{2}:\d{2}\)/)
  expect(texts).toMatch(/📅 .* \u200760% \(\d{2}\.\d{2} \d{2}:\d{2}\)/)
})

test('automatic TTL is 1h on a subscription within its limits', async ($, on) => {
  world(on)
  await $.session.measure(measure)

  const ui = await $.ui.mount({ plugin: 'statusbar', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
  await ui.press({ key: 'menu' })
  expect((await ui.find({ type: 'Button', key: 'ttl' }))?.props.label).toBe('⇄ Cache 1h → 5m')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`the menu button is right-aligned on ${surface}`, async ($, on) => {
    world(on)
    await $.session.measure(measure)

    const ui = await $.ui.mount({ plugin: 'statusbar', surface, component: 'AbovePrompt', props: bandProps })
    const row = await ui.find({ type: 'Box', key: 'statusbar-row' })
    expect(row?.props).toMatchObject({ width: '100%', justifyContent: 'space-between', flexDirection: 'row' })
    const boxes = await ui.findAll({ type: 'Box' })
    expect(boxes.at(-1)?.key).toBe('menu-button')
    expect((await ui.find({ type: 'Button', key: 'menu' }))?.props.label).toBe('≡')
    const texts = await ui.findAll({ type: 'Text' })
    expect(texts.filter(t => t.text === '[' || t.text === ']').map(t => t.props.color)).toEqual(['suggestion', 'suggestion'])
    // The menu items stay hidden until the symbol is pressed
    expect(await ui.find({ type: 'Button', key: 'ttl' })).toBeUndefined()
  })
}

test('the cache menu item writes promptCacheTtl and keeps the other settings', async ($, on) => {
  const files = world(on, { files: { [SETTINGS_PATH]: JSON.stringify({ theme: 'dark', promptCacheTtl: '1h' }) } })
  await $.session.measure(measure)

  const ui = await $.ui.mount({ plugin: 'statusbar', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
  await ui.press({ key: 'menu' })
  await ui.press({ key: 'ttl' })

  expect(JSON.parse(files[SETTINGS_PATH] ?? '{}')).toEqual({ theme: 'dark', promptCacheTtl: '5m' })
  // A choice closes the menu
  expect(await ui.find({ type: 'Button', key: 'ttl' })).toBeUndefined()

  await ui.press({ key: 'menu' })
  expect((await ui.find({ type: 'Button', key: 'ttl' }))?.props.label).toBe('⇄ Cache 5m → 1h')
  await ui.press({ key: 'ttl' })
  expect(JSON.parse(files[SETTINGS_PATH] ?? '{}').promptCacheTtl).toBe('1h')
})

test('an invalid settings.json is left untouched', async ($, on) => {
  const files = world(on, { files: { [SETTINGS_PATH]: '{ broken' } })
  await $.session.measure(measure)

  const ui = await $.ui.mount({ plugin: 'statusbar', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
  await ui.press({ key: 'menu' })
  await ui.press({ key: 'ttl' })
  expect(files[SETTINGS_PATH]).toBe('{ broken')
})

for (const [variable, value, shown] of [
  ['CLAUDE_CODE_PROMPT_CACHE_TTL', '5m', '🔒 Cache 5m (CLAUDE_CODE_PROMPT_CACHE_TTL)'],
  ['FORCE_PROMPT_CACHING_5M', '1', '🔒 Cache 5m (FORCE_PROMPT_CACHING_5M)'],
] as const) {
  test(`${variable} locks the cache menu item`, async ($, on) => {
    world(on, { env: { [variable]: value } })
    await $.session.measure(measure)

    const ui = await $.ui.mount({ plugin: 'statusbar', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
    await ui.press({ key: 'menu' })
    expect(await ui.find({ type: 'Button', key: 'ttl' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: shown })).toBeDefined()
  })
}

test('a reached limit shows the time left to its reset', async ($, on) => {
  const now = Date.parse('2026-10-17T08:00:00Z')
  world(on, { now })
  on('session.start', async (_$, e) => e)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] } }))
  on('session.model', async () => ({ value: 'Opus 5.5' }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.measure({
    ...measure,
    rateLimits: [
      // 2h 15m 30s left
      { kind: 'five_hour', percentUsed: 100, resetsAt: new Date(now + 8_130_000).toISOString() },
      // 2 days 3h 4m 5s left
      { kind: 'seven_day', percentUsed: 100.4, resetsAt: new Date(now + 2 * 86_400_000 + 11_045_000).toISOString() },
    ],
  })

  const ui = await $.ui.mount({ plugin: 'statusbar', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
  const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('')
  expect(texts).toContain('🕒 ██████████ 2:15:30')
  expect(texts).toContain('📅 ██████████ 2g 3:04:05')
  expect(texts).not.toContain('reset tra')
  expect(texts).not.toMatch(/100(\.\d+)?%/)
})

test('plan limits drop padding zeros, context keeps two decimals', async ($, on) => {
  world(on)
  await $.session.measure({
    ...measure,
    rateLimits: [
      { kind: 'five_hour', percentUsed: 23.5, resetsAt: '2026-10-14T09:00:00Z' },
      { kind: 'seven_day', percentUsed: 7, resetsAt: '2026-10-20T09:00:00Z' },
    ],
  })

  const ui = await $.ui.mount({ plugin: 'statusbar', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
  const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('')
  expect(texts).toContain('\u200785.06%')
  expect(texts).toMatch(/🕒 [█░]{10} \u200723\.5% \(/)
  expect(texts).toMatch(/📅 [█░]{10} \u2007\u20077% \(/)
})

test('percentages keep a fixed width', async ($, on) => {
  world(on)
  await $.session.measure({
    ...measure,
    context: { window: 1_000_000, tokens: 60_600, percent: 6 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 99.5, resetsAt: '2026-10-14T09:00:00Z' },
      { kind: 'seven_day', percentUsed: 0, resetsAt: '2026-10-20T09:00:00Z' },
    ],
  })

  const ui = await $.ui.mount({ plugin: 'statusbar', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
  const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('')
  expect(texts).toContain('🧠 █░░░░░░░░░ \u2007\u20076.06%')
  expect(texts).toMatch(/🕒 [█░]{10}  99\.5% \(/)
  expect(texts).toMatch(/📅 [█░]{10} \u2007\u20070% \(/)
})

for (const [effort, color, bold] of [
  ['low', 'inactive', undefined],
  ['medium', 'success', undefined],
  ['high', 'warning', undefined],
  ['xhigh', 'claude', undefined],
  ['max', 'error', true],
] as const) {
  test(`effort ${effort} is drawn in ${color}`, async ($, on) => {
    world(on)
    on('session.model', async () => ({ value: 'Opus 5.5' }))
    // Bottom of the stream: answers the request without a model
    on('turn.step', async function* (_$, e) {
      return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: null }
    })
    await $.session.measure(measure)
    const stream = $.turn.step({ turnId: 't1', index: 0, model: 'opus', effort, messageCount: 1 })
    for await (const _chunk of stream) {
      // drain
    }

    const ui = await $.ui.mount({ plugin: 'statusbar', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
    expect(await ui.find({ type: 'Text', text: '🤖 Opus 5.5' })).toBeDefined()
    // find matches by inclusion, so the row's outer Text matches too: take the exact word
    const short = effort.slice(0, 2)
    const word = (await ui.findAll({ type: 'Text', text: short })).find(t => t.text === short)
    expect((await ui.findAll({ type: 'Text' })).some(t => t.text === effort)).toBe(false)
    expect(word?.props.color).toBe(color)
    expect(word?.props.bold).toBe(bold)
  })
}

async function startSession($: Engine, on: On, sessionId = 's1'): Promise<void> {
  on('session.start', async (_$, e) => e)
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] } }))
  on('session.model', async () => ({ value: 'Opus 5.5' }))
  on('session.id', async () => ({ value: sessionId }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
}

test('the effortLevel setting is not taken as the effort in use', async ($, on) => {
  world(on, { files: { [SETTINGS_PATH]: JSON.stringify({ effortLevel: 'xhigh' }) } })
  mock.store(on)
  await startSession($, on)

  const ui = await $.ui.mount({ plugin: 'statusbar', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
  expect((await ui.findAll({ type: 'Text' })).some(t => t.text === 'xh')).toBe(false)
})

for (const [sessionId, expected] of [['s1', true], ['s2', false]] as const) {
  test(`the last reported effort is ${expected ? '' : 'not '}restored in ${sessionId === 's1' ? 'the same' : 'another'} session`, async ($, on) => {
    world(on)
    mock.store(on, { effort: { sessionId: 's1', model: 'Opus 5.5', effort: 'medium' } })
    await startSession($, on, sessionId)

    const ui = await $.ui.mount({ plugin: 'statusbar', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
    expect((await ui.findAll({ type: 'Text' })).some(t => t.text === 'me')).toBe(expected)
  })
}

test('the menu closes with Chiudi or a second press of the symbol', async ($, on) => {
  world(on)
  await $.session.measure(measure)
  const ui = await $.ui.mount({ plugin: 'statusbar', surface: 'terminal', component: 'AbovePrompt', props: bandProps })

  await ui.press({ key: 'menu' })
  expect(await ui.find({ type: 'Box', key: 'menu-items' })).toBeDefined()
  await ui.press({ key: 'menu-close' })
  expect(await ui.find({ type: 'Box', key: 'menu-items' })).toBeUndefined()

  await ui.press({ key: 'menu' })
  await ui.press({ key: 'menu' })
  expect(await ui.find({ type: 'Box', key: 'menu-items' })).toBeUndefined()
})

for (const surface of ['terminal', 'desktop'] as const) test(`the menu opens upward, one item per line, above the bar on ${surface}`, async ($, on) => {
  world(on)
  await $.session.measure(measure)
  const ui = await $.ui.mount({ plugin: 'statusbar', surface, component: 'AbovePrompt', props: bandProps })
  await ui.press({ key: 'menu' })

  const boxes = await ui.findAll({ type: 'Box' })
  const keys = boxes.map(b => b.key)
  // Document order: the menu comes before the status row, so it is drawn above it
  expect(keys.indexOf('menu-items')).toBeLessThan(keys.indexOf('statusbar-row'))
  expect((await ui.find({ type: 'Box', key: 'menu-items' }))?.props).toMatchObject({ flexDirection: 'column', alignSelf: 'flex-end', borderColor: 'suggestion' })
})

type Played = { argv: readonly string[]; env?: Record<string, string> }

// Records the player commands instead of running them
function recordPlayer(on: On): Played[] {
  const played: Played[] = []
  on('process.run', async (_$, e) => {
    played.push({ argv: e.argv, env: e.init?.env })
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return played
}

const soundFile = (p: Played): string | undefined => p.env?.CSB_SOUND ?? p.argv.at(-1)

async function flush(_$: Engine): Promise<void> {
  // Sounds play in the background: let their calls settle
  // The test environment has timers even though the hooks' typings name none
  await new Promise(resolve => (globalThis as unknown as { setTimeout: (f: () => void, ms: number) => void }).setTimeout(() => resolve(undefined), 50))
}

function quietToasts(on: On): void {
  on('ui.toast', async () => ({ value: undefined }))
}

const completed = (durationMs: number, reason: 'answer' | 'aborted' = 'answer', agentId?: string) =>
  ({ answer: 'ok', durationMs, isAborted: reason === 'aborted', turnId: 't1', reason, ...(agentId ? { agentId } : {}) }) as const

test('a long answer plays the completion sound through PowerShell on Windows', async ($, on) => {
  world(on, { env: { OS: 'Windows_NT' } })
  const played = recordPlayer(on)
  on('turn.complete', async (_$, e) => ({ text: e.answer }))

  await $.turn.complete(completed(20_000))
  await flush($)

  expect(played).toHaveLength(1)
  expect(played[0]?.argv[0]).toBe('powershell')
  expect(soundFile(played[0]!)).toMatch(/sounds\/complete\.wav$/)
})

test('short, interrupted and subagent turns play nothing', async ($, on) => {
  world(on, { env: { OS: 'Windows_NT' } })
  const played = recordPlayer(on)
  on('turn.complete', async (_$, e) => ({ text: e.answer }))

  await $.turn.complete(completed(14_000))
  await $.turn.complete(completed(60_000, 'aborted'))
  await $.turn.complete(completed(60_000, 'answer', 'agent-1'))
  await flush($)

  expect(played).toHaveLength(0)
})

test('the completion threshold and the sound file follow the options', { options: { completeMinSeconds: 0, completeSound: '/suoni/fatto.wav' } }, async ($, on) => {
  world(on, { env: { OS: 'Windows_NT' }, files: { '/suoni/fatto.wav': 'RIFF' } })
  const played = recordPlayer(on)
  on('turn.complete', async (_$, e) => ({ text: e.answer }))

  await $.turn.complete(completed(1_000))
  await flush($)
  expect(played.map(soundFile)).toEqual(['/suoni/fatto.wav'])
})

test('a missing custom file falls back to the bundled sound', { options: { completeMinSeconds: 0, completeSound: '/suoni/manca.wav' } }, async ($, on) => {
  world(on, { env: { OS: 'Windows_NT' } })
  quietToasts(on)
  const played = recordPlayer(on)
  on('turn.complete', async (_$, e) => ({ text: e.answer }))

  await $.turn.complete(completed(1_000))
  await flush($)
  expect(soundFile(played[0]!)).toMatch(/sounds\/complete\.wav$/)
})

test('questions play the question sound once per burst', async ($, on) => {
  world(on, { env: { OS: 'Windows_NT' } })
  const played = recordPlayer(on)
  on('tool.call', { tool: 'AskUserQuestion' }, async () => ({ result: { answers: {} } }))
  on('classic.PermissionRequest', async () => ({}))

  await $.tool.call({ tool: 'AskUserQuestion', questions: [] } as never)
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'ls' } })
  await flush($)
  expect(played.map(soundFile)).toHaveLength(1)
  expect(soundFile(played[0]!)).toMatch(/sounds\/question\.wav$/)
})

test('disabled sounds stay silent', { options: { soundOnComplete: false, soundOnQuestion: false, completeMinSeconds: 0 } }, async ($, on) => {
  world(on, { env: { OS: 'Windows_NT' } })
  const played = recordPlayer(on)
  on('turn.complete', async (_$, e) => ({ text: e.answer }))
  on('classic.PermissionRequest', async () => ({}))

  await $.turn.complete(completed(60_000))
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: {} })
  await flush($)
  expect(played).toHaveLength(0)
})

test('the menu toggles a sound through /config', async ($, on) => {
  world(on)
  const set: unknown[] = []
  on('config.set', async (_$, e) => {
    set.push({ key: e.key, value: e.value })
    return { value: e.value }
  })
  await $.session.measure(measure)
  const ui = await $.ui.mount({ plugin: 'statusbar', surface: 'terminal', component: 'AbovePrompt', props: bandProps })

  await ui.press({ key: 'menu' })
  expect((await ui.find({ type: 'Button', key: 'sound-complete' }))?.props.label).toBe('🔔 Suono completamento: on')
  await ui.press({ key: 'sound-complete' })
  expect(set).toEqual([{ key: 'statusbar.soundOnComplete', value: false }])

  await ui.press({ key: 'menu' })
  expect((await ui.find({ type: 'Button', key: 'sound-complete' }))?.props.label).toBe('🔕 Suono completamento: off')
})
