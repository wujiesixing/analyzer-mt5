<script setup lang="ts">
import { computed } from 'vue'
import { RotateCcw } from 'lucide-vue-next'
import AppSelect from '../AppSelect.vue'
import { useTradeWorkspace } from '../../composables/useTradeWorkspace.ts'
import { weekdays } from '../../config/trading.ts'

const { filters, filterFacets, resetFilters } = useTradeWorkspace()

const symbolOptions = computed(() =>
  filterFacets.value.symbols.map((s) => ({ value: s, label: s })),
)
const strategyOptions = computed(() =>
  filterFacets.value.strategies.map((s) => ({ value: s, label: s })),
)
const directionOptions = computed(() => [
  { value: '', label: '全部方向' },
  ...filterFacets.value.directions.map((d) => ({
    value: d,
    label: d === 'buy' ? '多单' : '空单',
  })),
])
const weekdayOptions = computed(() => [
  { value: '', label: '全部' },
  ...filterFacets.value.weekdays.map((d) => ({
    value: d,
    label: weekdays[d],
  })),
])
</script>

<template>
  <div class="filters panel">
    <label
      >开始日期<input type="date" class="control-input" v-model="filters.from"
    /></label>
    <label
      >结束日期<input type="date" class="control-input" v-model="filters.to"
    /></label>
    <AppSelect
      label="交易品种"
      v-model="filters.symbols"
      :options="symbolOptions"
      multiple
      placeholder="全部品种"
    />
    <AppSelect
      label="策略"
      v-model="filters.strategies"
      :options="strategyOptions"
      multiple
      placeholder="全部策略"
    />
    <AppSelect
      label="交易方向"
      v-model="filters.direction"
      :options="directionOptions"
      placeholder="全部方向"
    />
    <AppSelect
      label="星期"
      v-model="filters.weekday"
      :options="weekdayOptions"
      placeholder="全部"
    />
    <button
      class="icon-button reset"
      title="清除筛选"
      aria-label="清除筛选"
      @click="resetFilters"
    >
      <RotateCcw :size="18" />
    </button>
  </div>
</template>
