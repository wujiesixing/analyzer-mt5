<script setup lang="ts">
import { computed } from 'vue'
import { useTradeWorkspace } from '../../composables/useTradeWorkspace.ts'

const {
  trades,
  activeTrades,
  page,
  initial,
  currency,
  account,
  money,
} = useTradeWorkspace()

/** 绩效分析 / 交易明细：日期范围跟随当前筛选结果 */
const stripTrades = computed(() =>
  ['analysis', 'trades'].includes(page.value)
    ? activeTrades.value
    : trades.value,
)

const rangeText = computed(() => {
  const list = [...stripTrades.value].sort((a, b) =>
    a.time.localeCompare(b.time),
  )
  if (!list.length) return '— 至 —'
  return `${list[0].time.slice(0, 10)} 至 ${list.at(-1)!.time.slice(0, 10)}`
})

const countHint = computed(() => {
  if (!['analysis', 'trades'].includes(page.value)) return ''
  if (stripTrades.value.length === trades.value.length) return ''
  return ` · 已筛选 ${stripTrades.value.length}/${trades.value.length}`
})
</script>

<template>
  <div class="account-strip">
    <div>
      <span class="status-dot" /><b>{{ account }}</b
      ><span class="tag">{{ currency }}</span
      ><span>起始资金 {{ money(initial) }}</span
      ><span v-if="countHint" class="strip-filter-hint">{{ countHint }}</span>
    </div>
    <span>{{ rangeText }}</span>
  </div>
</template>
