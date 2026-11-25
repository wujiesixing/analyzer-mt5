import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRows } from '../src/lib/importer.ts'
import { metrics } from '../src/lib/analytics.ts'
// Synthetic complete MT5 report; no account holder or private transaction data.
const rows = [
  ['交易历史报告'],
  ['账户:', '', '', '123456 (USD, Broker-Live, real, Hedge)'],
  ['日期:', '', '', '2026.10.13 16:38'],
  ['持仓'],
  [
    '时间',
    '持仓',
    '交易品种',
    '类型',
    '交易量',
    '价位',
    '止损',
    '止盈',
    '时间',
    '价位',
    '手续费',
    '库存费',
    '盈利',
  ],
  [
    '2026.10.01 01:00:00',
    101,
    'XAUUSD',
    'buy',
    '0.01',
    4000,
    '',
    '',
    '2026.10.01 02:00:00',
    4010,
    -0.06,
    0,
    10,
  ],
  [
    '2026.10.02 01:00:00',
    102,
    'EURUSD',
    'sell',
    '0.01',
    1.1,
    '',
    '',
    '2026.10.02 02:00:00',
    1.2,
    -0.06,
    0,
    -5,
  ],
  ['订单'],
  [
    '开价时间',
    '订单',
    '交易品种',
    '类型',
    '交易量',
    '价位',
    '止损',
    '止盈',
    '时间',
    '状态',
    '',
    '注释',
  ],
  [
    '2026.10.01 01:00:00',
    101,
    'XAUUSD',
    'buy',
    '0.01 / 0.01',
    4000,
    '',
    '',
    '2026.10.01 01:00:00',
    'filled',
    '',
    'Fallback-A',
  ],
  [
    '2026.10.01 02:00:00',
    999,
    'XAUUSD',
    'buy stop',
    '1 / 0',
    4000,
    '',
    '',
    '2026.10.01 03:00:00',
    'canceled',
    '',
    'Pending',
  ],
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
    '注释',
  ],
  [
    '2026.10.01 01:00:00',
    201,
    'XAUUSD',
    'buy',
    'in',
    0.01,
    4000,
    101,
    -0.06,
    0,
    0,
    0,
    999.94,
    'EA-Gold',
  ],
  [
    '2026.10.01 02:00:00',
    202,
    'XAUUSD',
    'sell',
    'out',
    0.01,
    4010,
    900,
    0,
    0,
    0,
    10,
    1009.94,
    '[tp 4010]',
  ],
  [
    '2026.10.02 01:00:00',
    203,
    'EURUSD',
    'sell',
    'in',
    0.01,
    1.1,
    102,
    -0.06,
    0,
    0,
    0,
    1009.88,
    'EA-FX',
  ],
  [
    '2026.10.02 02:00:00',
    204,
    'EURUSD',
    'buy',
    'out',
    0.01,
    1.2,
    901,
    0,
    0,
    0,
    -5,
    1004.88,
    '[sl 1.2]',
  ],
  [
    '2026.10.03 00:00:00',
    205,
    '',
    'balance',
    '',
    '',
    '',
    '',
    0,
    0,
    0,
    3,
    1007.88,
    'adjustment',
  ],
  [
    '2026.10.03 01:00:00',
    206,
    'BTCUSD',
    'buy',
    'in',
    0.02,
    80000,
    103,
    -0.12,
    0,
    0,
    0,
    1007.76,
    'EA-BTC',
  ],
  ['持仓'],
  [
    '时间',
    '持仓',
    '交易品种',
    '类型',
    '交易量',
    '价位',
    '止损',
    '止盈',
    '市场价位',
    '库存费',
    '',
    '盈利',
    '注释',
  ],
  [
    '2026.10.03 01:00:00',
    103,
    'BTCUSD',
    'buy',
    0.02,
    80000,
    '',
    '',
    80100,
    0,
    '',
    2,
    'EA-BTC',
  ],
  ['工作订单'],
  [
    '开价时间',
    '订单',
    '交易品种',
    '类型',
    '交易量',
    '价位',
    '止损',
    '止盈',
    '市场价位',
    '状态',
    '',
    '注释',
  ],
  [
    '2026.10.03 02:00:00',
    9999,
    'XAUUSD',
    'buy stop',
    '0.01 / 0',
    4100,
    '',
    '',
    4000,
    'placed',
    '',
    'Pending',
  ],
  ['结余:', '', '', 1007.76],
  ['净值:', '', '', 1009.76],
  ['浮动 P/L:', '', '', 2],
  ['结果'],
  ['总净盈利:', '', '', 4.76],
  ['交易总计:', '', '', 2],
]
test('完整中文报告：分离持仓、订单、成交、未平仓和结果', () => {
  const r = parseRows(rows)
  assert.equal(r.trades.length, 2)
  assert.equal(r.dealMode, false)
  assert.equal(r.skipped, 0)
  assert.equal(r.report.openPositions.length, 1)
  assert.equal(r.report.cashflows.length, 1)
  assert.equal(r.report.count, 2)
  assert.equal(r.report.hasMagic, false)
  assert.equal(r.trades[0].magic, '')
})
test('通过持仓号关联开仓成交备注，保留真实持仓方向与价位', () => {
  const r = parseRows(rows)
  assert.equal(r.trades[0].strategy, 'EA-Gold')
  assert.equal(r.trades[1].strategy, 'EA-FX')
  assert.equal(r.trades[0].direction, 'buy')
  assert.equal(r.trades[0].openPrice, 4000)
  assert.equal(r.trades[0].closePrice, 4010)
  assert.equal(r.trades[0].durationMinutes, 60)
  assert.equal(r.report.strategyMatched, 2)
})
test('起始余额与结余核对，未平仓费用与余额调整不重复计入已平仓利润', () => {
  const r = parseRows(rows),
    m = metrics(r.trades, r.report.initial)
  assert.equal(r.report.initial, 1000)
  assert.equal(r.report.balance, 1007.76)
  assert.equal(r.report.equity, 1009.76)
  assert.equal(r.report.cashflowNet, 3)
  assert.equal(r.report.closedNet, 4.88)
  assert.equal(r.report.openingCosts, -0.12)
  assert.equal(r.report.net, 4.76)
  assert.equal(r.report.ledgerChange, 7.76)
  assert.equal(r.report.reconciliationDifference, 0)
  assert.ok(Math.abs(m.net - 4.88) < 1e-9)
  assert.equal(m.count, 2)
  assert.equal(r.report.balanceCurve?.at(-1)?.balance, 1007.76)
  assert.equal(r.report.accountId, '123456')
  assert.equal(r.report.currency, 'USD')
})
test('没有开仓成交时可使用已成交订单备注', () => {
  const reduced = rows.slice(0, 11)
  const r = parseRows(reduced)
  assert.equal(r.trades[0].strategy, 'Fallback-A')
  assert.equal(r.trades[1].strategy, '未分配')
})
test('仅未平仓报告不能当成已平仓交易导入', () => {
  assert.throws(() => parseRows(rows.slice(20, 24)), /未找到已平仓交易/)
})
test('中文趋势列把开平仓成交还原为持仓，并排除资金调整', () => {
  const r = parseRows(rows.slice(11, 20))
  assert.equal(r.dealMode, false)
  assert.equal(r.trades.length, 2)
  assert.equal(r.trades[0].direction, 'buy')
  assert.equal(r.trades[0].strategy, 'EA-Gold')
  assert.equal(r.trades[0].net, 9.94)
  assert.equal(r.trades[0].openPrice, 4000)
  assert.equal(r.trades[0].closePrice, 4010)
  assert.equal(r.trades[1].direction, 'sell')
  assert.equal(r.trades[1].strategy, 'EA-FX')
  assert.equal(r.trades[1].net, -5.06)
  assert.equal(r.report.closedNet, 4.88)
  assert.equal(r.report.openPositions.length, 1)
  assert.equal(r.report.openPositions[0].openingCost, -0.12)
  assert.equal(r.report.cashflows.length, 1)
})
test('策略测试报告按开仓成交还原方向、备注和手续费', () => {
  const r = parseRows([
    ['策略测试报告'],
    ['专家:', '', '', 'Breakout'],
    ['货币:', '', '', 'USD'],
    ['初始入金:', '', '', 100000],
    ['期间:', '', '', 'H1 (2026.01.01 - 2026.01.03)'],
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
      '库存费',
      '盈利',
      '结余',
      '注释',
    ],
    [
      '2026.01.02 10:28:52',
      8,
      'D30EUR',
      'buy',
      'out',
      0.06,
      24635.9,
      13,
      0,
      0,
      -96.73,
      99902.91,
      'sl 24635.2',
    ],
    [
      '2026.01.01 00:00:00',
      1,
      '',
      'balance',
      '',
      '',
      '',
      '',
      0,
      0,
      100000,
      100000,
      '',
    ],
    [
      '2026.01.02 10:01:44',
      7,
      'D30EUR',
      'sell',
      'in',
      0.06,
      24498.4,
      12,
      -0.36,
      0,
      0,
      99999.64,
      'DE40_E_FIXED',
    ],
  ])
  assert.equal(r.dealMode, false)
  assert.equal(r.trades.length, 1)
  assert.equal(r.trades[0].direction, 'sell')
  assert.equal(r.trades[0].strategy, 'DE40_E_FIXED')
  assert.equal(r.trades[0].id, '12')
  assert.equal(r.trades[0].net, -97.09)
  assert.equal(r.trades[0].openTime, '2026-01-02T10:01:44')
  assert.equal(r.trades[0].time, '2026-01-02T10:28:52')
  assert.equal(r.trades[0].openPrice, 24498.4)
  assert.equal(r.trades[0].closePrice, 24635.9)
  assert.equal(r.report.currency, 'USD')
  assert.equal(r.report.expert, 'Breakout')
  assert.equal(r.report.initial, 100000)
  assert.equal(r.report.date, 'H1 (2026.01.01 - 2026.01.03)')
  assert.equal(r.report.closedNet, -97.09)
})
test('同一持仓的多次部分平仓合并，一笔平仓可拆给多笔开仓', () => {
  const header = [
    '时间',
    '交易品种',
    '类型',
    '趋势',
    '交易量',
    '盈利',
    '手续费',
    '注释',
  ]
  const partial = parseRows([
    header,
    ['2026.01.02 10:00:00', 'XAUUSD', 'buy', 'in', 1, 0, -1, 'EA'],
    ['2026.01.02 11:00:00', 'XAUUSD', 'sell', 'out', 0.4, 10, 0, 'sl'],
    ['2026.01.02 12:00:00', 'XAUUSD', 'sell', 'out', 0.6, 20, 0, 'tp'],
  ])
  assert.equal(partial.trades.length, 1)
  assert.equal(partial.trades[0].volume, 1)
  assert.equal(partial.trades[0].direction, 'buy')
  assert.equal(partial.trades[0].strategy, 'EA')
  assert.equal(partial.trades[0].profit, 30)
  assert.equal(partial.trades[0].commission, -1)
  assert.equal(partial.trades[0].net, 29)
  assert.equal(partial.trades[0].time, '2026-01-02T12:00:00')
  const split = parseRows([
    header,
    ['2026.01.02 10:00:00', 'XAUUSD', 'buy', 'in', 0.4, 0, 0, 'A'],
    ['2026.01.02 10:05:00', 'XAUUSD', 'buy', 'in', 0.6, 0, 0, 'B'],
    ['2026.01.02 11:00:00', 'XAUUSD', 'sell', 'out', 1, 100, 0, 'tp'],
  ])
  assert.equal(split.trades.length, 2)
  assert.deepEqual(
    split.trades.map((t) => [t.strategy, t.net]),
    [
      ['A', 40],
      ['B', 60],
    ],
  )
})
test('导出列结构再次导入保留开平仓时间和价位', () => {
  const r = parseRows([
    [
      '开仓时间',
      '平仓时间',
      '订单',
      '品种',
      '类型',
      '手数',
      '利润',
      '手续费',
      '开仓价',
      '平仓价',
    ],
    [
      '2026.10.01 01:00:00',
      '2026.10.01 02:00:00',
      1,
      'XAUUSD',
      'buy',
      0.01,
      10,
      -0.06,
      4000,
      4010,
    ],
  ])
  assert.equal(r.trades[0].time, '2026-10-01T02:00:00')
  assert.equal(r.trades[0].openTime, '2026-10-01T01:00:00')
  assert.equal(r.trades[0].closePrice, 4010)
})
