import { effectScope, nextTick } from 'vue'
import { createTradeWorkspace } from '../src/composables/useTradeWorkspace.ts'

const scope = effectScope()
const w = scope.run(() =>
  createTradeWorkspace({
    storage: { getItem: () => null, setItem: () => {} },
    confirm: () => true,
  }),
)
if (!w) throw new Error('workspace missing')

w.loadDemo()
w.navigateTo('analysis')
await nextTick()

const byStrategy = new Map<string, Set<string>>()
for (const t of w.resolved.value) {
  if (!byStrategy.has(t.strategy)) byStrategy.set(t.strategy, new Set())
  byStrategy.get(t.strategy)!.add(t.symbol)
}
const multi = [...byStrategy.entries()].filter(([, s]) => s.size > 1)
const single = [...byStrategy.entries()].filter(([, s]) => s.size === 1)
console.log(
  JSON.stringify(
    {
      trades: w.trades.value.length,
      strategies: byStrategy.size,
      multiSymbolStrategies: multi.map(([n, s]) => [n, [...s]]),
      singleSymbolStrategies: single.slice(0, 5).map(([n, s]) => [n, [...s]]),
      hasLedger: Boolean(w.report.value?.balanceCurve?.length),
    },
    null,
    2,
  ),
)

if (multi[0]) {
  const [name, syms] = multi[0]
  w.filters.value = { ...w.filters.value, strategies: [name], symbols: [] }
  await nextTick()
  const facet = [...w.filterFacets.value.symbols].sort()
  const expected = [...syms].sort()
  console.log(
    JSON.stringify(
      {
        case: 'multi-strategy→symbols',
        strategy: name,
        facetSymbols: facet,
        expected,
        match: JSON.stringify(facet) === JSON.stringify(expected),
        active: w.activeTrades.value.length,
        statsCount: w.stats.value.count,
        growthPct: w.growthPct.value,
        equityPts: w.equitySeries.value.length,
        allTrades: w.trades.value.length,
        syncBugGuess:
          w.equitySeries.value.length > 0 &&
          w.activeTrades.value.length < w.trades.value.length
            ? 'check if equitySeries still full-account when trade filters on'
            : 'ok-or-no-ledger',
      },
      null,
      2,
    ),
  )
}

if (single[0]) {
  const [name, syms] = single[0]
  const sym = [...syms][0]
  w.filters.value = {
    ...w.filters.value,
    strategies: [],
    symbols: [sym],
    direction: '',
    weekday: '',
  }
  await nextTick()
  console.log(
    JSON.stringify(
      {
        case: 'symbol→strategies',
        symbol: sym,
        facetStrategies: w.filterFacets.value.strategies,
        includesOwn: w.filterFacets.value.strategies.includes(name),
        active: w.activeTrades.value.length,
        statsCount: w.stats.value.count,
        kpiNetHint: w.stats.value.net,
        growthPct: w.growthPct.value,
      },
      null,
      2,
    ),
  )
}

scope.stop()
