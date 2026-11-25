import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSavedWorkspace } from '../src/lib/workspaceValidation.ts'
import { demoTrades } from '../src/lib/analytics.ts'
import { parseRows } from '../src/lib/importer.ts'
const saved = () => ({
  trades: demoTrades().slice(0, 2),
  initial: 1000,
  currency: 'USD',
  rules: [{ name: '测试EA', magic: 'EA_', type: 'comment' }],
  account: '测试账户',
  isDemo: true,
  sourceMode: 'positions',
  report: null,
})
test('旧版本无报告备份仍可恢复，策略和交易字段保持类型', () => {
  const input = saved()
  const { report, ...legacy } = input
  const result = parseSavedWorkspace(legacy)
  assert.ok(result)
  assert.equal(result.report, null)
  assert.equal(result.rules[0].type, 'comment')
  assert.equal(result.trades.length, 2)
})
test('拒绝错误交易、账户参数和策略规则，不把未知JSON直接断言为模型', () => {
  assert.equal(parseSavedWorkspace(null), null)
  assert.equal(parseSavedWorkspace({ ...saved(), initial: '1000' }), null)
  assert.equal(parseSavedWorkspace({ ...saved(), currency: 'invalid' }), null)
  assert.equal(
    parseSavedWorkspace({
      ...saved(),
      trades: [{ ...saved().trades[0], net: '50' }],
    }),
    null,
  )
  assert.equal(
    parseSavedWorkspace({
      ...saved(),
      rules: [{ name: 'EA', magic: 'EA_', type: 'unsupported' }],
    }),
    null,
  )
})
test('验证嵌套报告数组，防止恢复后余额或未平仓组件崩溃', () => {
  const { report } = parseRows([
    ['时间', '品种', '类型', '利润'],
    ['2026.10.01', 'XAUUSD', 'buy', 50],
  ])
  const result = parseSavedWorkspace({ ...saved(), report })
  assert.ok(result)
  assert.equal(
    parseSavedWorkspace({
      ...saved(),
      report: { ...report, openPositions: null },
    }),
    null,
  )
  assert.equal(
    parseSavedWorkspace({
      ...saved(),
      report: {
        ...report,
        balanceCurve: [{ time: 'bad', balance: 'oops', drawdown: 0 }],
      },
    }),
    null,
  )
})
