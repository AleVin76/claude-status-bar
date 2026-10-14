import { expect, mock, test } from 'claude-code/testing'

test('status line shows limits, model and API-equivalent cost', async ($, on) => {
  mock.clock(on)
  let line: string | undefined
  on('ui.status', async (_$, e) => {
    line = e.text
    return { value: undefined }
  })

  on('session.measure', async (_$, e) => ({ changed: e.changed }))

  await $.session.measure({
    context: { window: 200_000, tokens: 12_000, percent: 6 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 5, resetsAt: '2026-10-14T09:00:00Z' },
      { kind: 'seven_day', percentUsed: 1, resetsAt: '2026-10-20T09:00:00Z' },
    ],
    cost: { usd: 1.234 },
    changed: ['context', 'rateLimits', 'cost'],
  })

  expect(line).toMatch(/^⏳ ░{10} --:-- \| 🧠 █░{9} 6\.00%/)
  expect(line).toContain('🕒 █░░░░░░░░░ 5.00% (')
  expect(line).toContain('📅 ░░░░░░░░░░ 1.00% (20/10)')
  expect(line).toMatch(/💲 \$1\.23$/)
})
