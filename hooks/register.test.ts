import type { On, SessionMeasureInput } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const measure: SessionMeasureInput = {
  context: { window: 200_000, tokens: 170_000, percent: 85 },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 5, resetsAt: '2026-10-14T09:00:00Z' },
    { kind: 'seven_day', percentUsed: 60, resetsAt: '2026-10-20T09:00:00Z' },
  ],
  cost: { usd: 1.234 },
  changed: ['context', 'rateLimits', 'cost'],
}

const SETTINGS_PATH = '/home/u/.claude/settings.json'

type World = { env?: Record<string, string>; files?: Record<string, string> }

// Answers the nouns the mod reads beneath it: clock, env, settings and an in-memory file system
function world(on: On, { env = {}, files = {} }: World = {}): Record<string, string> {
  mock.clock(on)
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
    expect(texts).toContain('85.00%')
    expect(texts).toContain('💲 1.23')
    expect(texts).not.toContain('$')
  })
}

for (const [locale, weekly] of [
  ['it-IT', /📅 .* 60\.00% \(\d{2}\/\d{2}, \d{2}:\d{2}\)/],
  ['en-US', /📅 .* 60\.00% \(\d{2}\/\d{2}, \d{2}:\d{2}\s?[AP]M\)/],
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
  expect(texts).toMatch(/🕒 .* 5\.00% \(\d{2}:\d{2}\)/)
  expect(texts).toMatch(/📅 .* 60\.00% \(\d{2}\.\d{2} \d{2}:\d{2}\)/)
})

test('automatic TTL is 1h on a subscription within its limits', async ($, on) => {
  world(on)
  await $.session.measure(measure)

  const ui = await $.ui.mount({ plugin: 'statusbar', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
  expect((await ui.find({ type: 'Button', key: 'ttl' }))?.props.label).toBe('⇄ 1h')
})

test('the switch writes promptCacheTtl and keeps the other settings', async ($, on) => {
  const files = world(on, { files: { [SETTINGS_PATH]: JSON.stringify({ theme: 'dark', promptCacheTtl: '1h' }) } })
  await $.session.measure(measure)

  const ui = await $.ui.mount({ plugin: 'statusbar', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
  await ui.press({ key: 'ttl' })

  expect(JSON.parse(files[SETTINGS_PATH] ?? '{}')).toEqual({ theme: 'dark', promptCacheTtl: '5m' })
  expect((await ui.find({ type: 'Button', key: 'ttl' }))?.props.label).toBe('⇄ 5m')

  await ui.press({ key: 'ttl' })
  expect(JSON.parse(files[SETTINGS_PATH] ?? '{}').promptCacheTtl).toBe('1h')
})

test('an invalid settings.json is left untouched', async ($, on) => {
  const files = world(on, { files: { [SETTINGS_PATH]: '{ broken' } })
  await $.session.measure(measure)

  const ui = await $.ui.mount({ plugin: 'statusbar', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
  await ui.press({ key: 'ttl' })
  expect(files[SETTINGS_PATH]).toBe('{ broken')
})

for (const [variable, value, shown] of [
  ['CLAUDE_CODE_PROMPT_CACHE_TTL', '5m', '🔒 5m'],
  ['FORCE_PROMPT_CACHING_5M', '1', '🔒 5m'],
] as const) {
  test(`${variable} locks the switch`, async ($, on) => {
    world(on, { env: { [variable]: value } })
    await $.session.measure(measure)

    const ui = await $.ui.mount({ plugin: 'statusbar', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
    expect(await ui.find({ type: 'Button', key: 'ttl' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: shown })).toBeDefined()
  })
}
