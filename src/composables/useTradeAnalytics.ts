import { computed, watch } from 'vue'
import type { WorkspaceState, KpiItem, TradeFilters } from '../types/trading.ts'
import { metrics, monthlyPnlHeatmap } from '../lib/analytics.ts'
import {
  computeTimeWeightedReturn,
  equitySeriesFromBalanceCurve,
  equitySeriesFromTrades,
  monthlyTwrMatrix,
  round2,
  formatNum,
} from '../lib/twr.ts'

export function useTradeAnalytics(state: WorkspaceState) {
  const {
    trades,
    rules,
    filters,
    page,
    initial,
    currency,
    search,
    currentPage,
    report,
  } = state
  // 按保存顺序用开仓备注前缀匹配策略（MT5 历史导出无 Magic）。
  const resolved = computed(() =>
    trades.value.map((t) => ({
      ...t,
      strategy:
        rules.value.find((r) => {
          if ((r.type || 'comment') === 'comment') {
            const comment = t.comment || ''
            const prefixes = r.magics?.length ? r.magics : [r.magic]
            return prefixes.some((p) => p !== '' && comment.startsWith(p))
          }
          return t.magic !== '' && r.magic === t.magic
        })?.name || t.strategy,
    })),
  )
  const strategies = computed(() =>
    [...new Set(resolved.value.map((t) => t.strategy))].sort(),
  )
  const symbols = computed(() =>
    [...new Set(trades.value.map((t) => t.symbol))].sort(),
  )

  type FilterDim =
    | 'dates'
    | 'symbols'
    | 'strategies'
    | 'direction'
    | 'weekday'

  function matchesFilters(
    t: (typeof resolved.value)[number],
    except?: FilterDim,
  ) {
    const f = filters.value
    const day = t.time.slice(0, 10)
    if (except !== 'dates') {
      if (f.from && day < f.from) return false
      if (f.to && day > f.to) return false
    }
    if (
      except !== 'symbols' &&
      f.symbols.length &&
      !f.symbols.includes(t.symbol)
    )
      return false
    if (
      except !== 'strategies' &&
      f.strategies.length &&
      !f.strategies.includes(t.strategy)
    )
      return false
    if (except !== 'direction' && f.direction && t.direction !== f.direction)
      return false
    if (
      except !== 'weekday' &&
      f.weekday !== '' &&
      new Date(t.time).getDay() !== Number(f.weekday)
    )
      return false
    return true
  }

  const filtered = computed(() =>
    resolved.value.filter((t) => matchesFilters(t)),
  )

  /** 不含日期条件的交易跨度，供绩效图下方的区间滑块定位。 */
  const analysisDateSpan = computed(() => {
    let min = ''
    let max = ''
    for (const trade of resolved.value) {
      if (!matchesFilters(trade, 'dates')) continue
      const day = trade.time.slice(0, 10)
      if (!min || day < min) min = day
      if (!max || day > max) max = day
    }
    return { min, max }
  })

  /** 各筛选项可选值：按「其它已选条件」联动，不含自身。 */
  const filterFacets = computed(() => {
    const pool = (except: FilterDim) =>
      resolved.value.filter((t) => matchesFilters(t, except))
    const uniq = <T extends string | number>(xs: T[]) =>
      [...new Set(xs)].sort((a, b) => String(a).localeCompare(String(b), 'zh'))
    return {
      symbols: uniq(pool('symbols').map((t) => t.symbol)),
      strategies: uniq(pool('strategies').map((t) => t.strategy)),
      directions: uniq(pool('direction').map((t) => t.direction)),
      weekdays: uniq(pool('weekday').map((t) => new Date(t.time).getDay())),
    }
  })

  // 其它条件变化后，清掉当前不可达的已选项，保持多选/单选一致。
  watch(
    filterFacets,
    (facets) => {
      const f = filters.value
      const next: TradeFilters = { ...f }
      let changed = false
      const symbolsNext = f.symbols.filter((s) => facets.symbols.includes(s))
      if (symbolsNext.length !== f.symbols.length) {
        next.symbols = symbolsNext
        changed = true
      }
      const strategiesNext = f.strategies.filter((s) =>
        facets.strategies.includes(s),
      )
      if (strategiesNext.length !== f.strategies.length) {
        next.strategies = strategiesNext
        changed = true
      }
      if (f.direction && !facets.directions.includes(f.direction)) {
        next.direction = ''
        changed = true
      }
      if (
        f.weekday !== '' &&
        !facets.weekdays.includes(Number(f.weekday))
      ) {
        next.weekday = ''
        changed = true
      }
      if (changed) filters.value = next
    },
    { flush: 'post' },
  )
  const activeTrades = computed(() =>
    ['analysis', 'trades'].includes(page.value)
      ? filtered.value
      : resolved.value,
  )
  const stats = computed(() => metrics(activeTrades.value, initial.value))

  /** 品种/策略/方向/星期任一生效时，不能再走全账户账本曲线。 */
  const hasTradeScopeFilters = computed(() => {
    const f = filters.value
    return (
      f.symbols.length > 0 ||
      f.strategies.length > 0 ||
      Boolean(f.direction) ||
      f.weekday !== ''
    )
  })

  const inDateRange = (time: string) => {
    const day = time.slice(0, 10)
    const from = filters.value.from
    const to = filters.value.to
    return (!from || day >= from) && (!to || day <= to)
  }

  /**
   * TWR 输入序列：
   * - 总览或未做交易范围筛选：优先账本净值（可剔除出入金）
   * - 绩效分析/明细且筛了品种策略等：改用当前筛选交易累计，保证与下方 KPI/图表同步
   */
  const equitySeries = computed(() => {
    const useLedger =
      Boolean(report.value?.balanceCurve?.length) &&
      (page.value === 'dashboard' || !hasTradeScopeFilters.value)
    if (useLedger && report.value?.balanceCurve?.length) {
      let series = equitySeriesFromBalanceCurve(
        report.value.balanceCurve,
        report.value.cashflows,
      )
      if (filters.value.from || filters.value.to)
        series = series.filter((p) => inDateRange(p.timestamp))
      return series
    }
    return equitySeriesFromTrades(
      activeTrades.value.filter((t) => inDateRange(t.time)),
      initial.value,
    )
  })
  const twrResult = computed(() =>
    computeTimeWeightedReturn(equitySeries.value),
  )
  const twrMonthMatrix = computed(() =>
    monthlyTwrMatrix(equitySeries.value),
  )
  const pnlHeatmap = computed(() =>
    monthlyPnlHeatmap(activeTrades.value, twrMonthMatrix.value),
  )
  const growthPct = computed(() => round2(twrResult.value.totalReturn * 100))
  const avgMonthlyGrowth = computed(() => {
    const months = twrMonthMatrix.value.years.reduce(
      (n, y) => n + y.months.filter((m) => m.value !== null).length,
      0,
    )
    return months ? round2(growthPct.value / months) : 0
  })

  const money = (v: number | undefined) =>
    new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: currency.value,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(v !== undefined && Number.isFinite(v) ? round2(v) : 0)
  const signed = (v: number) => (v > 0 ? '+' : '') + money(v)
  const fmt = (v: number | undefined) =>
    v === undefined ? '—' : Number.isFinite(v) ? formatNum(v) : '∞'
  const pct = (v: number) => `${formatNum(v)}%`

  const kpis = computed<KpiItem[]>(() => [
    {
      label: '总交易数',
      value: stats.value.count.toLocaleString(),
      detail: `多单 ${activeTrades.value.filter((t) => t.direction === 'buy').length} / 空单 ${activeTrades.value.filter((t) => t.direction === 'sell').length}`,
      color: 'blue',
    },
    {
      label: '胜率',
      value: pct(stats.value.winRate),
      detail: `${stats.value.wins} 盈 / ${stats.value.losses} 亏 / ${stats.value.breakEven} 平`,
      color: 'blue',
    },
    {
      label: '已平仓净利润',
      value: signed(stats.value.net),
      detail: `时间加权收益 ${pct(growthPct.value)}`,
      color: stats.value.net >= 0 ? 'green' : 'red',
    },
    {
      label: '盈利因子',
      value: fmt(stats.value.factor),
      detail: '总盈利 / 总亏损',
      color: 'amber',
    },
    {
      label: '最大回撤',
      value: money(stats.value.dd),
      detail: `恢复因子 ${fmt(stats.value.recovery)}`,
      color: 'red',
    },
    {
      label: '夏普比率',
      value: fmt(stats.value.sharpe),
      detail: '交易日收益 · 年化 √252',
      color: 'amber',
    },
    {
      label: '平均盈利 / 亏损',
      value: signed(stats.value.avgWin),
      second: '−' + money(stats.value.avgLoss),
      color: 'blue',
    },
    {
      label: '单笔期望',
      value: signed(stats.value.expectancy),
      detail: '每笔净盈亏均值',
      color: stats.value.expectancy >= 0 ? 'green' : 'red',
    },
  ])
  const tableTrades = computed(() =>
    filtered.value
      .filter((t) =>
        `${t.id} ${t.symbol} ${t.strategy} ${t.comment}`
          .toLowerCase()
          .includes(search.value.toLowerCase()),
      )
      .sort((a, b) => b.time.localeCompare(a.time)),
  )
  const pageCount = computed(() =>
    Math.max(1, Math.ceil(tableTrades.value.length / 20)),
  )
  const rows = computed(() =>
    tableTrades.value.slice(
      (currentPage.value - 1) * 20,
      currentPage.value * 20,
    ),
  )
  const strategyStats = computed(() =>
    strategies.value.map((name) => ({
      name,
      ...metrics(
        resolved.value.filter((t) => t.strategy === name),
        initial.value,
      ),
    })),
  )

  return {
    resolved,
    strategies,
    symbols,
    filterFacets,
    filtered,
    analysisDateSpan,
    activeTrades,
    stats,
    equitySeries,
    twrResult,
    twrMonthMatrix,
    pnlHeatmap,
    growthPct,
    avgMonthlyGrowth,
    money,
    signed,
    fmt,
    pct,
    formatNum,
    kpis,
    tableTrades,
    pageCount,
    rows,
    strategyStats,
  }
}
