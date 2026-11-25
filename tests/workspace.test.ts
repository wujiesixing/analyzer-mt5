import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope, nextTick } from 'vue'
import type { StorageAdapter, Trade } from '../src/types/trading.ts'
import { createTradeWorkspace } from '../src/composables/useTradeWorkspace.ts'

function setup() {
  const values = new Map<string, string>(),
    scope = effectScope()
  const storage: StorageAdapter = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  }
  const workspace = scope.run(() =>
    createTradeWorkspace({ storage, confirm: () => true }),
  )
  assert.ok(workspace)
  return { workspace, scope, values, storage }
}
test('切换页面共享策略规则与筛选，交易数据变化仍可保存恢复', async () => {
  const { workspace: w, scope, values, storage } = setup()
  try {
    w.ruleType.value = 'comment'
    w.ruleName.value = '突破EA'
    w.ruleMagic.value = '区间'
    w.addRule()
    w.viewStrategy('突破EA')
    assert.equal(w.page.value, 'analysis')
    assert.ok(w.stats.value.count > 0)
    assert.ok(w.activeTrades.value.every((t) => t.strategy === '突破EA'))
    const count = w.stats.value.count
    w.navigateTo('trades')
    assert.equal(w.stats.value.count, count)
    assert.equal(w.rows.value.length, 20)
    w.filters.value.symbols = ['XAUUSD']
    await nextTick()
    assert.ok(w.tableTrades.value.every((t) => t.symbol === 'XAUUSD'))
    assert.ok(
      w.filterFacets.value.strategies.every((s) =>
        w.resolved.value.some(
          (t) => t.symbol === 'XAUUSD' && t.strategy === s,
        ),
      ),
    )
    assert.equal(w.currentPage.value, 1)
    assert.equal(
      JSON.parse(values.get('trade-lens-v1') || 'null').rules[0].name,
      '突破EA',
    )
    const restored = scope.run(() =>
      createTradeWorkspace({ storage, confirm: () => true }),
    )
    assert.ok(restored)
    assert.equal(restored.rules.value[0].name, '突破EA')
    w.clearData()
    await nextTick()
    assert.equal(w.trades.value.length, 0)
    assert.equal(
      JSON.parse(values.get('trade-lens-v1') || 'null').trades.length,
      0,
    )
  } finally {
    scope.stop()
  }
})
test('旧存档误存 50000 时从报告账本自动纠正起始资金', () => {
  const values = new Map<string, string>(),
    scope = effectScope()
  const storage: StorageAdapter = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  }
  values.set(
    'trade-lens-v1',
    JSON.stringify({
      trades: [
        {
          id: '1',
          time: '2026-03-05T12:00:00',
          symbol: 'XAUUSD',
          direction: 'buy',
          volume: 0.01,
          profit: 10,
          commission: 0,
          swap: 0,
          net: 10,
          magic: '',
          strategy: '未分配',
          comment: '',
        },
      ],
      initial: 50000,
      currency: 'USD',
      rules: [],
      account: 'MT5 #55840075',
      isDemo: false,
      sourceMode: 'positions',
      report: {
        initial: 0,
        periodStart: 0,
        balanceCurve: [
          { time: '2026-03-05T11:30:15', balance: 5500, drawdown: 0 },
        ],
        cashflows: [],
        cashflowNet: 5500,
        openPositions: [],
        openingCosts: 0,
        closedNet: 10,
        closedProfit: 10,
        closedCommission: 0,
        closedSwap: 0,
        hasMagic: false,
        strategyMatched: 0,
      },
    }),
  )
  try {
    const w = scope.run(() =>
      createTradeWorkspace({ storage, confirm: () => true }),
    )
    assert.ok(w)
    assert.equal(w.initial.value, 5500)
    assert.equal(w.report.value?.initial, 5500)
    assert.equal(JSON.parse(values.get('trade-lens-v1') || '{}').initial, 5500)
  } finally {
    scope.stop()
  }
})
test('账户账本曲线和筛选后曲线保持不同的分析口径', () => {
  const { workspace: w, scope } = setup()
  try {
    w.initial.value = 1000
    w.report.value = {
      cashflows: [],
      cashflowNet: 0,
      openPositions: [],
      openingCosts: 0,
      closedNet: 0,
      closedProfit: 0,
      closedCommission: 0,
      closedSwap: 0,
      hasMagic: false,
      strategyMatched: 0,
      initial: 1000,
      balanceCurve: [
        { time: '2026-10-01T12:00:00', balance: 1234, drawdown: 0 },
      ],
    }
    assert.equal(w.displayedBalance.value, 1234)
    w.initial.value = 2000
    // 结余展示纯净值，不再随手动起始资金平移
    assert.equal(w.displayedBalance.value, 1234)
    w.navigateTo('analysis')
    assert.equal(w.usesLedger.value, false)
    // 分析页结余同样展示账本纯净值
    assert.equal(w.displayedBalance.value, 1234)
    w.report.value = null
    assert.ok(
      Math.abs(
        w.displayedBalance.value - (w.initial.value + w.stats.value.net),
      ) < 1e-8,
    )
    w.loadDemo()
    assert.equal(w.report.value, null)
    assert.equal(w.initial.value, 50000)
  } finally {
    scope.stop()
  }
})
test('绩效分析拆分策略时同图分色、各自从起始资金累计', () => {
  const { workspace: w, scope } = setup()
  const trade = (id: string, strategy: string, time: string, net: number): Trade => ({
    id,
    time,
    symbol: 'XAUUSD',
    direction: 'buy',
    volume: 0.1,
    profit: net,
    commission: 0,
    swap: 0,
    net,
    magic: '',
    strategy,
    comment: strategy,
  })
  try {
    w.initial.value = 50000
    w.trades.value = [
      trade('1', '甲', '2026-01-02T10:00:00', 100),
      trade('2', '乙', '2026-01-03T10:00:00', -40),
    ]
    w.navigateTo('analysis')
    w.filters.value = { ...w.filters.value, strategies: ['甲', '乙'] }
    w.splitStrategies.value = true
    w.drawdown.value = false
    w.performanceMode.value = 'balance'
    const linesOf = (series: unknown) => {
      assert.ok(Array.isArray(series))
      return series as {
        name?: string
        data?: number[]
        lineStyle?: { color?: string }
      }[]
    }
    const balance = linesOf(w.balanceOption.value.series)
    assert.deepEqual(
      balance.map((s) => s.name),
      ['甲', '乙'],
    )
    assert.notEqual(balance[0].lineStyle?.color, balance[1].lineStyle?.color)
    assert.deepEqual(balance[0].data, [50100, 50100])
    assert.deepEqual(balance[1].data, [50000, 49960])
    w.performanceMode.value = 'growth'
    const growth = linesOf(w.balanceOption.value.series)
    assert.deepEqual(growth[0].data, [0.2, 0.2])
    assert.deepEqual(growth[1].data, [0, -0.08])
    w.drawdown.value = true
    const drawdown = linesOf(w.balanceOption.value.series)
    assert.deepEqual(drawdown[0].data, [0, 0])
    assert.deepEqual(drawdown[1].data, [0, -40])
    assert.deepEqual(w.analysisDateSpan.value, {
      min: '2026-01-02',
      max: '2026-01-03',
    })
    w.filters.value = { ...w.filters.value, from: '2026-01-03', to: '2026-01-03' }
    assert.equal(w.stats.value.count, 1)
    assert.equal(w.activeTrades.value[0]?.strategy, '乙')
    assert.deepEqual(w.analysisDateSpan.value, {
      min: '2026-01-02',
      max: '2026-01-03',
    })
  } finally {
    scope.stop()
  }
})
