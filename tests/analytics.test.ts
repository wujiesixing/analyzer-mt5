import test from 'node:test'
import assert from 'node:assert/strict'
import {
  metrics,
  correlation,
  simulate,
  monthlyMatrix,
  monthlyPnlHeatmap,
} from '../src/lib/analytics.ts'
const ts = [
  { time: '2025-01-01T12:00:00', net: 100, strategy: 'a' },
  { time: '2025-01-02T12:00:00', net: -200, strategy: 'a' },
  { time: '2025-01-03T12:00:00', net: 50, strategy: 'a' },
]
test('余额回撤、净盈亏与盈利因子', () => {
  const m = metrics(ts, 1000)
  assert.equal(m.net, -50)
  assert.equal(m.dd, 200)
  assert.equal(m.factor, 0.75)
  assert.equal(m.curve[2].balance, 950)
  assert.equal(m.wins, 2)
})
test('空数据和全盈利边界', () => {
  assert.equal(metrics([], 1000).sharpe, 0)
  assert.equal(metrics([], 1000).winRate, 0)
  assert.equal(metrics([ts[0]], 1000).factor, Infinity)
})
test('同向与反向日盈亏相关系数', () => {
  const result = correlation(
    [...ts, ...ts.map((t) => ({ ...t, strategy: 'b', net: -t.net }))],
    (t) => t.strategy,
  )
  const pair = result.data.find((t) => t[0] === 0 && t[1] === 1)
  assert.ok(pair)
  assert.equal(pair[2], -1)
})
test('确定性重采样余额与回撤', () => {
  const s = simulate(ts, 1000, 100, () => 0.4)
  assert.ok(s)
  assert.equal(s.median, 400)
  assert.equal(s.dd95, 600)
  assert.equal(s.lossProbability, 100)
  assert.equal(simulate([], 1000), null)
})
test('年×月收益矩阵聚合', () => {
  const matrix = monthlyMatrix([
    { time: '2025-01-15T10:00:00', net: 100 },
    { time: '2025-01-20T10:00:00', net: -30 },
    { time: '2025-03-01T10:00:00', net: 50 },
    { time: '2026-01-01T10:00:00', net: 20 },
  ])
  assert.equal(matrix.years.length, 2)
  assert.equal(matrix.years[0].months[0].value, 70)
  assert.equal(matrix.years[0].months[2].value, 50)
  assert.equal(matrix.years[0].months[1].value, null)
  assert.equal(matrix.years[0].total, 120)
  assert.equal(matrix.years[1].total, 20)
  assert.equal(matrix.grandTotal, 140)
})
test('月度盈亏热力表合并利润、TWR 与交易次数', () => {
  const heat = monthlyPnlHeatmap(
    [
      { time: '2025-01-15T10:00:00', net: 100 },
      { time: '2025-01-20T10:00:00', net: -30 },
      { time: '2025-03-01T10:00:00', net: 50 },
    ],
    {
      years: [
        {
          year: 2025,
          months: Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            value: i === 0 ? 0.1 : i === 2 ? 0.05 : null,
          })),
          total: 0.155,
        },
      ],
      grandTotal: 0.155,
    },
  )
  assert.equal(heat.years[0].months[0].profit, 70)
  assert.equal(heat.years[0].months[0].trades, 2)
  assert.equal(heat.years[0].months[0].returnRate, 0.1)
  assert.equal(heat.years[0].months[2].profit, 50)
  assert.equal(heat.grandProfit, 120)
  assert.equal(heat.grandTrades, 3)
})
