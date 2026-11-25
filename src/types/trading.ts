import type { Ref } from 'vue'

export type PageId =
  | 'dashboard'
  | 'trades'
  | 'funds'
  | 'strategies'
  | 'analysis'
  | 'correlation'
  | 'settings'
export type Direction = 'buy' | 'sell'
export type Currency = 'USD' | 'EUR' | 'CNY' | 'GBP' | 'JPY'
export type RuleType = 'magic' | 'comment'
export type CorrelationKey = 'strategy' | 'symbol' | 'strategySymbol'

/** 统计函数所需的最小输入，便于独立验证算法。 */
export interface TradeOutcome {
  time: string
  net: number
}
/** 已平仓持仓；时间是报告服务器时间，不进行时区换算。 */
export interface Trade extends TradeOutcome {
  id: string
  symbol: string
  direction: Direction
  volume: number
  profit: number
  commission: number
  swap: number
  fee?: number
  magic: string
  strategy: string
  comment: string
  openTime?: string
  openPrice?: number | null
  closePrice?: number | null
  marketPrice?: number | null
  durationMinutes?: number
}
/** 成交账本也包含 balance 等非交易方向，不可直接作为已平仓持仓统计。 */
export interface LedgerRecord extends Omit<Trade, 'direction'> {
  direction: string
  orderId: string
  entry: string
  balance: number | null
  openTime: string
}
export interface OpenPosition extends Trade {
  openTime: string
  openingCost: number
}
export interface BalancePoint {
  time: string
  balance: number
  drawdown: number
  /** 该时点出入金净额；交易成交为 0 */
  cashFlow?: number
}
export interface ReportMetadata {
  account?: string
  accountId?: string
  company?: string
  server?: string
  currency?: string
  date?: string
  balance?: number
  equity?: number
  floating?: number
  net?: number
  grossProfit?: number
  grossLoss?: number
  count?: number
  factor?: number
  sharpe?: number
  winningTrades?: number
  winRate?: number
  /** 策略测试报告中的专家顾问名称；历史报告通常没有。 */
  expert?: string
  /** 策略测试报告的初始入金；有成交结余时仍以账本为准。 */
  initialDeposit?: number
}
export interface AccountReport extends ReportMetadata {
  /** 分析用起始资金（曲线 / KPI）；账户从 0 入金时取首笔入金后结余。 */
  initial?: number
  /** 报告期间起始余额（首笔成交前），用于账本核对，可为 0。 */
  periodStart?: number
  balanceCurve?: BalancePoint[]
  ledgerEndBalance?: number
  ledgerChange?: number
  reconciliationDifference?: number
  cashflows: LedgerRecord[]
  cashflowNet: number
  openPositions: OpenPosition[]
  openingCosts: number
  closedNet: number
  closedProfit: number
  closedCommission: number
  closedSwap: number
  hasMagic: boolean
  strategyMatched: number
}
export interface ImportResult {
  trades: Trade[]
  dealMode: boolean
  skipped: number
  report: AccountReport
  sheet?: string
}
export interface StrategyRule {
  name: string
  /** 主前缀（兼容旧数据与单条规则展示） */
  magic: string
  /** 多条备注/前缀；存在时按其中任一条 startsWith 匹配 */
  magics?: string[]
  type?: RuleType
}
export interface TradeFilters {
  from: string
  to: string
  /** 空数组表示全部品种 */
  symbols: string[]
  strategies: string[]
  direction: Direction | ''
  weekday: number | ''
}
export interface GroupValue {
  name: string
  value: number
}
export interface TradeMetrics {
  count: number
  net: number
  winRate: number
  wins: number
  losses: number
  breakEven: number
  factor: number
  dd: number
  sharpe: number
  avgWin: number
  avgLoss: number
  expectancy: number
  curve: BalancePoint[]
  recovery: number
}
export interface SimulationResult {
  steps: number
  lines: number[][]
  lossProbability: number
  median: number
  dd95: number
}
export interface KpiItem {
  label: string
  value: string
  detail?: string
  second?: string
  color: 'blue' | 'green' | 'red' | 'amber'
}
export interface SavedWorkspace {
  trades: Trade[]
  initial: number
  currency: Currency
  rules: StrategyRule[]
  /** 按 MT5 账号 ID 持久化的策略规则；导入同账号历史时自动复用 */
  accountRules?: Record<string, StrategyRule[]>
  account: string
  isDemo: boolean
  sourceMode: 'positions' | 'deals'
  report: AccountReport | null
}
export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
export interface WorkspaceOptions {
  storage?: StorageAdapter | null
  confirm?: (message: string) => boolean
  print?: () => void
}
export interface WorkspaceState {
  sourceMode: Ref<SavedWorkspace['sourceMode']>
  report: Ref<AccountReport | null>
  ruleType: Ref<RuleType>
  trades: Ref<Trade[]>
  isDemo: Ref<boolean>
  initial: Ref<number>
  currency: Ref<Currency>
  rules: Ref<StrategyRule[]>
  account: Ref<string>
  page: Ref<PageId>
  mobile: Ref<boolean>
  uploadOpen: Ref<boolean>
  busy: Ref<boolean>
  error: Ref<string>
  notice: Ref<string>
  search: Ref<string>
  currentPage: Ref<number>
  drawdown: Ref<boolean>
  /** 绩效图把当前策略各自画成一条线，而不是合并成一条。 */
  splitStrategies: Ref<boolean>
  performanceMode: Ref<'growth' | 'balance'>
  corrBy: Ref<CorrelationKey>
  ruleName: Ref<string>
  ruleMagic: Ref<string>
  filters: Ref<TradeFilters>
}
