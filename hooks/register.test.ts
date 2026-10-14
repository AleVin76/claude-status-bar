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
    expect(texts).toContain('(20/10)')
    expect(texts).toContain('💲 $1.23')
  })
}
