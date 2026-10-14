import type { SessionMeasureInput } from 'claude-code'
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

for (const surface of ['terminal', 'desktop'] as const) {
  test(`colored row above the prompt on ${surface}`, async ($, on) => {
    mock.clock(on)
    on('session.measure', async (_$, e) => ({ changed: e.changed }))
    await $.session.measure(measure)

    const ui = await $.ui.mount({
      plugin: 'statusbar',
      surface,
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 200, scroll: { offset: 0, bodyRows: 10 }, view: {} },
    })

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
    mock.clock(on)
    on('session.measure', async (_$, e) => ({ changed: e.changed }))
    await $.session.measure(measure)

    const ui = await $.ui.mount({
      plugin: 'statusbar',
      surface: 'terminal',
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 200, scroll: { offset: 0, bodyRows: 10 }, view: {} },
    })
    const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('')
    expect(texts).toMatch(weekly)
  })
}

test('Windows regional patterns drive the reset labels', async ($, on) => {
  mock.clock(on)
  mock.env(on, { OS: 'Windows_NT' })
  on('process.run', async () => ({ value: { exitCode: 0, stdout: 'dd.MM.yyyy\r\nHH:mm\r\nde-DE\r\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] } }))
  on('session.model', async () => ({ value: 'Opus 5.5' }))
  on('session.start', async (_$, e) => e)
  on('session.measure', async (_$, e) => ({ changed: e.changed }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.measure(measure)

  const ui = await $.ui.mount({
    plugin: 'statusbar',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 200, scroll: { offset: 0, bodyRows: 10 }, view: {} },
  })
  const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('')
  expect(texts).toMatch(/🕒 .* 5\.00% \(\d{2}:\d{2}\)/)
  expect(texts).toMatch(/📅 .* 60\.00% \(\d{2}\.\d{2} \d{2}:\d{2}\)/)
})
