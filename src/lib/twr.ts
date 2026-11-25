/**
 * 分段时间加权收益率（TWR）。
 * R_i = (equity_i - equity_{i-1} - cash_flow_i) / (equity_{i-1} + cash_flow_i)
 * 出入金记在期初基数上，从收益中剔除。
 */

export interface EquityObservation {
  /** ISO 或报告时间字符串 */
  timestamp: string
  /** 当期结算净值 / 余额 */
  equity: number
  /** 当期出入金净额：入金为正、出金为负；无变动为 0 */
  cashFlow: number
}

export interface TwrPeriod {
  timestamp: string
  equity: number
  cashFlow: number
  /** 单期真实收益率 R_i */
  periodReturn: number
  /** 累积净值指数，初始为 1 */
  index: number
}

export interface TwrResult {
  periods: TwrPeriod[]
  /** index_final - 1 */
  totalReturn: number
  /** 归一化净值曲线，便于画图（index 与相对起点的收益%） */
  curve: { time: string; index: number; returnPct: number }[]
}

const EPS = 1e-12

function finite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

/**
 * 计算时间加权收益与归一化净值指数。
 * 至少需要 1 个观测点；单点时 totalReturn = 0、index = 1。
 */
export function computeTimeWeightedReturn(
  observations: readonly EquityObservation[],
): TwrResult {
  if (!Array.isArray(observations) || observations.length === 0) {
    return { periods: [], totalReturn: 0, curve: [] }
  }

  const ordered = [...observations].sort((a, b) =>
    String(a.timestamp).localeCompare(String(b.timestamp)),
  )

  const periods: TwrPeriod[] = []
  let index = 1

  for (let i = 0; i < ordered.length; i++) {
    const cur = ordered[i]
    const equity = finite(cur.equity) ? cur.equity : 0
    const cashFlow = finite(cur.cashFlow) ? cur.cashFlow : 0
    let periodReturn = 0

    if (i > 0) {
      const prevEquity = finite(ordered[i - 1].equity) ? ordered[i - 1].equity : 0
      const denom = prevEquity + cashFlow
      if (Math.abs(denom) > EPS) {
        periodReturn = (equity - prevEquity - cashFlow) / denom
      }
      if (!Number.isFinite(periodReturn)) periodReturn = 0
      index = index * (1 + periodReturn)
      if (!Number.isFinite(index) || index < 0) index = 0
    }

    periods.push({
      timestamp: String(cur.timestamp),
      equity,
      cashFlow,
      periodReturn,
      index,
    })
  }

  const last = periods[periods.length - 1]
  const totalReturn = last ? last.index - 1 : 0

  return {
    periods,
    totalReturn: Number.isFinite(totalReturn) ? totalReturn : 0,
    curve: periods.map((p) => ({
      time: p.timestamp,
      index: p.index,
      returnPct: (p.index - 1) * 100,
    })),
  }
}

export interface BalanceCurvePoint {
  time: string
  balance: number
  drawdown?: number
  /** 导入时写入；旧存档可能缺失 */
  cashFlow?: number
}

/**
 * 从余额曲线 + 资金调整记录构建 TWR 输入序列。
 * 优先使用点上的 cashFlow；否则按时间与 Δ余额匹配出入金。
 */
export function equitySeriesFromBalanceCurve(
  curve: readonly BalanceCurvePoint[],
  cashflows: readonly { time: string; net: number }[] = [],
): EquityObservation[] {
  if (!curve.length) return []

  const remaining = cashflows
    .filter((c) => finite(c.net) && c.net !== 0)
    .map((c) => ({ time: c.time, net: c.net }))

  const takeCashFlow = (
    time: string,
    expectedDelta: number | null,
  ): number => {
    if (!remaining.length) return 0
    let idx = -1
    if (expectedDelta !== null) {
      idx = remaining.findIndex(
        (c) =>
          c.time === time && Math.abs(c.net - expectedDelta) < 1e-6,
      )
    }
    if (idx < 0) idx = remaining.findIndex((c) => c.time === time)
    if (idx < 0) return 0
    const [hit] = remaining.splice(idx, 1)
    return hit.net
  }

  return curve.map((point, i) => {
    const equity = finite(point.balance) ? point.balance : 0
    let cashFlow = 0
    if (finite(point.cashFlow)) {
      cashFlow = point.cashFlow
    } else if (i === 0) {
      cashFlow = takeCashFlow(point.time, equity)
    } else {
      const prev = finite(curve[i - 1].balance) ? curve[i - 1].balance : 0
      cashFlow = takeCashFlow(point.time, equity - prev)
    }
    return {
      timestamp: point.time,
      equity,
      cashFlow,
    }
  })
}

