import {
  ref,
  watch,
  provide,
  inject,
  onScopeDispose,
  getCurrentScope,
} from 'vue'
import type { InjectionKey } from 'vue'
import type {
  Trade,
  AccountReport,
  StrategyRule,
  TradeFilters,
  WorkspaceState,
  WorkspaceOptions,
  SavedWorkspace,
  PageId,
  RuleType,
  Currency,
  CorrelationKey,
} from '../types/trading.ts'
import {
  parseSavedWorkspace,
  isCurrency,
  cloneRules,
} from '../lib/workspaceValidation.ts'
import { demoTrades } from '../lib/analytics.ts'
import {
  importFile,
  exportExcel,
  resolveAnalyticsInitial,
  syncReportInitial,
} from '../lib/importer.ts'
import { useTradeAnalytics } from './useTradeAnalytics.ts'
import { useChartOptions } from './useChartOptions.ts'

export type TradeWorkspace = ReturnType<typeof createTradeWorkspace>
const workspaceKey: InjectionKey<TradeWorkspace> = Symbol('trade-workspace')
const storageKey = 'trade-lens-v1'

export function createTradeWorkspace({
  storage = globalThis.localStorage,
  confirm = globalThis.confirm,
  print = () => globalThis.print?.(),
}: WorkspaceOptions = {}) {
  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  if (getCurrentScope())
    onScopeDispose(() => {
      clearTimeout(noticeTimer)
    })
  // localStorage 与备份同属外部输入，使用相同校验，兼容旧版本没有报告的存档。
  let saved: SavedWorkspace | null = null
  try {
    saved = parseSavedWorkspace(
      JSON.parse(storage?.getItem(storageKey) || 'null'),
    )
  } catch {}
  const sourceMode = ref<SavedWorkspace['sourceMode']>(
    saved?.sourceMode ?? 'positions',
  )
  // 旧存档可能把起始资金误存为 50000；有报告时从账本重新推导。
  const restoredReport = saved?.report
    ? syncReportInitial(saved.report)
    : null
  const report = ref<AccountReport | null>(restoredReport)
  const ruleType = ref<RuleType>('comment')
  const trades = ref<Trade[]>(
      Array.isArray(saved?.trades) ? saved.trades : demoTrades(),
    ),
    isDemo = ref(saved?.isDemo ?? true),
    initial = ref(
      restoredReport
        ? resolveAnalyticsInitial(restoredReport, saved?.initial ?? 50000)
        : (saved?.initial ?? 50000),
    ),
    currency = ref<Currency>(saved?.currency ?? 'USD'),
    rules = ref<StrategyRule[]>(saved?.rules ?? []),
    accountRules = ref<Record<string, StrategyRule[]>>(
      saved?.accountRules ?? {},
    ),
    account = ref(saved?.account ?? 'MT5 主账户')

  function accountIdOf(rep: AccountReport | null | undefined) {
    return (rep?.accountId || '').trim()
  }
  function snapshotPayload() {
    return {
      trades: trades.value,
      initial: initial.value,
      currency: currency.value,
      rules: rules.value,
      accountRules: accountRules.value,
      account: account.value,
      isDemo: isDemo.value,
      sourceMode: sourceMode.value,
      report: report.value,
    }
  }
  function rememberRules(accountId: string, next: StrategyRule[]) {
    if (!accountId) return
    accountRules.value = {
      ...accountRules.value,
      [accountId]: cloneRules(next),
    }
  }
  function rulesForAccount(accountId: string) {
    if (!accountId) return []
    const savedRules = accountRules.value[accountId]
    return savedRules ? cloneRules(savedRules) : []
  }

  // 纠正后立刻写回，避免刷新页面又读到错误的 50000。
  if (
    storage &&
    saved &&
    restoredReport &&
    (saved.initial !== initial.value ||
      (saved.report?.initial ?? null) !== (report.value?.initial ?? null) ||
      !saved.accountRules)
  ) {
    const id = accountIdOf(restoredReport)
    if (id && rules.value.length && !accountRules.value[id])
      rememberRules(id, rules.value)
    try {
      storage.setItem(storageKey, JSON.stringify(snapshotPayload()))
    } catch {}
  }
  const page = ref<PageId>('dashboard'),
    mobile = ref(false),
    uploadOpen = ref(false),
    busy = ref(false),
    error = ref(''),
    notice = ref(''),
    search = ref(''),
    currentPage = ref(1),
    drawdown = ref(false),
    splitStrategies = ref(false),
    performanceMode = ref<'growth' | 'balance'>('growth'),
    corrBy = ref<CorrelationKey>('strategySymbol')
  const ruleName = ref(''),
    ruleMagic = ref(''),
    ruleMagics = ref<string[]>([]),
    editingRuleName = ref('')
  const filters = ref<TradeFilters>({
    from: '',
    to: '',
    symbols: [],
    strategies: [],
    direction: '',
    weekday: '',
  })

  const state: WorkspaceState = {
    sourceMode,
    report,
    ruleType,
    trades,
    isDemo,
    initial,
    currency,
    rules,
    account,
    page,
    mobile,
    uploadOpen,
    busy,
    error,
    notice,
    search,
    currentPage,
    drawdown,
    splitStrategies,
    performanceMode,
    corrBy,
    ruleName,
    ruleMagic,
    filters,
  }
  const analytics = useTradeAnalytics(state)
  const charts = useChartOptions({ ...state, ...analytics })
  watch(
    [filters, search],
    () => {
      currentPage.value = 1
    },
    { deep: true },
  )
  // 保存完整工作空间以保留跨页面状态。
  watch(
    [
      trades,
      initial,
      currency,
      rules,
      accountRules,
      account,
      isDemo,
      sourceMode,
      report,
    ],
    () => {
      try {
        storage?.setItem(storageKey, JSON.stringify(snapshotPayload()))
      } catch {
        notify('浏览器存储空间不足，请导出备份。')
      }
    },
    { deep: true },
  )
  // 当前账号的规则变更时，同步写入按账号归档，便于下次导入复用。
  watch(
    rules,
    (next) => {
      if (isDemo.value) return
      const id = accountIdOf(report.value)
      if (!id) return
      rememberRules(id, next)
    },
    { deep: true },
  )
  function printReport() {
    print()
  }
  function notify(message: string) {
    notice.value = message
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => (notice.value = ''), 5000)
  }
  function resetFilters() {
    filters.value = {
      from: '',
      to: '',
      symbols: [],
      strategies: [],
      direction: '',
      weekday: '',
    }
  }
  async function loadFile(file: Blob | null | undefined) {
    if (!file) return
    busy.value = true
    error.value = ''
    try {
      const result = await importFile(file)
      const prevId = accountIdOf(report.value)
      if (prevId && !isDemo.value)
        rememberRules(prevId, rules.value)

      const synced = syncReportInitial(result.report)
      const nextId = accountIdOf(synced)
      const reused = rulesForAccount(nextId)

      // 历史数据直接覆盖；同账号规则复用，新账号从空规则开始。
      trades.value = [...result.trades].sort((a, b) =>
        a.time.localeCompare(b.time),
      )
      isDemo.value = false
      sourceMode.value = result.dealMode ? 'deals' : 'positions'
      report.value = synced
      rules.value = reused
      const resolvedInitial = resolveAnalyticsInitial(synced, 0)
      const inferredInitial = resolvedInitial > 0
      initial.value = inferredInitial ? resolvedInitial : 50000
      if (isCurrency(result.report.currency))
        currency.value = result.report.currency
      account.value = nextId
        ? `MT5 #${nextId}`
        : synced.expert
          ? synced.expert
          : account.value || 'MT5 主账户'
      ruleType.value = 'comment'
      editingRuleName.value = ''
      ruleName.value = ''
      ruleMagic.value = ''
      ruleMagics.value = []
      resetFilters()
      uploadOpen.value = false
      const accountHint = nextId
        ? `账号 ${nextId}`
        : synced.expert
          ? `策略测试 ${synced.expert}`
          : '未识别账号 ID'
      const rulesHint = nextId
        ? reused.length
          ? `已复用 ${reused.length} 条策略规则`
          : '该账号暂无已保存规则'
        : '无账号 ID，规则未归档'
      notify(
        `已导入 ${result.trades.length} 笔交易（历史已覆盖）· ${accountHint} · ${rulesHint}${result.skipped ? `；跳过 ${result.skipped} 行无效数据` : ''}${result.dealMode ? '；成交模式仅含退出成交的费用，请使用历史持仓报告获取完整费用' : ''}${inferredInitial ? `；起始资金 ${resolvedInitial}` : '；未能推算起始资金，已使用默认 50000'}`,
      )
    } catch (e) {
      error.value = e instanceof Error ? e.message : '文件读取失败'
    } finally {
      busy.value = false
    }
  }
  function ruleRemarks(r: { magic: string; magics?: string[] }) {
    return r.magics?.length ? [...r.magics] : r.magic ? [r.magic] : []
  }
  function addRule() {
    const name = ruleName.value.trim()
    const selected = [
      ...new Set(
        (ruleMagics.value.length
          ? ruleMagics.value
          : ruleMagic.value
            ? [ruleMagic.value]
            : []
        )
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ]
    if (!name || !selected.length) return
    ruleType.value = 'comment'
    const prev = editingRuleName.value
    rules.value = rules.value.filter(
      (r) => r.name !== name && (!prev || r.name !== prev),
    )
    rules.value.push({
      name,
      magic: selected[0],
      magics: selected,
      type: 'comment',
    })
    ruleName.value = ''
    ruleMagic.value = ''
    ruleMagics.value = []
    editingRuleName.value = ''
    notify(prev ? '策略规则已更新' : '策略规则已保存')
  }
  function startEditRule(r: { name: string; magic: string; magics?: string[] }) {
    editingRuleName.value = r.name
    ruleName.value = r.name
    ruleMagic.value = ''
    ruleMagics.value = ruleRemarks(r)
  }
  function cancelEditRule() {
    editingRuleName.value = ''
    ruleName.value = ''
    ruleMagic.value = ''
    ruleMagics.value = []
  }
  function removeRule(name: string) {
    rules.value = rules.value.filter((r) => r.name !== name)
    if (editingRuleName.value === name) cancelEditRule()
  }
  function ruleLabel(r: { magic: string; magics?: string[] }) {
    const list = ruleRemarks(r)
    if (list.length <= 1) return `备注 ${list[0] || '—'}`
    return `备注 ${list.length} 条`
  }
  /** 已被其他规则占用的备注（编辑中的规则除外，便于回显勾选） */
  function claimedComments(exceptName = '') {
    const set = new Set<string>()
    for (const r of rules.value) {
      if (exceptName && r.name === exceptName) continue
      for (const m of ruleRemarks(r)) set.add(m)
    }
    return set
  }
  function downloadBackup() {
    const blob = new Blob(
      [JSON.stringify({ version: 1, ...snapshotPayload() }, null, 2)],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob),
      a = document.createElement('a')
    a.href = url
    a.download = 'trade-lens-backup.json'
    a.click()
    URL.revokeObjectURL(url)
    notify('已导出账户备份')
  }
  async function restore(event: Event) {
    const input = event.target
    if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return
    try {
      // 备份可能被手工编辑或损坏，校验整份数据后才替换当前账户，避免半恢复状态。
      const data = parseSavedWorkspace(JSON.parse(await input.files[0].text()))
      if (!data) throw new Error('备份格式无效')
      const prevId = accountIdOf(report.value)
      if (prevId && !isDemo.value) rememberRules(prevId, rules.value)
      trades.value = data.trades
      currency.value = data.currency
      rules.value = data.rules
      if (data.accountRules)
        accountRules.value = { ...accountRules.value, ...data.accountRules }
      account.value = data.account
      isDemo.value = data.isDemo
      sourceMode.value = data.sourceMode
      report.value = data.report ? syncReportInitial(data.report) : null
      initial.value = report.value
        ? resolveAnalyticsInitial(report.value, data.initial)
        : data.initial
      const id = accountIdOf(report.value)
      if (id) rememberRules(id, rules.value)
      resetFilters()
      notify('备份已恢复')
    } catch (e) {
      notify(e instanceof Error ? e.message : '无法读取备份')
    } finally {
      input.value = ''
    }
  }
  function clearData() {
    if (
      confirm(
        '清除当前浏览器的交易记录？各账号已保存的策略规则会保留，便于下次导入同账号时复用。建议先导出备份。',
      )
    ) {
      const id = accountIdOf(report.value)
      if (id && !isDemo.value) rememberRules(id, rules.value)
      trades.value = []
      report.value = null
      rules.value = []
      isDemo.value = false
      resetFilters()
      notify('本地交易数据已清除（策略规则库已保留）')
    }
  }
  function removeAccountRules(accountId: string) {
    const id = accountId.trim()
    if (!id || !accountRules.value[id]) return
    if (!confirm(`删除账号 MT5 #${id} 已保存的 ${accountRules.value[id].length} 条策略规则？`))
      return
    const next = { ...accountRules.value }
    delete next[id]
    accountRules.value = next
    // 若删的是当前账号归档，同步清空当前规则，避免“看着还有、下次又复用”
    if (accountIdOf(report.value) === id) {
      rules.value = []
      cancelEditRule()
    }
    notify(`已删除账号 #${id} 的策略规则`)
  }
  function loadDemo() {
    if (
      trades.value.length &&
      !isDemo.value &&
      !confirm('演示数据将替换当前账户记录，请确认已备份。')
    )
      return
    const id = accountIdOf(report.value)
    if (id && !isDemo.value) rememberRules(id, rules.value)
    trades.value = demoTrades()
    report.value = null
    initial.value = 50000
    rules.value = []
    isDemo.value = true
    sourceMode.value = 'positions'
    resetFilters()
    notify('已载入演示账户')
  }
  function navigateTo(id: PageId) {
    page.value = id
    mobile.value = false
  }
  function openImport() {
    uploadOpen.value = true
    error.value = ''
  }
  function viewStrategy(name: string) {
    resetFilters()
    filters.value.strategies = [name]
    page.value = 'analysis'
  }
  return {
    ...state,
    ...analytics,
    ...charts,
    printReport,
    notify,
    resetFilters,
    loadFile,
    addRule,
    downloadBackup,
    restore,
    clearData,
    loadDemo,
    navigateTo,
    openImport,
    viewStrategy,
    exportExcel,
    ruleMagics,
    editingRuleName,
    ruleLabel,
    ruleRemarks,
    startEditRule,
    cancelEditRule,
    removeRule,
    claimedComments,
    accountRules,
    accountIdOf,
    removeAccountRules,
  }
}

export function provideTradeWorkspace(workspace = createTradeWorkspace()) {
  provide(workspaceKey, workspace)
  return workspace
}

/** 根组件只创建一次工作空间；子组件注入同一组 refs，避免每页重复初始化。 */
export function useTradeWorkspace(): TradeWorkspace {
  const workspace = inject(workspaceKey)
  if (!workspace)
    throw new Error('Trade workspace must be provided by the application root')
  return workspace
}
