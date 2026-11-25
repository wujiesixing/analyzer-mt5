import type {
  Trade,
  TradeOutcome,
  TradeMetrics,
  GroupValue,
  SimulationResult,
} from '../types/trading.ts'
import { round2, type TwrMonthlyMatrix } from './twr.ts'

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
export function metrics(
  trades: readonly TradeOutcome[],
  initial = 50000,
): TradeMetrics {
  // 按平仓时间累计余额；峰值回撤不包含未平仓浮亏或资金调整。
  const ordered = [...trades].sort((a, b) => a.time.localeCompare(b.time))
  const wins = ordered.filter((t) => t.net > 0),
    losses = ordered.filter((t) => t.net < 0)
  const profit = sum(wins.map((t) => t.net)),
    loss = -sum(losses.map((t) => t.net))
  let balance = initial,
    peak = initial,
    dd = 0
  const curve = ordered.map((t) => {
    balance += t.net
    peak = Math.max(peak, balance)
    const drawdown = peak - balance
    dd = Math.max(dd, drawdown)
    return {
      time: t.time,
      balance: round2(balance),
      drawdown: round2(drawdown),
    }
  })
  // 夏普使用有交易日净盈亏 / 固定起始资金，采用样本标准差和 √252 年化。
  const daily = group(ordered, (t) => t.time.slice(0, 10))
  const returns = daily.map((x) => x.value / initial)
  const mean = returns.length ? sum(returns) / returns.length : 0
  const sd =
    returns.length > 1
      ? Math.sqrt(
          sum(returns.map((r) => (r - mean) ** 2)) / (returns.length - 1),
        )
      : 0
  const net = round2(profit - loss)
  return {
    count: ordered.length,
    net,
    winRate: round2(
      ordered.length ? (wins.length / ordered.length) * 100 : 0,
    ),
    wins: wins.length,
    losses: losses.length,
    breakEven: ordered.filter((t) => t.net === 0).length,
    factor: loss ? round2(profit / loss) : profit ? Infinity : 0,
    dd: round2(dd),
    sharpe: round2(sd ? (mean / sd) * Math.sqrt(252) : 0),
    avgWin: round2(wins.length ? profit / wins.length : 0),
    avgLoss: round2(losses.length ? loss / losses.length : 0),
    expectancy: round2(
      ordered.length ? (profit - loss) / ordered.length : 0,
    ),
    curve,
    recovery: round2(dd ? (profit - loss) / dd : 0),
  }
}
export function group<T extends { net: number }>(
  trades: readonly T[],
  key: (trade: T) => string,
): GroupValue[] {
  const map = new Map<string, number>()
  for (const t of trades) {
    const k = key(t)
    map.set(k, (map.get(k) || 0) + t.net)
  }
  return [...map]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([name, value]) => ({ name, value: round2(value) }))
}

export interface MonthCell {
  month: number
  value: number | null
}
export interface YearRow {
  year: number
  months: MonthCell[]
  total: number
}
export interface MonthlyMatrix {
  years: YearRow[]
  grandTotal: number
}

/** 按年×月聚合净盈亏，用于 MQL 风格收益表。 */
export function monthlyMatrix(
  trades: readonly TradeOutcome[],
): MonthlyMatrix {
  const map = new Map<string, number>()
  for (const t of trades) {
    const key = t.time.slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(key)) continue
    map.set(key, (map.get(key) || 0) + t.net)
  }
  const years = [...new Set([...map.keys()].map((k) => Number(k.slice(0, 4))))]
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b)
  const rows: YearRow[] = years.map((year) => {
    const months: MonthCell[] = Array.from({ length: 12 }, (_, i) => {
      const key = `${year}-${String(i + 1).padStart(2, '0')}`
      return {
        month: i + 1,
        value: map.has(key) ? map.get(key)! : null,
      }
    })
    return {
      year,
      months: months.map((m) => ({
        ...m,
        value: m.value === null ? null : round2(m.value),
      })),
      total: round2(sum(months.map((m) => m.value || 0))),
    }
  })
  return {
    years: rows,
    grandTotal: round2(sum(rows.map((r) => r.total))),
  }
}

export interface PnlHeatCell {
  month: number
  /** 当月已平仓净利润；无交易为 null */
  profit: number | null
  /** 当月 TWR（小数）；无数据为 null */
  returnRate: number | null
  trades: number
}

export interface PnlHeatYearRow {
  year: number
  months: PnlHeatCell[]
  profitTotal: number
  returnTotal: number
  tradesTotal: number
}

/** MQL 风格月度盈亏热力表：金额 + TWR% + 交易次数。 */
export interface PnlHeatmap {
  years: PnlHeatYearRow[]
  monthProfitTotals: (number | null)[]
  monthTradeTotals: number[]
  grandProfit: number
  grandReturn: number
  grandTrades: number
}

