import * as XLSX from 'xlsx'
import type {
  Trade,
  LedgerRecord,
  AccountReport,
  ReportMetadata,
  ImportResult,
} from '../types/trading.ts'
const aliases = {
  time: ['time', '时间', '开仓时间', '开价时间', 'open time', 'opening time'],
  closeTime: ['close time', 'closing time', '平仓时间'],
  id: ['ticket', 'position', '持仓', '单号', 'deal', '成交'],
  orderId: ['order', '订单'],
  symbol: ['symbol', '品种', '交易品种'],
  direction: ['type', '类型', '方向'],
  volume: ['volume', '交易量', '手数'],
  profit: ['profit', '利润', '盈利', '盈亏'],
  commission: ['commission', '手续费', '佣金'],
  swap: ['swap', '库存费', '隔夜利息'],
  fee: ['fee', '费用'],
  magic: ['magic', 'magic number', '魔术号'],
  comment: ['comment', '注释', '备注'],
  entry: ['entry', '趋势', '进出', '进入'],
  balance: ['balance', '结余', '余额'],
  price: ['price', '价位', '开仓价'],
  closePrice: ['close price', '平仓价'],
  marketPrice: ['market price', '市场价位'],
  stopLoss: ['s / l', 's/l', '止损'],
  takeProfit: ['t / p', 't/p', '止盈'],
  status: ['state', 'status', '状态'],
}
type ColumnKey = keyof typeof aliases
type Columns = Partial<Record<ColumnKey, number>>
type SectionKind = 'closed' | 'open' | 'deals' | 'orders' | 'other'
interface Section {
  kind: SectionKind
  columns: Columns
  rows: unknown[][]
}
const norm = (x: unknown) =>
  String(x ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
const round = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100 || 0
export function number(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN
  const s = String(v ?? '')
    .trim()
    .replace(/[\s,$€¥]/g, '')
  return s === '' ? 0 : Number(s)
}
export function dateValue(v: unknown): string | null {
  const pad = (n: number) => String(n).padStart(2, '0')
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null
    return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}T${pad(v.getHours())}:${pad(v.getMinutes())}:${pad(v.getSeconds())}`
  }
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    return d
      ? `${d.y}-${pad(d.m)}-${pad(d.d)}T${pad(d.H)}:${pad(d.M)}:${pad(d.S)}`
      : null
  }
  const s = String(v ?? '')
    .trim()
    .replace(/^(\d{4})\.(\d{2})\.(\d{2})/, '$1-$2-$3')
    .replace(' ', 'T')
  return /^\d{4}-\d{2}-\d{2}/.test(s) && !Number.isNaN(new Date(s).getTime())
    ? s.slice(0, 19)
    : null
}
function columnsFor(row: unknown[]): Columns {
  const columns: Columns = {},
    times: number[] = [],
    prices: number[] = []
  row.forEach((v, i) => {
    for (const [key, names] of Object.entries(aliases) as [
      ColumnKey,
      string[],
    ][]) {
      if (names.includes(norm(v))) {
        if (columns[key] === undefined) columns[key] = i
        if (key === 'time') times.push(i)
        if (key === 'price') prices.push(i)
      }
    }
  })
  // MT5 历史持仓有两组时间与价位：第一组开仓，最后一组平仓。
  if (times.length > 1) columns.closeTime = times.at(-1)
  if (columns.time === undefined && columns.closeTime !== undefined)
    columns.time = columns.closeTime
  if (prices.length > 1) columns.closePrice = prices.at(-1)
  return columns
}
function metadataFor(rows: unknown[][]): ReportMetadata {
  const textFields: Record<
    string,
    'account' | 'company' | 'date' | 'currency' | 'expert'
  > = {
    账户: 'account',
    account: 'account',
    公司: 'company',
    company: 'company',
    日期: 'date',
    date: 'date',
    货币: 'currency',
    currency: 'currency',
    专家: 'expert',
    expert: 'expert',
  }
  const numericFields: Record<
    string,
    | 'balance'
    | 'equity'
    | 'floating'
    | 'net'
    | 'grossProfit'
    | 'grossLoss'
    | 'count'
    | 'factor'
    | 'sharpe'
    | 'initialDeposit'
  > = {
    结余: 'balance',
    balance: 'balance',
    净值: 'equity',
    equity: 'equity',
    '浮动 p/l': 'floating',
    'floating p/l': 'floating',
    总净盈利: 'net',
    'total net profit': 'net',
    毛利: 'grossProfit',
    'gross profit': 'grossProfit',
    毛损: 'grossLoss',
    'gross loss': 'grossLoss',
    交易总计: 'count',
    'total trades': 'count',
    盈利因子: 'factor',
    'profit factor': 'factor',
    夏普比率: 'sharpe',
    'sharpe ratio': 'sharpe',
    初始入金: 'initialDeposit',
    'initial deposit': 'initialDeposit',
  }
  const result: ReportMetadata = {}
  // 汇总使用合并单元格，标签后跳过空格，读取第一个非空值。
  for (const row of rows)
    for (let i = 0; i < row.length; i++) {
      const label = norm(row[i])
      if (!/[:：]$/.test(label)) continue
      const name = label.replace(/[:：]$/, '')
      const value = row.slice(i + 1).find((v) => String(v ?? '').trim() !== '')
      if (value === undefined) continue
      if (textFields[name]) result[textFields[name]] = String(value)
      else if ((name === '期间' || name === 'period') && !result.date)
        result.date = String(value)
      else if (numericFields[name]) {
        const parsed = number(value)
        if (Number.isFinite(parsed)) result[numericFields[name]] = parsed
      } else if (
        ['盈利交易 (% 全部)', 'profit trades (% of total)'].includes(name)
      ) {
        const match = String(value).match(/(\d+)\s*\(([\d.]+)%\)/)
        if (match) {
          result.winningTrades = Number(match[1])
          result.winRate = Number(match[2])
        }
      }
    }
  const match = result.account?.match(/^(\d+)\s*\(([A-Z]{3}),\s*([^,)]+)/)
  if (match) {
    result.accountId = match[1]
    result.currency = match[2]
    result.server = match[3]
  }
  return result
}
function isTrade(record: LedgerRecord): record is LedgerRecord & Trade {
  return (
    record.symbol !== '' &&
    (record.direction === 'buy' || record.direction === 'sell')
  )
}
const ENTRY_IN = new Set(['in', '入', '入场'])
const ENTRY_OUT = new Set(['out', 'out by', '出', '出场', '平仓'])
const ENTRY_INOUT = new Set(['in/out', '进出'])
const VOLUME_EPS = 1e-8
interface OpenLot {
  deal: LedgerRecord
  remaining: number
  closedVolume: number
  profit: number
  commission: number
  swap: number
  fee: number
  closeTime: string
  closePrice: number | null
}
function entryKind(entry: string) {
  if (ENTRY_IN.has(entry)) return 'in' as const
  if (ENTRY_OUT.has(entry)) return 'out' as const
  if (ENTRY_INOUT.has(entry)) return 'inout' as const
  return null
}
function share(amount: number, used: number, total: number) {
  return total > 0 ? (amount * used) / total : 0
}
function scaledDeal(
  deal: LedgerRecord,
  volume: number,
  profit: number,
  commission: number,
  swap: number,
  fee: number,
): LedgerRecord {
  return {
    ...deal,
    id: deal.orderId || deal.id,
    volume,
    profit,
    commission,
    swap,
    fee,
    net: round(profit + commission + swap + fee),
    comment: deal.comment,
    strategy: deal.comment || '未分配',
  }
}
/**
 * 策略测试报告没有历史持仓。按时间把开仓成交与反向平仓成交配成一笔持仓：
 * 方向、备注和手续费取开仓侧，盈亏取平仓侧，同一持仓的多次部分平仓合并。
 */
function pairDealPositions(deals: LedgerRecord[]) {
  const queues = new Map<string, OpenLot[]>()
  const finished: OpenLot[] = []
  const closed: LedgerRecord[] = []
  const open: LedgerRecord[] = []
  const queueFor = (symbol: string, direction: string) => {
    const key = `${symbol}\0${direction}`
    let queue = queues.get(key)
    if (!queue) {
      queue = []
      queues.set(key, queue)
    }
    return queue
  }
  const enqueue = (deal: LedgerRecord, volume: number) => {
    if (volume <= VOLUME_EPS) return
    queueFor(deal.symbol, deal.direction).push({
      deal,
      remaining: volume,
      closedVolume: 0,
      profit: 0,
      commission: 0,
      swap: 0,
      fee: 0,
      closeTime: deal.time,
      closePrice: null,
    })
  }
  const closeAgainst = (exit: LedgerRecord, volume: number) => {
    const openDir = exit.direction === 'buy' ? 'sell' : 'buy'
    const queue = queueFor(exit.symbol, openDir)
    let left = volume
    while (left > VOLUME_EPS && queue.length) {
      const lot = queue[0]
      const used = Math.min(lot.remaining, left)
      lot.profit += share(exit.profit, used, exit.volume)
      lot.commission += share(exit.commission, used, exit.volume)
      lot.swap += share(exit.swap, used, exit.volume)
      lot.fee += share(exit.fee || 0, used, exit.volume)
      lot.closedVolume += used
      lot.remaining -= used
      lot.closeTime = exit.time
      if (exit.openPrice !== null && exit.openPrice !== undefined)
        lot.closePrice = exit.openPrice
      left -= used
      if (lot.remaining <= VOLUME_EPS) {
        lot.remaining = 0
        finished.push(lot)
        queue.shift()
      }
    }
    return left
  }
  const sorted = deals.filter(isTrade).sort((a, b) => {
    const byTime = a.time.localeCompare(b.time)
    if (byTime) return byTime
    const na = Number(a.id),
      nb = Number(b.id)
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
    return a.id.localeCompare(b.id)
  })
  for (const deal of sorted) {
    const kind = entryKind(deal.entry)
    if (kind === 'in') enqueue(deal, deal.volume)
    else if (kind === 'out') {
      const left = closeAgainst(deal, deal.volume)
      if (left > VOLUME_EPS) {
        const ratio = deal.volume > 0 ? left / deal.volume : 1
        closed.push(
          scaledDeal(
            deal,
            left,
            round(deal.profit * ratio),
            round(deal.commission * ratio),
            round(deal.swap * ratio),
            round((deal.fee || 0) * ratio),
          ),
        )
      }
    } else if (kind === 'inout') {
      const left = closeAgainst(deal, deal.volume)
      if (left > VOLUME_EPS) {
        const ratio = deal.volume > 0 ? left / deal.volume : 1
        enqueue(
          {
            ...deal,
            volume: left,
            profit: deal.profit * ratio,
            commission: deal.commission * ratio,
            swap: deal.swap * ratio,
            fee: (deal.fee || 0) * ratio,
            entry: 'in',
          },
          left,
        )
      }
    }
  }
  for (const queue of queues.values())
    for (const lot of queue) {
      if (lot.closedVolume > VOLUME_EPS) finished.push(lot)
      if (lot.remaining > VOLUME_EPS) {
        const ratio =
          lot.deal.volume > 0 ? lot.remaining / lot.deal.volume : 1
        open.push(
          scaledDeal(
            { ...lot.deal, entry: 'in', closePrice: null },
            lot.remaining,
            round(lot.deal.profit * ratio),
            round(lot.deal.commission * ratio),
            round(lot.deal.swap * ratio),
            round((lot.deal.fee || 0) * ratio),
          ),
        )
      }
    }
  for (const lot of finished) {
    if (lot.closedVolume <= VOLUME_EPS) continue
    const fully = lot.remaining <= VOLUME_EPS
    const ratio =
      fully || !(lot.deal.volume > 0) ? 1 : lot.closedVolume / lot.deal.volume
    closed.push(
      scaledDeal(
        {
          ...lot.deal,
          time: lot.closeTime,
          openTime: lot.deal.openTime || lot.deal.time,
          openPrice: lot.deal.openPrice,
          closePrice: lot.closePrice,
          entry: 'out',
          balance: null,
        },
        fully ? lot.deal.volume : lot.closedVolume,
        round(lot.deal.profit * ratio + lot.profit),
        round(lot.deal.commission * ratio + lot.commission),
        round(lot.deal.swap * ratio + lot.swap),
        round((lot.deal.fee || 0) * ratio + lot.fee),
      ),
    )
  }
  return { closed, open }
}
export function parseRows(rows: unknown[][]): ImportResult {
  const sections: Section[] = []
  let section: Section | null = null
  for (const row of rows) {
    const columns = columnsFor(row)
    if (
      columns.symbol !== undefined &&
      columns.direction !== undefined &&
      columns.time !== undefined
    ) {
      const kind =
        columns.entry !== undefined
          ? 'deals'
          : columns.marketPrice !== undefined && columns.profit !== undefined
            ? 'open'
            : columns.status !== undefined
              ? 'orders'
              : columns.profit !== undefined
                ? 'closed'
                : 'other'
      section = { kind, columns, rows: [] }
      sections.push(section)
      continue
    }
    // 分区标题终止当前表格，避免把没有盈利列的订单或未平仓误读成历史持仓。
    if (
      row.filter((v) => String(v ?? '').trim()).length === 1 &&
      [
        '持仓',
        '订单',
        '成交',
        '工作订单',
        '结果',
        'positions',
        'orders',
        'deals',
        'working orders',
        'results',
      ].includes(norm(row.find((v) => String(v ?? '').trim())))
    ) {
      section = null
      continue
    }
    if (section) section.rows.push(row)
  }
  let skipped = 0
  const records: Record<Exclude<SectionKind, 'other'>, LedgerRecord[]> = {
    closed: [],
    open: [],
    deals: [],
    orders: [],
  }
  for (const s of sections) {
    if (s.kind === 'other') continue
    for (const row of s.rows) {
      const get = (key: ColumnKey): unknown =>
        s.columns[key] === undefined ? undefined : row[s.columns[key]]
      const rawDirection = norm(get('direction')),
        symbol = String(get('symbol') ?? '').trim()
      const isTrade =
        symbol &&
        ['buy', 'sell', '买入', '卖出', '买', '卖'].includes(rawDirection)
      const isCash =
        s.kind === 'deals' &&
        [
          'balance',
          'credit',
          'charge',
          'correction',
          'bonus',
          'commission',
          '结余',
          '余额',
          '信用',
        ].includes(rawDirection)
      if (!isTrade && !isCash) continue
      const openTime = dateValue(get('time')),
        time = dateValue(get('closeTime') || get('time'))
      const volume =
        s.kind === 'orders'
          ? number(String(get('volume') ?? '').split('/')[0])
          : number(get('volume'))
      const profit = number(get('profit')),
        commission = number(get('commission')),
        swap = number(get('swap')),
        fee = number(get('fee'))
      if (
        !time ||
        !openTime ||
        ![volume, profit, commission, swap, fee].every(Number.isFinite)
      ) {
        skipped++
        continue
      }
      const comment = String(get('comment') ?? '').trim()
      const price = get('price'),
        closePrice = get('closePrice')
      records[s.kind].push({
        id: String(
          get('id') ?? get('orderId') ?? `row-${records[s.kind].length}`,
        ),
        orderId: String(get('orderId') ?? ''),
        time,
        openTime,
        symbol,
        direction: isCash
          ? rawDirection
          : ['buy', '买入', '买'].includes(rawDirection)
            ? 'buy'
            : 'sell',
        volume,
        profit,
        commission,
        swap,
        fee,
        net: round(profit + commission + swap + fee),
        magic: String(get('magic') ?? '').trim(),
        strategy: comment || '未分配',
        comment,
        openPrice: price === undefined || price === '' ? null : number(price),
        closePrice:
          closePrice === undefined || closePrice === ''
            ? null
            : number(closePrice),
        marketPrice:
          get('marketPrice') === undefined ? null : number(get('marketPrice')),
        entry: norm(get('entry')),
        balance:
          get('balance') === undefined || get('balance') === ''
            ? null
            : number(get('balance')),
      })
    }
  }
  // 历史持仓号对应开仓成交的订单号；退出订单号不同，不能拿止损/止盈备注识别 EA。
  const openingByOrder = new Map<string, LedgerRecord>(),
    ordersById = new Map(records.orders.map((t) => [t.id, t]))
  for (const d of records.deals.filter((d) => entryKind(d.entry) === 'in'))
    if (!openingByOrder.has(d.orderId)) openingByOrder.set(d.orderId, d)
  // 没有历史持仓、但成交里有开仓记录时（策略测试报告），还原成持仓再统计。
  if (
    !records.closed.length &&
    records.deals.some((d) => {
      const kind = entryKind(d.entry)
      return kind === 'in' || kind === 'inout'
    })
  ) {
    const paired = pairDealPositions(records.deals)
    records.closed.push(...paired.closed)
    records.open.push(...paired.open)
  }
  for (const t of [...records.closed, ...records.open]) {
    const source = openingByOrder.get(t.id) || ordersById.get(t.id)
    if (!t.comment && source?.comment) {
      t.comment = source.comment
      t.strategy = source.comment
    }
    if (!t.magic && source?.magic) t.magic = source.magic
    if (t.openTime && t.time !== t.openTime)
      t.durationMinutes =
        (new Date(t.time).getTime() - new Date(t.openTime).getTime()) / 60000
  }
  // 有历史持仓时只统计持仓，成交仅用于补充策略和余额，避免重复计数与手续费。
  const dealMode = !records.closed.length
  const trades = (
    dealMode
      ? records.deals.filter(
          (t) =>
            t.symbol &&
            ['out', 'out by', 'in/out', '出', '出场', '平仓'].includes(t.entry),
        )
      : records.closed
  )
    .filter(isTrade)
    .sort((a, b) => a.time.localeCompare(b.time))
  if (!trades.length)
    throw new Error(
      '未找到已平仓交易。支持 MT5 历史报告、策略测试报告，或下载模板整理后导入。',
    )
  const report: AccountReport = {
    ...metadataFor(rows),
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
  }
  const ledger = records.deals
    .filter(
      (t): t is LedgerRecord & { balance: number } =>
        t.balance !== null && Number.isFinite(t.balance),
    )
    .sort((a, b) => a.time.localeCompare(b.time))
  if (ledger.length) {
    // 期间起始 = 首笔结余 − 该笔净变动（可为 0，例如报告以入金开场）。
    const periodStart = round(ledger[0].balance - ledger[0].net)
    report.periodStart = periodStart
    // 分析用起始资金：期间起始 > 0 用之；否则取首笔入金后的结余，避免回退到默认 50000。
    report.initial =
      periodStart > 0
        ? periodStart
        : ledger[0].balance > 0
          ? round(ledger[0].balance)
          : undefined
    let peak = periodStart
    report.balanceCurve = ledger.map((t) => {
      peak = Math.max(peak, t.balance)
      return {
        time: t.time,
        balance: t.balance,
        drawdown: round(peak - t.balance),
        // 无品种的 balance/credit 等记为出入金，供 TWR 剔除
        cashFlow: t.symbol ? 0 : t.net,
      }
    })
    report.ledgerEndBalance = ledger[ledger.length - 1].balance
    report.ledgerChange = round(ledger.reduce((a, t) => a + t.net, 0))
    report.reconciliationDifference = round(
      report.ledgerEndBalance - periodStart - report.ledgerChange,
    )
  }
  // 资金调整与未平仓开仓费用单列，不混入已平仓策略收益。
  report.cashflows = records.deals.filter((t) => !t.symbol)
  report.cashflowNet = round(report.cashflows.reduce((a, t) => a + t.net, 0))
  report.openPositions = records.open.filter(isTrade).map((t) => ({
    ...t,
    // 由成交还原的未平仓，净额已按剩余手数分摊；历史报告里的未平仓仍按开仓成交整笔费用。
    openingCost:
      t.entry === 'in' ? t.net : openingByOrder.get(t.id)?.net || 0,
  }))
  report.openingCosts = round(
    report.openPositions.reduce((a, t) => a + t.openingCost, 0),
  )
  report.closedNet = round(trades.reduce((a, t) => a + t.net, 0))
  report.closedProfit = round(trades.reduce((a, t) => a + t.profit, 0))
  report.closedCommission = round(trades.reduce((a, t) => a + t.commission, 0))
  report.closedSwap = round(trades.reduce((a, t) => a + t.swap, 0))
  report.hasMagic = trades.some((t) => t.magic !== '')
  report.strategyMatched = trades.filter((t) => t.comment).length
  // 无账本结余时，用报告期末余额反推期间起始资金。
  if (
    (report.initial === undefined || report.initial <= 0) &&
    report.balance !== undefined &&
    Number.isFinite(report.balance)
  ) {
    const inferred = round(
      report.balance -
        report.closedNet -
        report.cashflowNet -
        report.openingCosts,
    )
    if (inferred > 0) report.initial = inferred
  }
  if (
    (report.initial === undefined || report.initial <= 0) &&
    report.initialDeposit !== undefined &&
    report.initialDeposit > 0
  )
    report.initial = round(report.initialDeposit)
  return { trades, dealMode, skipped, report }
}

/**
 * 从报告推导分析用起始资金。兼容旧存档：report.initial 曾为 0 且 workspace 误存 50000。
 */
export function resolveAnalyticsInitial(
  report: AccountReport | null | undefined,
  fallback = 50000,
): number {
  if (!report) return fallback
  if (report.initial !== undefined && report.initial > 0)
    return round(report.initial)
  if (report.periodStart !== undefined && report.periodStart > 0)
    return round(report.periodStart)
  const funded = report.balanceCurve?.[0]?.balance
  if (funded !== undefined && funded > 0) return round(funded)
  const deposit = report.cashflows.find((c) => c.net > 0)?.net
  if (deposit !== undefined && deposit > 0) return round(deposit)
  if (report.balance !== undefined && Number.isFinite(report.balance)) {
    const inferred = round(
      report.balance -
        report.closedNet -
        report.cashflowNet -
        report.openingCosts,
    )
    if (inferred > 0) return inferred
  }
  return fallback
}

/** 写回 report.initial，便于快照展示与后续保存。 */
export function syncReportInitial(report: AccountReport): AccountReport {
  const resolved = resolveAnalyticsInitial(report, 0)
  if (resolved > 0 && (report.initial === undefined || report.initial <= 0))
    return { ...report, initial: resolved }
  return report
}
export async function importFile(
  file: Pick<Blob, 'size' | 'arrayBuffer'>,
): Promise<ImportResult> {
  if (file.size > 30 * 1024 * 1024)
    throw new Error('文件超过 30 MB，请按时间拆分后导入。')
  const wb = XLSX.read(await file.arrayBuffer(), {
    type: 'array',
    cellDates: true,
  })
  const errors: string[] = []
  for (const name of wb.SheetNames)
    try {
      return {
        ...parseRows(
          XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
            header: 1,
            defval: '',
          }),
        ),
        sheet: name,
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : '文件解析失败')
    }
  throw new Error(errors[0] || '无法识别文件内容')
}
export function exportExcel(trades: readonly Trade[], name = '交易明细.xlsx') {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      trades.map((t) => ({
        开仓时间: (t.openTime || t.time).replace('T', ' '),
        平仓时间: t.time.replace('T', ' '),
        订单: t.id,
        品种: t.symbol,
        类型: t.direction,
        手数: t.volume,
        利润: t.profit,
        手续费: t.commission,
        库存费: t.swap,
        费用: t.fee || 0,
        Magic: t.magic,
        备注: t.strategy,
        开仓价: t.openPrice ?? '',
        平仓价: t.closePrice ?? '',
      })),
    ),
    '历史交易',
  )
  XLSX.writeFile(wb, name)
}
