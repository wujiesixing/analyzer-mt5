import { effectScope, nextTick } from 'vue'
import { createTradeWorkspace } from '../src/composables/useTradeWorkspace.ts'

const scope = effectScope()
const w = scope.run(() =>
  createTradeWorkspace({
    storage: { getItem: () => null, setItem: () => {} },
    confirm: () => true,
  }),
)!
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
      strategies: byStrategy.size,
      multi: multi.map(([n, s]) => [n, [...s]]),
      single: single.slice(0, 5).map(([n, s]) => [n, [...s]]),
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
  console.log('multi-strategy facet symbols match', String(facet) === String(expected), {
    facet,
    expected,
    active: w.activeTrades.value.length,
    stats: w.stats.value.count,
    equityPts: w.equitySeries.value.length,
    growth: w.growthPct.value,
  })
  // after strategy filter, equitySeries should not stay at full ledger length if bug
  const fullLedger = w.report.value?.balanceCurve?.length ?? 0
  console.log('ledger vs equitySeries', { fullLedger, equityPts: w.equitySeries.value.length })
}

if (single[0]) {
  const [name, syms] = single[0]
  const sym = [...syms][0]
  w.filters.value = { ...w.filters.value, strategies: [], symbols: [sym] }
  await nextTick()
  console.log('single-symbol facets', {
    symbol: sym,
    strategies: w.filterFacets.value.strategies,
    includesOwner: w.filterFacets.value.strategies.includes(name),
    active: w.activeTrades.value.length,
    equityPts: w.equitySeries.value.length,
    fullLedger: w.report.value?.balanceCurve?.length ?? 0,
  })
}

scope.stop()
