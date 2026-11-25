import test from 'node:test'
import assert from 'node:assert/strict'
import {
  computeTimeWeightedReturn,
  equitySeriesFromBalanceCurve,
  equitySeriesFromTrades,
  monthlyTwrMatrix,
  formatNum,
} from '../src/lib/twr.ts'

test('带多次出入金的 TWR 示例：打印每期 R_i、指数与总收益', () => {
  // 期初 10000；中途入金 2000、出金 1000；交易盈亏穿插其中
  const observations = [
    { timestamp: '2024-01-01', equity: 10000, cashFlow: 10000 }, // 初始入金
    { timestamp: '2024-01-10', equity: 11000, cashFlow: 0 }, // +10% 交易
    { timestamp: '2024-01-15', equity: 13000, cashFlow: 2000 }, // 入金 2000，净值未因交易变化
    { timestamp: '2024-01-20', equity: 11700, cashFlow: 0 }, // -10% 交易
    { timestamp: '2024-01-25', equity: 10700, cashFlow: -1000 }, // 出金 1000
    { timestamp: '2024-01-31', equity: 11235, cashFlow: 0 }, // +5% 交易
  ]

  const result = computeTimeWeightedReturn(observations)

  console.log('\n=== TWR 示例（剔除出入金）===')
  for (const p of result.periods) {
    console.log(
      `${p.timestamp}  equity=${p.equity.toFixed(2)}  cf=${p.cashFlow.toFixed(2)}  R_i=${(p.periodReturn * 100).toFixed(4)}%  index=${p.index.toFixed(6)}`,
    )
  }
  console.log(
    `Total Return = ${(result.totalReturn * 100).toFixed(4)}%  (index_final=${result.periods.at(-1)?.index.toFixed(6)})\n`,
  )

  // 首期入金：R=0
  assert.equal(result.periods[0].periodReturn, 0)
  assert.equal(result.periods[0].index, 1)
  // 第二期：纯交易 +10%
  assert.ok(Math.abs(result.periods[1].periodReturn - 0.1) < 1e-9)
  // 入金期：利润 0，R=0
  assert.ok(Math.abs(result.periods[2].periodReturn) < 1e-9)
  // 出金期：利润 0，R=0
  assert.ok(Math.abs(result.periods[4].periodReturn) < 1e-9)
  // 连乘：1.1 * 1 * 0.9 * 1 * 1.05 = 1.0395
  assert.ok(Math.abs(result.totalReturn - (1.1 * 0.9 * 1.05 - 1)) < 1e-9)
  assert.equal(result.curve.length, observations.length)
})

test('分母为 0 或空序列时安全降级', () => {
  assert.equal(computeTimeWeightedReturn([]).totalReturn, 0)
  const zeroBase = computeTimeWeightedReturn([
    { timestamp: 'a', equity: 0, cashFlow: 0 },
    { timestamp: 'b', equity: 0, cashFlow: 0 },
  ])
  assert.equal(zeroBase.periods[1].periodReturn, 0)
  assert.equal(zeroBase.totalReturn, 0)

  const fromZeroDeposit = computeTimeWeightedReturn([
    { timestamp: 'a', equity: 0, cashFlow: 0 },
    { timestamp: 'b', equity: 1000, cashFlow: 1000 },
  ])
  assert.equal(fromZeroDeposit.periods[1].periodReturn, 0)
  assert.equal(fromZeroDeposit.totalReturn, 0)
})

test('从余额曲线匹配出入金并计算 TWR', () => {
  const series = equitySeriesFromBalanceCurve(
    [
      { time: '2026-03-05T11:30:15', balance: 5500, drawdown: 0 },
      { time: '2026-03-05T12:00:00', balance: 5600, drawdown: 0 },
      { time: '2026-03-06T03:31:11', balance: 5450, drawdown: 0 },
    ],
    [
      { time: '2026-03-05T11:30:15', net: 5500 },
      { time: '2026-03-06T03:31:11', net: -150 },
    ],
  )
  assert.equal(series[0].cashFlow, 5500)
  assert.equal(series[1].cashFlow, 0)
  assert.equal(series[2].cashFlow, -150)

  const twr = computeTimeWeightedReturn(series)
  // 5500→5600 无出入金：+100/5500
  assert.ok(Math.abs(twr.periods[1].periodReturn - 100 / 5500) < 1e-9)
  // 5600→5450 出金 -150：利润 = 5450-5600-(-150)=0
  assert.ok(Math.abs(twr.periods[2].periodReturn) < 1e-9)
})

test('无出入金的交易序列 TWR 等于简单累计收益', () => {
  const series = equitySeriesFromTrades(
    [
      { time: '2025-01-01', net: 100 },
      { time: '2025-01-02', net: -50 },
    ],
    1000,
  )
  const twr = computeTimeWeightedReturn(series)
  // 1000 → 1100 → 1050：1.1 * (1050/1100) - 1 = 0.05
  assert.ok(Math.abs(twr.totalReturn - 0.05) < 1e-9)
})

test('formatNum 整数不补尾零', () => {
  assert.equal(formatNum(150), '150')
  assert.equal(formatNum(-2478), '-2478')
  assert.equal(formatNum(0.39), '0.39')
  assert.equal(formatNum(139.81999999999999), '139.82')
})

test('月度 TWR 矩阵按月连乘', () => {
  const matrix = monthlyTwrMatrix([
    { timestamp: '2024-01-01', equity: 10000, cashFlow: 10000 },
    { timestamp: '2024-01-31', equity: 11000, cashFlow: 0 },
    { timestamp: '2024-02-15', equity: 13000, cashFlow: 2000 },
    { timestamp: '2024-02-28', equity: 11700, cashFlow: 0 },
  ])
  assert.equal(matrix.years.length, 1)
  assert.ok(Math.abs((matrix.years[0].months[0].value ?? 0) - 0.1) < 1e-9)
  // 2 月含入金：从 1 月末 11000 起算
  assert.ok(matrix.years[0].months[1].value !== null)
  assert.ok(Math.abs(matrix.grandTotal - (1.1 * 0.9 - 1)) < 1e-9)
})