export function monthlyPnlHeatmap(
  trades: readonly TradeOutcome[],
  twr: TwrMonthlyMatrix,
): PnlHeatmap {
  const profitMap = new Map<string, number>()
  const tradeMap = new Map<string, number>()
  for (const t of trades) {
    const key = t.time.slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(key)) continue
    profitMap.set(key, (profitMap.get(key) || 0) + t.net)
    tradeMap.set(key, (tradeMap.get(key) || 0) + 1)
  }
  const twrByKey = new Map<string, number>()
  const twrYearTotal = new Map<number, number>()
  for (const y of twr.years) {
    twrYearTotal.set(y.year, y.total)
    for (const m of y.months) {
      if (m.value === null) continue
      twrByKey.set(
        `${y.year}-${String(m.month).padStart(2, '0')}`,
        m.value,
      )
    }
  }
  const years = [
    ...new Set([
      ...[...profitMap.keys()].map((k) => Number(k.slice(0, 4))),
      ...twr.years.map((y) => y.year),
    ]),
  ]
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => a - b)

  const rows: PnlHeatYearRow[] = years.map((year) => {
    const months: PnlHeatCell[] = Array.from({ length: 12 }, (_, i) => {
      const key = `${year}-${String(i + 1).padStart(2, '0')}`
      const hasProfit = profitMap.has(key)
      const hasTwr = twrByKey.has(key)
      return {
        month: i + 1,
        profit: hasProfit ? round2(profitMap.get(key)!) : null,
        returnRate: hasTwr ? twrByKey.get(key)! : null,
        trades: tradeMap.get(key) || 0,
      }
    })
    return {
      year,
      months,
      profitTotal: round2(sum(months.map((m) => m.profit || 0))),
      returnTotal: twrYearTotal.get(year) ?? 0,
      tradesTotal: sum(months.map((m) => m.trades)),
    }
  })

  const monthProfitTotals = Array.from({ length: 12 }, (_, i) => {
    const vals = rows
      .map((r) => r.months[i].profit)
      .filter((v): v is number => v !== null)
    return vals.length ? round2(sum(vals)) : null
  })
  const monthTradeTotals = Array.from({ length: 12 }, (_, i) =>
    sum(rows.map((r) => r.months[i].trades)),
  )

  return {
    years: rows,
    monthProfitTotals,
    monthTradeTotals,
    grandProfit: round2(sum(rows.map((r) => r.profitTotal))),
    grandReturn: twr.grandTotal,
    grandTrades: sum(rows.map((r) => r.tradesTotal)),
  }
}
export function correlation<T extends TradeOutcome>(
  trades: readonly T[],
  key: (trade: T) => string,
): { names: string[]; data: [number, number, number][] } {
  const names = [...new Set(trades.map(key))].sort()
  // 所有策略采用同一日期集合；没有交易的策略当日盈亏记为 0。
  const days = [...new Set(trades.map((t) => t.time.slice(0, 10)))].sort()
  const series = names.map((n) => {
    const m = new Map(
      group(
        trades.filter((t) => key(t) === n),
        (t) => t.time.slice(0, 10),
      ).map((x) => [x.name, x.value]),
    )
    return days.map((d) => m.get(d) || 0)
  })
  return {
    names,
    data: names.flatMap((_, i) =>
      names.map((__, j): [number, number, number] => {
        const a = series[i],
          b = series[j],
          ma = sum(a) / a.length,
          mb = sum(b) / b.length
        // 常量序列没有可定义的 Pearson 相关系数，界面统一显示为 0。
        const denom = Math.sqrt(
          sum(a.map((v) => (v - ma) ** 2)) * sum(b.map((v) => (v - mb) ** 2)),
        )
        return [
          i,
          j,
          denom ? sum(a.map((v, k) => (v - ma) * (b[k] - mb))) / denom : 0,
        ]
      }),
    ),
  }
}
export function simulate(
  trades: readonly TradeOutcome[],
  initial: number,
  runs = 300,
  random = Math.random,
): SimulationResult | null {
  if (!trades.length) return null
  const steps = Math.min(trades.length, 1000),
    paths: number[][] = [],
    ends: number[] = [],
    dds: number[] = []
  // 有放回抽样固定金额盈亏；上限 1000 笔控制浏览器计算量，不模拟复利。
  for (let r = 0; r < runs; r++) {
    let balance = initial,
      peak = initial,
      dd = 0
    const path = [balance]
    for (let i = 0; i < steps; i++) {
      balance += trades[Math.floor(random() * trades.length)].net
      peak = Math.max(peak, balance)
      dd = Math.max(dd, peak - balance)
      path.push(balance)
    }
    paths.push(path)
    ends.push(balance)
    dds.push(dd)
  }
  const quantile = (xs: number[], p: number) =>
    [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * p)]
  // 每条曲线是每一步的横截面分位数，不是一条实际抽样路径。
  return {
    steps,
    lines: [0.05, 0.5, 0.95].map((p) =>
      Array.from({ length: steps + 1 }, (_, i) =>
        quantile(
          paths.map((x) => x[i]),
          p,
        ),
      ),
    ),
    lossProbability: (ends.filter((v) => v < initial).length / runs) * 100,
    median: quantile(ends, 0.5),
    dd95: quantile(dds, 0.95),
  }
}
export function demoTrades(): Trade[] {
  let seed = 42
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  const symbols = ['XAUUSD', 'USTEC', 'DE40', 'EURUSD', 'GBPUSD']
  const names = ['区间突破', '趋势跟随', '周二反转']
  return Array.from({ length: 1486 }, (_, i) => {
    const date = new Date(Date.UTC(2024, 0, 2) + (i * 86400000) / 1.65)
    const s = i % 3,
      profit = random() > 0.46 ? 80 + random() * 540 : -(70 + random() * 470)
    return {
      id: String(100001 + i),
      time: date.toISOString().slice(0, 19),
      symbol: symbols[i % 5],
      direction: random() > 0.35 ? 'buy' : 'sell',
      volume: [0.1, 0.2, 0.5, 1][i % 4],
      profit: Math.round(profit * 100) / 100,
      commission: -2.5,
      swap: i % 9 === 0 ? -1.2 : 0,
      net: Math.round((profit - 2.5 - (i % 9 === 0 ? 1.2 : 0)) * 100) / 100,
      magic: String(100 + s),
      strategy: names[s],
      comment: names[s],
    }
  })
}
