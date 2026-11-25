import type {
  Trade,
  LedgerRecord,
  OpenPosition,
  AccountReport,
  SavedWorkspace,
  Currency,
  StrategyRule,
} from '../types/trading.ts'
export const currencies: readonly Currency[] = [
  'USD',
  'EUR',
  'CNY',
  'GBP',
  'JPY',
]
export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && currencies.some((c) => c === value)
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
function hasTradeFields(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    ['id', 'time', 'symbol', 'direction', 'strategy', 'magic', 'comment'].every(
      (k) => typeof value[k] === 'string',
    ) &&
    ['net', 'profit', 'commission', 'swap', 'volume'].every((k) =>
      finite(value[k]),
    ) &&
    (value.fee === undefined || finite(value.fee)) &&
    (value.openTime === undefined || typeof value.openTime === 'string') &&
    ['openPrice', 'closePrice', 'marketPrice', 'durationMinutes'].every(
      (k) => value[k] === undefined || value[k] === null || finite(value[k]),
    )
  )
}
function isTrade(value: unknown): value is Trade {
  return (
    hasTradeFields(value) &&
    (value.direction === 'buy' || value.direction === 'sell')
  )
}
function isLedger(value: unknown): value is LedgerRecord {
  return (
    hasTradeFields(value) &&
    typeof value.orderId === 'string' &&
    typeof value.entry === 'string' &&
    typeof value.openTime === 'string' &&
    (value.balance === null || finite(value.balance))
  )
}
function isOpenPosition(value: unknown): value is OpenPosition {
  return (
    isTrade(value) &&
    typeof value.openTime === 'string' &&
    'openingCost' in value &&
    finite(value.openingCost)
  )
}
function isReport(value: unknown): value is AccountReport {
  return (
    isRecord(value) &&
    Array.isArray(value.cashflows) &&
    value.cashflows.every(isLedger) &&
    Array.isArray(value.openPositions) &&
    value.openPositions.every(isOpenPosition) &&
    [
      'cashflowNet',
      'openingCosts',
      'closedNet',
      'closedProfit',
      'closedCommission',
      'closedSwap',
      'strategyMatched',
    ].every((k) => finite(value[k])) &&
    typeof value.hasMagic === 'boolean' &&
    [
      'initial',
      'periodStart',
      'ledgerEndBalance',
      'ledgerChange',
      'reconciliationDifference',
      'balance',
      'equity',
      'floating',
      'net',
      'grossProfit',
      'grossLoss',
      'count',
      'factor',
      'sharpe',
      'winningTrades',
      'winRate',
      'initialDeposit',
    ].every((k) => value[k] === undefined || finite(value[k])) &&
    [
      'account',
      'accountId',
      'company',
      'server',
      'currency',
      'date',
      'expert',
    ].every(
      (k) => value[k] === undefined || typeof value[k] === 'string',
    ) &&
    (value.balanceCurve === undefined ||
      (Array.isArray(value.balanceCurve) &&
        value.balanceCurve.every(
          (p) =>
            isRecord(p) &&
            typeof p.time === 'string' &&
            finite(p.balance) &&
            finite(p.drawdown) &&
            (p.cashFlow === undefined || finite(p.cashFlow)),
        )))
  )
}
function isRule(value: unknown): value is StrategyRule {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.magic === 'string' &&
    (value.type === undefined ||
      value.type === 'magic' ||
      value.type === 'comment') &&
    (value.magics === undefined ||
      (Array.isArray(value.magics) &&
        value.magics.every((m) => typeof m === 'string')))
  )
}
function parseAccountRules(
  value: unknown,
): Record<string, StrategyRule[]> | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) return undefined
  const out: Record<string, StrategyRule[]> = {}
  for (const [id, rules] of Object.entries(value)) {
    if (!id.trim() || !Array.isArray(rules) || !rules.every(isRule)) continue
    out[id.trim()] = rules.map((r) => ({
      name: r.name,
      magic: r.magic,
      type: r.type,
      magics: r.magics ? [...r.magics] : undefined,
    }))
  }
  return out
}
function cloneRules(rules: StrategyRule[]): StrategyRule[] {
  return rules.map((r) => ({
    name: r.name,
    magic: r.magic,
    type: r.type,
    magics: r.magics ? [...r.magics] : undefined,
  }))
}
/** JSON/文件来自运行时：先校验，再交给带类型的响应式状态，不能直接断言为可信数据。 */
export function parseSavedWorkspace(value: unknown): SavedWorkspace | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.trades) ||
    !value.trades.every(isTrade) ||
    !finite(value.initial) ||
    value.initial <= 0 ||
    !isCurrency(value.currency) ||
    !Array.isArray(value.rules) ||
    !value.rules.every(isRule)
  )
    return null
  const report =
    value.report === undefined || value.report === null ? null : value.report
  if (report !== null && !isReport(report)) return null
  let accountRules = parseAccountRules(value.accountRules)
  // 旧存档无 accountRules 时，把当前规则挂到报告账号下，便于下次导入复用。
  const accountId =
    typeof report?.accountId === 'string' ? report.accountId.trim() : ''
  if (
    (!accountRules || !Object.keys(accountRules).length) &&
    accountId &&
    value.rules.length
  ) {
    accountRules = { [accountId]: cloneRules(value.rules) }
  }
  return {
    trades: value.trades,
    initial: value.initial,
    currency: value.currency,
    rules: value.rules,
    accountRules,
    account: String(value.account || 'MT5 主账户'),
    isDemo: Boolean(value.isDemo),
    sourceMode: value.sourceMode === 'deals' ? 'deals' : 'positions',
    report,
  }
}
export { cloneRules }
