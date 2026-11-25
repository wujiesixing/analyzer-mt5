import { computed } from 'vue'
import type { EChartsOption } from 'echarts'
import type { WorkspaceState, GroupValue } from '../types/trading.ts'
import type { useTradeAnalytics } from './useTradeAnalytics.ts'
import { group, correlation, metrics, monthlyMatrix } from '../lib/analytics.ts'
import {
  computeTimeWeightedReturn,
  equitySeriesFromTrades,
  formatNum,
  round2,
} from '../lib/twr.ts'

export function useChartOptions(
  state: WorkspaceState & ReturnType<typeof useTradeAnalytics>,
) {
  const {
    stats,
    page,
    report,
    initial,
    drawdown,
    splitStrategies,
    performanceMode,
    activeTrades,
    filters,
    resolved,
    corrBy,
    twrResult,
    twrMonthMatrix,
    money,
  } = state
  // satisfies 检查图表配置，同时保留轴类型字面量，组合配置时不丢失类型信息。
  const base = {
    backgroundColor: 'transparent',
    textStyle: {
      fontFamily: 'Inter, PingFang SC, sans-serif',
      color: '#8792a8',
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#20293a',
      borderColor: '#344158',
      textStyle: { color: '#edf1fa' },
      confine: true,
      valueFormatter: (v) =>
        typeof v === 'number' && Number.isFinite(v)
          ? formatNum(v)
          : String(v ?? ''),
    },
    grid: { left: 65, right: 24, top: 22, bottom: 40 },
    xAxis: {
      type: 'category',
      axisLine: { lineStyle: { color: '#2a3344' } },
      axisTick: { show: false },
      axisLabel: { color: '#7c889f', fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#7c889f',
        fontSize: 10,
        formatter: (v: number) =>
          Math.abs(v) >= 1000
            ? `${formatNum(v / 1000)}k`
            : formatNum(v),
      },
      splitLine: { lineStyle: { color: '#232b3c', type: 'dashed' } },
    },
  } satisfies EChartsOption
  const hasEquityLedger = computed(() =>
    Boolean(report.value?.balanceCurve?.length),
  )
  const usesLedger = computed(
    () => page.value === 'dashboard' && hasEquityLedger.value,
  )

  const hasTradeScopeFilters = computed(() => {
    const f = filters.value
    return (
      f.symbols.length > 0 ||
      f.strategies.length > 0 ||
      Boolean(f.direction) ||
      f.weekday !== ''
    )
  })

  /** 结余视图：总览用账本；分析页有交易范围筛选时改用筛选后累计曲线。 */
  const equityCurve = computed(() => {
    const from = filters.value.from
    const to = filters.value.to
    const inRange = (time: string) => {
      const day = time.slice(0, 10)
      return (!from || day >= from) && (!to || day <= to)
    }
    const useLedger =
      Boolean(report.value?.balanceCurve?.length) &&
      (page.value === 'dashboard' || !hasTradeScopeFilters.value)
    if (useLedger && report.value?.balanceCurve?.length) {
      return report.value.balanceCurve
        .filter((t) => inRange(t.time))
        .map((t) => ({
          time: t.time,
          balance: round2(t.balance),
          drawdown: round2(t.drawdown),
        }))
    }
    return stats.value.curve.map((t) => ({
      ...t,
      balance: round2(t.balance),
      drawdown: round2(t.drawdown),
    }))
  })
  const displayCurve = computed(() => equityCurve.value)
  const displayedBalance = computed(() => {
    const last = equityCurve.value.at(-1)?.balance
    if (last !== undefined) return round2(last)
    if (
      page.value === 'dashboard' &&
      report.value?.equity !== undefined &&
      Number.isFinite(report.value.equity)
    )
      return round2(report.value.equity)
    return round2(initial.value)
  })
  const twrGrowthLabel = computed(() =>
    hasEquityLedger.value &&
    (page.value === 'dashboard' || !hasTradeScopeFilters.value)
      ? '时间加权成长（已剔除出入金）'
      : '时间加权成长',
  )
  const monthMatrix = computed(() => monthlyMatrix(activeTrades.value))

  /** 剔除起始后出入金的累计交易利润 */
  function twrProfitAmounts(
    periods: { equity: number; cashFlow: number }[],
  ): number[] {
    const startEquity = periods[0]?.equity ?? 0
    let cumCf = 0
    return periods.map((p, i) => {
      if (i > 0) cumCf += p.cashFlow
      return round2(p.equity - startEquity - cumCf)
    })
  }

  function growthTooltipHtml(
    date: string,
    pct: number,
    profit: number | undefined,
    label = '收益',
  ) {
    const profitLine =
      profit === undefined
        ? ''
        : `<br/><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#35c99c;margin-right:6px"></span>利润金额 ${profit > 0 ? '+' : ''}${money(profit)}`
    return [
      `<div style="margin-bottom:4px">${date}</div>`,
      `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#7698ff;margin-right:6px"></span>${label} ${formatNum(pct)}%`,
      profitLine,
    ].join('')
  }

  function cashflowMarkers(
    times: string[],
    axisMin: number,
    axisMax: number,
  ) {
    const from = filters.value.from
    const to = filters.value.to
    const inRange = (time: string) => {
      const day = time.slice(0, 10)
      return (!from || day >= from) && (!to || day <= to)
    }
    const categoryForDay = (time: string) => {
      const day = time.slice(0, 10)
      if (times.includes(day)) return day
      for (const t of times) {
        if (t >= day) return t
      }
      return times.at(-1)
    }
    const deposits: { value: [string, number]; net: number }[] = []
    const withdrawals: { value: [string, number]; net: number }[] = []
    for (const flow of report.value?.cashflows ?? []) {
      if (!inRange(flow.time) || !Number.isFinite(flow.net) || flow.net === 0)
        continue
      const cat = categoryForDay(flow.time)
      if (!cat) continue
      const net = round2(flow.net)
      if (net > 0) deposits.push({ value: [cat, axisMin], net })
      else withdrawals.push({ value: [cat, axisMax], net })
    }
    return { deposits, withdrawals }
  }

  const strategyColors = [
    '#7698ff',
    '#35c99c',
    '#f0b429',
    '#ed7180',
    '#c084fc',
    '#22d3ee',
    '#fb923c',
    '#a3e635',
    '#f472b6',
    '#38bdf8',
    '#2dd4bf',
    '#e879f9',
  ]

  /** 当前筛选结果里的每个策略一条线，数值都从同一起始资金单独累计。 */
  function strategySplitOption(
    kind: 'growth' | 'balance' | 'drawdown',
  ): EChartsOption | null {
    const groups = new Map<string, typeof activeTrades.value>()
    for (const trade of activeTrades.value) {
      const list = groups.get(trade.strategy)
      if (list) list.push(trade)
      else groups.set(trade.strategy, [trade])
    }
    const picked = filters.value.strategies
    const names = (
      picked.length
        ? picked
        : [...groups.keys()].sort((a, b) => a.localeCompare(b, 'zh'))
    ).filter((name) => groups.has(name))
    if (!names.length) return null
    const start = round2(initial.value)
    const lines = names.map((name, index) => {
      const trades = groups.get(name) ?? []
      const curve = metrics(trades, start)
      const balance = new Map<string, number>()
      const drawdown = new Map<string, number>()
      for (const point of curve.curve) {
        const day = point.time.slice(0, 10)
        balance.set(day, point.balance)
        drawdown.set(day, round2(-Math.abs(point.drawdown)))
      }
      const growth = new Map<string, number>()
      for (const period of computeTimeWeightedReturn(
        equitySeriesFromTrades(trades, start),
      ).periods) {
        const day = period.timestamp.slice(0, 10)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue
        growth.set(day, round2((period.index - 1) * 100))
      }
      return {
        name,
        color: strategyColors[index % strategyColors.length],
        values:
          kind === 'growth' ? growth : kind === 'drawdown' ? drawdown : balance,
      }
    })
    const days = [
      ...new Set(lines.flatMap((line) => [...line.values.keys()])),
    ].sort()
    const fallback = kind === 'balance' ? start : 0
    const seriesData = lines.map((line) => {
      let last = fallback
      return days.map((day) => {
        const value = line.values.get(day)
        if (value !== undefined) last = value
        return last
      })
    })
    const flat = seriesData.flat()
    let yMin: number
    let yMax: number
    if (kind === 'drawdown') {
      const minDd = flat.length ? Math.min(...flat, 0) : 0
      const pad = Math.max(Math.abs(minDd) * 0.06, 1)
      yMin = minDd - pad
      yMax = 0
    } else if (kind === 'balance') {
      // 各策略都从同一起始资金出发，差额通常远小于起始资金，按数据范围缩放才能分开。
      const low = flat.length ? Math.min(start, ...flat) : start
      const high = flat.length ? Math.max(start, ...flat) : start
      const pad = Math.max((high - low) * 0.12, 1)
      yMin = low - pad
      yMax = high + pad
    } else {
      const low = flat.length ? Math.min(0, ...flat) : 0
      const high = flat.length ? Math.max(0, ...flat) : 0
      const pad = Math.max((high - low) * 0.08, 0.1)
      yMin = low - pad
      yMax = high + pad
    }
    return {
      ...base,
      legend: {
        type: 'scroll',
        top: 0,
        left: 8,
        right: 8,
        icon: 'circle',
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: '#8b95a8', fontSize: 11 },
        pageIconColor: '#8b95a8',
        pageTextStyle: { color: '#8b95a8' },
      },
      grid: { ...base.grid, top: 42, right: 28 },
      tooltip: {
        ...base.tooltip,
        formatter: (params) => {
          const list = Array.isArray(params) ? params : [params]
          const first = list[0] as { name?: unknown } | undefined
          const date = String(first?.name ?? '')
          const rows = list.map((item) => {
            const raw = item?.value
            const value = typeof raw === 'number' ? raw : Number(raw ?? 0)
            const text =
              kind === 'growth' ? `${formatNum(value)}%` : money(value)
            const color =
              typeof item?.color === 'string' ? item.color : '#7698ff'
            return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px"></span>${item?.seriesName ?? ''} ${text}`
          })
          return [`<div style="margin-bottom:4px">${date}</div>`, ...rows].join(
            '<br/>',
          )
        },
      },
      xAxis: { ...base.xAxis, data: days },
      yAxis: {
        ...base.yAxis,
        min: yMin,
        max: yMax,
        axisLabel: {
          color: '#7c889f',
          fontSize: 10,
          formatter: (v: number) =>
            kind === 'growth' ? `${formatNum(v)}%` : money(v),
        },
      },
      series: lines.map((line, index) => ({
        name: line.name,
        type: 'line' as const,
        showSymbol: false,
        data: seriesData[index],
        lineStyle: { color: line.color, width: 2 },
        itemStyle: { color: line.color },
      })),
    }
  }

  const balanceOption = computed<EChartsOption>(() => {
    if (page.value === 'analysis' && splitStrategies.value) {
      const split = strategySplitOption(
        drawdown.value
          ? 'drawdown'
          : performanceMode.value === 'growth'
            ? 'growth'
            : 'balance',
      )
      if (split) return split
    }
    // 回撤专图（图二）：0 在顶部，红色面积向下
    if (page.value === 'analysis' && drawdown.value) {
      const curve = equityCurve.value
      const times = curve.map((t) => t.time.slice(0, 10))
      const ddNeg = curve.map((t) => round2(-Math.abs(t.drawdown)))
      const peaks = curve.map((t) => round2(t.balance + Math.abs(t.drawdown)))
      const minDd = ddNeg.length ? Math.min(...ddNeg, 0) : 0
      const pad = Math.max(Math.abs(minDd) * 0.06, 1)
      return {
        ...base,
        grid: { ...base.grid, top: 22, right: 36 },
        tooltip: {
          ...base.tooltip,
          formatter: (params) => {
            const p = Array.isArray(params) ? params[0] : params
            const idx = typeof p?.dataIndex === 'number' ? p.dataIndex : -1
            const date = idx >= 0 ? times[idx] : String(p?.name ?? '')
            const amt =
              typeof p?.value === 'number' ? p.value : Number(p?.value ?? 0)
            const peak = idx >= 0 ? peaks[idx] : 0
            const pct =
              peak > 0 ? round2((Math.abs(amt) / peak) * 100) : 0
            return [
              `<div style="margin-bottom:4px">${date}</div>`,
              `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#ed7180;margin-right:6px"></span>回撤 ${money(amt)} (${formatNum(pct)}%)`,
            ].join('')
          },
        },
        xAxis: { ...base.xAxis, data: times },
        yAxis: {
          ...base.yAxis,
          min: minDd - pad,
          max: 0,
          axisLabel: {
            color: '#7c889f',
            fontSize: 10,
            formatter: (v: number) => money(v),
          },
        },
        series: [
          {
            name: '回撤',
            type: 'line',
            showSymbol: false,
            data: ddNeg,
            lineStyle: { color: '#ed7180', width: 2 },
            areaStyle: {
              origin: 'end',
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: '#ed718066' },
                  { offset: 1, color: '#ed718012' },
                ],
              },
            },
          },
        ],
      }
    }

    // 分析页成长：与总览收益曲线同能力（利润金额 tooltip）+ 趋势线
    if (page.value === 'analysis' && performanceMode.value === 'growth') {
      const periods = twrResult.value.periods
      const times = periods.map((t) => t.timestamp.slice(0, 10))
      const growth = periods.map((t) => round2((t.index - 1) * 100))
      const profits = twrProfitAmounts(periods)
      const n = growth.length
      const trend =
        n > 1
          ? growth.map((_, i) => round2((growth[n - 1] * i) / (n - 1)))
          : growth
      return {
        ...base,
        grid: { ...base.grid, right: 48 },
        tooltip: {
          ...base.tooltip,
          formatter: (params) => {
            const list = Array.isArray(params) ? params : [params]
            const p =
              list.find((x) => x.seriesName === '成长') ?? list[0]
            const idx = typeof p?.dataIndex === 'number' ? p.dataIndex : -1
            const pct =
              typeof p?.value === 'number' ? p.value : Number(p?.value ?? 0)
            return growthTooltipHtml(
              idx >= 0 ? times[idx] : String(p?.name ?? ''),
              pct,
              idx >= 0 ? profits[idx] : undefined,
              '成长',
            )
          },
        },
        xAxis: { ...base.xAxis, data: times },
        yAxis: {
          ...base.yAxis,
          axisLabel: {
            color: '#7c889f',
            fontSize: 10,
            formatter: (v: number) => `${formatNum(v)}%`,
          },
        },
        series: [
          {
            name: '成长',
            type: 'line',
            showSymbol: false,
            data: growth,
            lineStyle: { color: '#7698ff', width: 2 },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: '#587cff44' },
                  { offset: 1, color: '#587cff02' },
                ],
              },
            },
          },
          {
            name: '趋势',
            type: 'line',
            showSymbol: false,
            data: trend,
            lineStyle: { color: '#56617b', width: 1, type: 'dashed' },
            tooltip: { show: false },
          },
        ],
      }
    }

    // 结余：与总览净值曲线同能力（起始靠左、出入金节点）
    const curve = equityCurve.value
    const times = curve.map((t) => t.time.slice(0, 10))
    const balances = curve.map((t) => t.balance)
    const start = round2(curve[0]?.balance ?? initial.value)
    const yMin = balances.length
      ? Math.min(0, start, ...balances)
      : Math.min(0, start)
    const yMax = balances.length
      ? Math.max(start, ...balances, 0)
      : Math.max(start, 0)
    const pad = Math.max((yMax - yMin) * 0.04, 1)
    const axisMin = yMin - pad
    const axisMax = yMax + pad
    const { deposits, withdrawals } = cashflowMarkers(times, axisMin, axisMax)

    return {
      ...base,
      grid: { ...base.grid, top: 22, right: 36 },
      tooltip: {
        ...base.tooltip,
        formatter: (params) => {
          const list = Array.isArray(params) ? params : [params]
          const p =
            list.find(
              (x) => x.seriesName === '入金' || x.seriesName === '出金',
            ) ??
            list.find((x) => x.seriesName === '净值') ??
            list[0]
          const idx = typeof p?.dataIndex === 'number' ? p.dataIndex : -1
          const date = idx >= 0 ? times[idx] : String(p?.name ?? '')
          if (p?.seriesName === '入金' || p?.seriesName === '出金') {
            const raw = p.data as { net?: number } | undefined
            const net = Number(raw?.net ?? 0)
            return `${date}<br/>${p.seriesName} ${money(Math.abs(net))}`
          }
          const bal =
            typeof p?.value === 'number' ? p.value : Number(p?.value ?? 0)
          return `${date}<br/>净值 ${money(bal)}`
        },
      },
      xAxis: {
        ...base.xAxis,
        data: times,
      },
      yAxis: {
        ...base.yAxis,
        min: axisMin,
        max: axisMax,
      },
      series: [
        {
          name: '净值',
          type: 'line',
          showSymbol: false,
          data: balances,
          lineStyle: { color: '#7698ff', width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#587cff44' },
                { offset: 1, color: '#587cff02' },
              ],
            },
          },
          markLine: {
            symbol: 'none',
            label: {
              formatter: '起始',
              color: '#7c889f',
              position: 'insideStartTop',
              distance: 8,
            },
            lineStyle: { color: '#56617b', type: 'dashed' },
            data: [{ yAxis: start }],
          },
        },
        {
          name: '入金',
          type: 'scatter',
          data: deposits,
          symbol: 'triangle',
          symbolSize: 11,
          itemStyle: { color: '#35c99c' },
          z: 10,
          tooltip: { trigger: 'item' },
        },
        {
          name: '出金',
          type: 'scatter',
          data: withdrawals,
          symbol: 'triangle',
          symbolSize: 11,
          symbolRotate: 180,
          itemStyle: { color: '#ed7180' },
          z: 10,
          tooltip: { trigger: 'item' },
        },
      ],
    }
  })
  function bars(items: GroupValue[], horizontal = false): EChartsOption {
    const data = items.map((x) => {
      const value = round2(x.value)
      return {
        value,
        itemStyle: {
          color: value >= 0 ? '#35c99c' : '#ed7180',
          borderRadius: horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0],
        },
      }
    })
    return {
      ...base,
      grid: { left: horizontal ? 85 : 55, right: 18, top: 15, bottom: 32 },
      xAxis: horizontal
        ? { ...base.yAxis }
        : { ...base.xAxis, data: items.map((x) => x.name) },
      yAxis: horizontal
        ? {
            ...base.xAxis,
            type: 'category',
            data: items.map((x) => x.name),
            inverse: true,
          }
        : { ...base.yAxis },
      series: [
        {
          type: 'bar',
          barMaxWidth: 28,
          data,
        },
      ],
    }
  }
  const months = computed(() =>
    group(activeTrades.value, (t) => t.time.slice(0, 7)),
  )
  const monthlyOption = computed(() => bars(months.value))
  const symbolOption = computed(() =>
    bars(
      group(activeTrades.value, (t) => t.symbol).sort(
        (a, b) => b.value - a.value,
      ),
      true,
    ),
  )

  /** 账户收益曲线（TWR %） */
  const returnOption = computed<EChartsOption>(() => {
    const periods = twrResult.value.periods
    const times = periods.map((t) => t.timestamp.slice(0, 10))
    const growth = periods.map((t) => round2((t.index - 1) * 100))
    const profits = twrProfitAmounts(periods)
    return {
      ...base,
      tooltip: {
        ...base.tooltip,
        formatter: (params) => {
          const p = Array.isArray(params) ? params[0] : params
          const idx = typeof p?.dataIndex === 'number' ? p.dataIndex : -1
          const pct =
            typeof p?.value === 'number' ? p.value : Number(p?.value ?? 0)
          return growthTooltipHtml(
            idx >= 0 ? times[idx] : String(p?.name ?? ''),
            pct,
            idx >= 0 ? profits[idx] : undefined,
            '收益',
          )
        },
      },
      xAxis: { ...base.xAxis, data: times },
      yAxis: {
        ...base.yAxis,
        axisLabel: {
          color: '#7c889f',
          fontSize: 10,
          formatter: (v: number) => `${formatNum(v)}%`,
        },
      },
      series: [
        {
          name: '收益',
          type: 'line',
          showSymbol: false,
          data: growth,
          lineStyle: { color: '#7698ff', width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#587cff44' },
                { offset: 1, color: '#587cff02' },
              ],
            },
          },
        },
      ],
    }
  })

  /** 账户净值曲线（不含回撤）+ 出入金节点 */
  const equityCleanOption = computed<EChartsOption>(() => {
    const curve = equityCurve.value
    const times = curve.map((t) => t.time.slice(0, 10))
    const balances = curve.map((t) => t.balance)
    const start = round2(curve[0]?.balance ?? initial.value)
    const yMin = balances.length
      ? Math.min(0, start, ...balances)
      : Math.min(0, start)
    const yMax = balances.length
      ? Math.max(start, ...balances, 0)
      : Math.max(start, 0)
    const pad = Math.max((yMax - yMin) * 0.04, 1)
    const axisMin = yMin - pad
    const axisMax = yMax + pad
    const { deposits, withdrawals } = cashflowMarkers(times, axisMin, axisMax)

    return {
      ...base,
      grid: { ...base.grid, right: 36 },
      tooltip: {
        ...base.tooltip,
        formatter: (params) => {
          const list = Array.isArray(params) ? params : [params]
          const p =
            list.find((x) => x.seriesName === '入金' || x.seriesName === '出金') ??
            list.find((x) => x.seriesName === '净值') ??
            list[0]
          const idx = typeof p?.dataIndex === 'number' ? p.dataIndex : -1
          const date = idx >= 0 ? times[idx] : String(p?.name ?? '')
          if (p?.seriesName === '入金' || p?.seriesName === '出金') {
            const raw = p.data as { net?: number } | undefined
            const net = Number(raw?.net ?? 0)
            return `${date}<br/>${p.seriesName} ${money(Math.abs(net))}`
          }
          const bal =
            typeof p?.value === 'number' ? p.value : Number(p?.value ?? 0)
          return `${date}<br/>净值 ${money(bal)}`
        },
      },
      xAxis: {
        ...base.xAxis,
        data: times,
      },
      yAxis: {
        ...base.yAxis,
        min: axisMin,
        max: axisMax,
      },
      series: [
        {
          name: '净值',
          type: 'line',
          showSymbol: false,
          data: balances,
          lineStyle: { color: '#7698ff', width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#587cff44' },
                { offset: 1, color: '#587cff02' },
              ],
            },
          },
          markLine: {
            symbol: 'none',
            label: {
              formatter: '起始',
              color: '#7c889f',
              position: 'insideStartTop',
              distance: 8,
            },
            lineStyle: { color: '#56617b', type: 'dashed' },
            data: [{ yAxis: start }],
          },
        },
        {
          name: '入金',
          type: 'scatter',
          data: deposits,
          symbol: 'triangle',
          symbolSize: 11,
          itemStyle: { color: '#35c99c' },
          z: 10,
          tooltip: { trigger: 'item' },
        },
        {
          name: '出金',
          type: 'scatter',
          data: withdrawals,
          symbol: 'triangle',
          symbolSize: 11,
          symbolRotate: 180,
          itemStyle: { color: '#ed7180' },
          z: 10,
          tooltip: { trigger: 'item' },
        },
      ],
    }
  })

  /** 品种分布百分比；tooltip 显示交易次数 */
  const symbolShareOption = computed<EChartsOption>(() => {
    const counts = new Map<string, number>()
    for (const t of activeTrades.value)
      counts.set(t.symbol, (counts.get(t.symbol) || 0) + 1)
    const rows = [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
    const total = rows.reduce((a, r) => a + r.count, 0) || 1
    const palette = [
      '#7698ff',
      '#35c99c',
      '#ed7180',
      '#f0b429',
      '#a78bfa',
      '#38bdf8',
      '#fb7185',
      '#4ade80',
      '#f97316',
      '#94a3b8',
    ]
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#20293a',
        borderColor: '#344158',
        textStyle: { color: '#edf1fa' },
        formatter: (params) => {
          const p = Array.isArray(params) ? params[0] : params
          const count = Number(p?.value ?? 0)
          const pct = total ? (count / total) * 100 : 0
          return `${p?.name}<br/>占比 ${formatNum(pct)}%<br/>交易次数 ${count}`
        },
      },
      legend: {
        type: 'scroll',
        bottom: 4,
        textStyle: { color: '#8792a8', fontSize: 10 },
      },
      series: [
        {
          type: 'pie',
          radius: ['52%', '72%'],
          center: ['50%', '42%'],
          label: { show: false },
          data: rows.map((r, i) => ({
            name: r.name,
            value: r.count,
            itemStyle: { color: palette[i % palette.length] },
          })),
        },
      ],
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '34%',
          style: {
            text: String(rows.length),
            fontSize: 26,
            fontWeight: 600,
            fill: '#edf1fa',
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '48%',
          style: { text: '交易品种', fontSize: 12, fill: '#8792a8' },
        },
      ],
    }
  })

  /** 各品种多空交易分布（蝴蝶图） */
  const symbolSideOption = computed<EChartsOption>(() => {
    const map = new Map<string, { buy: number; sell: number }>()
    for (const t of activeTrades.value) {
      const row = map.get(t.symbol) || { buy: 0, sell: 0 }
      if (t.direction === 'buy') row.buy++
      else row.sell++
      map.set(t.symbol, row)
    }
    const rows = [...map]
      .map(([name, v]) => ({ name, ...v, total: v.buy + v.sell }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 14)
    const names = rows.map((r) => r.name)
    return {
      ...base,
      legend: {
        data: ['Sell', 'Buy'],
        top: 0,
        textStyle: { color: '#8792a8' },
      },
      grid: { left: 78, right: 28, top: 36, bottom: 28 },
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const list = Array.isArray(params) ? params : [params]
          const name = String(list[0]?.name ?? '')
          const sell = Math.abs(Number(list.find((p) => p.seriesName === 'Sell')?.value ?? 0))
          const buy = Number(list.find((p) => p.seriesName === 'Buy')?.value ?? 0)
          return `${name}<br/>Sell ${sell}<br/>Buy ${buy}`
        },
      },
      xAxis: {
        type: 'value',
        axisLabel: {
          color: '#7c889f',
          fontSize: 10,
          formatter: (v: number) => String(Math.abs(v)),
        },
        splitLine: { lineStyle: { color: '#232b3c', type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: names,
        inverse: true,
        axisLabel: { color: '#7c889f', fontSize: 10 },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#2a3344' } },
      },
      series: [
        {
          name: 'Sell',
          type: 'bar',
          stack: 'side',
          barMaxWidth: 14,
          data: rows.map((r) => -r.sell),
          itemStyle: {
            color: {
              type: 'linear',
              x: 1,
              y: 0,
              x2: 0,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#ed7180' },
                { offset: 1, color: '#ed718055' },
              ],
            },
            borderRadius: [3, 0, 0, 3],
          },
        },
        {
          name: 'Buy',
          type: 'bar',
          stack: 'side',
          barMaxWidth: 14,
          data: rows.map((r) => r.buy),
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#35c99c55' },
                { offset: 1, color: '#35c99c' },
              ],
            },
            borderRadius: [0, 3, 3, 0],
          },
        },
      ],
    }
  })
  const corrMatrix = computed(() =>
    correlation(resolved.value, (t) => {
      if (corrBy.value === 'strategySymbol')
        return `${t.strategy} ${t.symbol}`.trim()
      return t[corrBy.value]
    }),
  )

  /** 单元格固定边长；画布宽高 = 边距 + n × 单元格，数字始终显示在格内。 */
  const corrLayout = computed(() => {
    const names = corrMatrix.value.names
    const n = Math.max(names.length, 1)
    const cell = n > 24 ? 44 : n > 12 ? 40 : 36
    const maxLen = names.reduce((m, s) => Math.max(m, s.length), 4)
    const labelLeft = Math.min(360, Math.max(100, maxLen * 7.5))
    const labelBottom = Math.min(280, Math.max(110, maxLen * 5.8 + 56))
    const plot = n * cell
    return {
      n,
      cell,
      width: Math.round(labelLeft + plot + 40),
      height: Math.round(32 + plot + labelBottom + 52),
      labelLeft,
      labelBottom,
      cellFontSize: n > 24 ? 8 : n > 12 ? 9 : 10,
      axisFontSize: n > 40 ? 9 : 10,
      rotate: 55,
    }
  })

  const corrOption = computed<EChartsOption>(() => {
    const c = corrMatrix.value
    const layout = corrLayout.value
    return {
      ...base,
      tooltip: {
        position: 'top',
        formatter: (params) => {
          const values = heatmapValues(
            (Array.isArray(params) ? params[0] : params).value,
          )
          return `${c.names[values[0]]} / ${c.names[values[1]]}: ${formatNum(values[2])}`
        },
      },
      grid: {
        left: layout.labelLeft,
        right: 24,
        top: 24,
        bottom: layout.labelBottom,
        width: layout.n * layout.cell,
        height: layout.n * layout.cell,
      },
      xAxis: {
        ...base.xAxis,
        data: c.names,
        axisLabel: {
          rotate: layout.rotate,
          color: '#8792a8',
          fontSize: layout.axisFontSize,
          interval: 0,
          hideOverlap: false,
        },
      },
      yAxis: {
        type: 'category',
        data: c.names,
        inverse: true,
        axisLabel: {
          color: '#8792a8',
          fontSize: layout.axisFontSize,
          width: layout.labelLeft - 16,
          overflow: 'truncate',
          ellipsis: '…',
        },
        axisTick: { show: false },
      },
      visualMap: {
        min: -1,
        max: 1,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 8,
        inRange: { color: ['#ed7180', '#222c41', '#35c99c'] },
        textStyle: { color: '#8792a8' },
      },
      series: [
        {
          type: 'heatmap',
          data: c.data.map(([x, y, v]) => [x, y, round2(v)]),
          label: {
            show: true,
            formatter: (p) => formatNum(heatmapValues(p.value)[2]),
            color: '#eef2fa',
            fontSize: layout.cellFontSize,
          },
          itemStyle: {
            borderWidth: 1,
            borderColor: '#171d2b',
          },
        },
      ],
    }
  })
  return {
    usesLedger,
    hasEquityLedger,
    displayCurve,
    equityCurve,
    displayedBalance,
    balanceOption,
    returnOption,
    equityCleanOption,
    symbolShareOption,
    symbolSideOption,
    twrGrowthLabel,
    twrMonthMatrix,
    monthMatrix,
    months,
    monthlyOption,
    symbolOption,
    corrOption,
    corrLayout,
  }
}

/** ECharts 的回调值是联合类型；热图配置只提供 [x, y, coefficient] 元组。 */
function heatmapValues(value: unknown): [number, number, number] {
  if (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((v) => typeof v === 'number')
  )
    return [value[0], value[1], value[2]]
  return [0, 0, 0]
}
