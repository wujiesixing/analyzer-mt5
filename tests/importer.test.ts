import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseRows,
  dateValue,
  resolveAnalyticsInitial,
} from '../src/lib/importer.ts'
test('MT5持仓双时间表头使用平仓时间', () => {
  const r = parseRows([
    ['持仓'],
    [
      '时间',
      '持仓',
      '品种',
      '类型',
      '交易量',
      '时间',
      '手续费',
      '库存费',
      '利润',
    ],
    [
      '2025.01.01 10:00:00',
      123,
      'EURUSD',
      'buy',
      0.1,
      '2025.01.02 12:00:00',
      -2,
      -1,
      100,
    ],
  ])
  assert.equal(r.trades[0].time, '2025-01-02T12:00:00')
  assert.equal(r.trades[0].net, 97)
})
test('同时含持仓与成交，不重复统计', () => {
  const r = parseRows([
    ['Time', 'Position', 'Symbol', 'Type', 'Profit'],
    ['2025.01.01', 1, 'XAUUSD', 'buy', 100],
    ['Time', 'Deal', 'Symbol', 'Type', 'Entry', 'Profit'],
    ['2025.01.01', 2, 'XAUUSD', 'sell', 'out', 100],
  ])
  assert.equal(r.trades.length, 1)
  assert.equal(r.dealMode, false)
})
test('有手数的开平仓成交合并为一笔，余额操作不计入', () => {
  const r = parseRows([
    ['Time', 'Deal', 'Symbol', 'Type', 'Entry', 'Volume', 'Profit'],
    ['2025.01.01', 1, 'XAUUSD', 'buy', 'in', 0.1, 0],
    ['2025.01.02', 2, 'XAUUSD', 'sell', 'out', 0.1, 50],
    ['2025.01.02', 3, '', 'balance', '', '', 1000],
  ])
  assert.equal(r.trades.length, 1)
  assert.equal(r.trades[0].direction, 'buy')
  assert.equal(r.trades[0].net, 50)
  assert.equal(r.dealMode, false)
  assert.equal(r.report.cashflows.length, 1)
})
test('只有退出成交时仍按退出记录统计', () => {
  const r = parseRows([
    ['Time', 'Deal', 'Symbol', 'Type', 'Entry', 'Volume', 'Profit'],
    ['2025.01.02', 2, 'XAUUSD', 'sell', 'out', 0.1, 50],
  ])
  assert.equal(r.dealMode, true)
  assert.equal(r.trades.length, 1)
  assert.equal(r.trades[0].direction, 'sell')
  assert.equal(r.trades[0].net, 50)
})
test('无效数值和日期被识别', () => {
  assert.throws(() =>
    parseRows([
      ['Time', 'Symbol', 'Type', 'Profit'],
      ['2025.01.01', 'XAUUSD', 'buy', 'bad'],
    ]),
  )
  assert.equal(dateValue('bad'), null)
})
test('Excel日期保持报告的本地时间', () => {
  assert.equal(
    dateValue(new Date(2025, 0, 2, 12, 30, 0)),
    '2025-01-02T12:30:00',
  )
})
test('无账本时用报告余额反推起始资金', () => {
  const r = parseRows([
    ['账户:', '1', '结余:', 1100],
    ['时间', '持仓', '品种', '类型', '利润'],
    ['2025.01.01 10:00:00', 1, 'EURUSD', 'buy', 100],
  ])
  assert.equal(r.report.balance, 1100)
  assert.equal(r.report.closedNet, 100)
  assert.equal(r.report.initial, 1000)
})
test('报告以入金开场时分析起始资金取首笔结余', () => {
  const r = parseRows([
    ['持仓'],
    ['时间', '持仓', '交易品种', '类型', '交易量', '盈利'],
    ['2026.04.27 18:01:38', 1, 'XAUUSD', 'sell', 0.01, 1.25],
    ['成交'],
    [
      '时间',
      '成交',
      '交易品种',
      '类型',
      '趋势',
      '交易量',
      '价位',
      '订单',
      '手续费',
      '费用',
      '库存费',
      '盈利',
      '结余',
    ],
    [
      '2026.04.27 13:07:02',
      1,
      '',
      'balance',
      '',
      '',
      '',
      '',
      0,
      0,
      0,
      1500,
      1500,
    ],
    [
      '2026.04.27 18:01:38',
      2,
      'XAUUSD',
      'sell',
      'in',
      0.01,
      1,
      1,
      -0.06,
      0,
      0,
      0,
      1499.94,
    ],
    [
      '2026.04.27 18:10:20',
      3,
      'XAUUSD',
      'buy',
      'out',
      0.01,
      1,
      1,
      0,
      0,
      0,
      1.25,
      1501.19,
    ],
    ['结余:', '', '', 1501.19],
  ])
  assert.equal(r.report.periodStart, 0)
  assert.equal(r.report.initial, 1500)
  assert.equal(r.report.reconciliationDifference, 0)
})
test('旧存档 initial 为 0 时仍可从账本首笔结余恢复', () => {
  const capital = resolveAnalyticsInitial({
    initial: 0,
    periodStart: 0,
    balanceCurve: [{ time: '2026-03-05T11:30:15', balance: 5500, drawdown: 0 }],
    cashflows: [
      {
        id: '1',
        orderId: '',
        time: '2026-03-05T11:30:15',
        openTime: '2026-03-05T11:30:15',
        symbol: '',
        direction: 'balance',
        volume: 0,
        profit: 5500,
        commission: 0,
        swap: 0,
        net: 5500,
        magic: '',
        strategy: '',
        comment: '',
        entry: '',
        balance: 5500,
      },
    ],
    cashflowNet: 5500,
    openPositions: [],
    openingCosts: 0,
    closedNet: 4441.39,
    closedProfit: 0,
    closedCommission: 0,
    closedSwap: 0,
    hasMagic: false,
    strategyMatched: 0,
  })
  assert.equal(capital, 5500)
})