/** 无账本时：用已平仓盈亏累加构造净值序列（无出入金）。 */
export function equitySeriesFromTrades(
  trades: readonly { time: string; net: number }[],
  initialEquity: number,
): EquityObservation[] {
  const start =
    Number.isFinite(initialEquity) && initialEquity > 0 ? initialEquity : 0
  const ordered = [...trades].sort((a, b) => a.time.localeCompare(b.time))
  if (!ordered.length) {
    return start > 0
      ? [{ timestamp: 'start', equity: start, cashFlow: 0 }]
      : []
  }
  const series: EquityObservation[] = [
    { timestamp: ordered[0].time, equity: start, cashFlow: 0 },
  ]
  let equity = start
  for (const t of ordered) {
    equity += finite(t.net) ? t.net : 0
    series.push({ timestamp: t.time, equity, cashFlow: 0 })
  }
  return series
}

export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** 最多两位小数；整数不补 .00（如 150 → "150"，0.39 → "0.39"）。 */
export function formatNum(n: number, maxDigits = 2): string {
  if (!Number.isFinite(n)) return '0'
  return String(Number(round2(n).toFixed(maxDigits)))
}

export interface TwrMonthCell {
  month: number
  /** 该月 TWR（小数，如 0.05 = 5%）；无数据为 null */
  value: number | null
}
export interface TwrYearRow {
  year: number
  months: TwrMonthCell[]
  /** 年内各月 TWR 连乘 − 1 */
  total: number
}
export interface TwrMonthlyMatrix {
  years: TwrYearRow[]
  /** 全样本 TWR */
  grandTotal: number
}

/** 按年×月计算分段 TWR，用于成长明细表。 */
export function monthlyTwrMatrix(
  observations: readonly EquityObservation[],
): TwrMonthlyMatrix {
  const ordered = [...observations].sort((a, b) =>
    String(a.timestamp).localeCompare(String(b.timestamp)),
  )
  if (!ordered.length) return { years: [], grandTotal: 0 }

  const monthKeys = [
    ...new Set(ordered.map((p) => String(p.timestamp).slice(0, 7))),
  ]
    .filter((k) => /^\d{4}-\d{2}$/.test(k))
    .sort()

  const monthReturn = new Map<string, number>()
  for (const key of monthKeys) {
    let startIdx = 0
    for (let i = 0; i < ordered.length; i++) {
      if (String(ordered[i].timestamp).slice(0, 7) < key) startIdx = i
      else break
    }
    let endIdx = startIdx
    for (let i = 0; i < ordered.length; i++) {
      if (String(ordered[i].timestamp).slice(0, 7) === key) endIdx = i
    }
    const hasInMonth = ordered.some(
      (p) => String(p.timestamp).slice(0, 7) === key,
    )
    if (!hasInMonth) continue
    const slice = ordered.slice(startIdx, endIdx + 1)
    monthReturn.set(key, computeTimeWeightedReturn(slice).totalReturn)
  }

  const years = [...new Set(monthKeys.map((k) => Number(k.slice(0, 4))))].sort(
    (a, b) => a - b,
  )
  const rows: TwrYearRow[] = years.map((year) => {
    const months: TwrMonthCell[] = Array.from({ length: 12 }, (_, i) => {
      const key = `${year}-${String(i + 1).padStart(2, '0')}`
      return {
        month: i + 1,
        value: monthReturn.has(key) ? monthReturn.get(key)! : null,
      }
    })
    const total =
      months.reduce((idx, m) => idx * (1 + (m.value ?? 0)), 1) - 1
    return { year, months, total }
  })

  return {
    years: rows,
    grandTotal: computeTimeWeightedReturn(ordered).totalReturn,
  }
}
