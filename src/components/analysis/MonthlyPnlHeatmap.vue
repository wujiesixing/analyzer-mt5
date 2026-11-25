<script setup lang="ts">
import { ref } from 'vue'
import { CalendarRange } from 'lucide-vue-next'
import type { PnlHeatCell, PnlHeatmap } from '../../lib/analytics.ts'
import { formatNum } from '../../lib/twr.ts'

const props = defineProps<{
  data: PnlHeatmap
  signed: (v: number) => string
}>()

const monthLabels = [
  '一月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '十一月',
  '十二月',
]

const tip = ref<{
  x: number
  y: number
  title: string
  amount: string
  pct: string
  trades: string
} | null>(null)

function tone(profit: number | null, rate: number | null) {
  const v = profit ?? (rate !== null ? rate : null)
  if (v === null || v === 0) return 'empty'
  return v > 0 ? 'positive' : 'negative'
}

function pctText(rate: number | null) {
  if (rate === null) return ''
  const p = roundPct(rate)
  return `${p > 0 ? '+' : ''}${formatNum(p)}%`
}

function roundPct(rate: number) {
  return Math.round(rate * 10000) / 100
}

function showTip(
  e: MouseEvent,
  title: string,
  profit: number | null,
  rate: number | null,
  trades: number,
) {
  if (profit === null && rate === null && trades === 0) {
    tip.value = null
    return
  }
  tip.value = {
    x: e.clientX + 12,
    y: e.clientY + 12,
    title,
    amount: profit === null ? '—' : props.signed(profit),
    pct: rate === null ? '—' : pctText(rate),
    trades: `${trades} 笔`,
  }
}

function moveTip(e: MouseEvent) {
  if (!tip.value) return
  tip.value = { ...tip.value, x: e.clientX + 12, y: e.clientY + 12 }
}

function hideTip() {
  tip.value = null
}

function cellTitle(year: number, cell: PnlHeatCell) {
  return `${year} 年 ${monthLabels[cell.month - 1]}`
}

function hasData(cell: PnlHeatCell) {
  return cell.profit !== null || cell.returnRate !== null
}
</script>

<template>
  <section class="panel monthly-table pnl-heat-panel">
    <div class="panel-title">
      <h2><CalendarRange :size="17" />每月盈亏</h2>
      <span class="subtle">已平仓利润 · 时间加权收益率</span>
    </div>
    <div class="month-matrix-wrap">
      <table class="pnl-heat">
        <thead>
          <tr>
            <th class="heat-year">年份</th>
            <th v-for="label in monthLabels" :key="label">{{ label }}</th>
            <th>总计</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in data.years" :key="row.year">
            <th class="heat-year">{{ row.year }}</th>
            <td
              v-for="cell in row.months"
              :key="cell.month"
              :class="['heat-cell', tone(cell.profit, cell.returnRate)]"
              @mouseenter="
                showTip(
                  $event,
                  cellTitle(row.year, cell),
                  cell.profit,
                  cell.returnRate,
                  cell.trades,
                )
              "
              @mousemove="moveTip"
              @mouseleave="hideTip"
            >
              <template v-if="hasData(cell)">
                <div class="heat-amt">
                  {{ cell.profit !== null ? signed(cell.profit) : '—' }}
                </div>
                <div v-if="cell.returnRate !== null" class="heat-pct">
                  {{ pctText(cell.returnRate) }}
                </div>
              </template>
              <span v-else class="heat-empty">-</span>
            </td>
            <td
              :class="[
                'heat-cell',
                'heat-total',
                tone(row.profitTotal, row.returnTotal),
              ]"
              @mouseenter="
                showTip(
                  $event,
                  `${row.year} 年总计`,
                  row.profitTotal,
                  row.returnTotal,
                  row.tradesTotal,
                )
              "
              @mousemove="moveTip"
              @mouseleave="hideTip"
            >
              <div class="heat-amt">{{ signed(row.profitTotal) }}</div>
              <div class="heat-pct">{{ pctText(row.returnTotal) }}</div>
            </td>
          </tr>
          <tr v-if="data.years.length" class="matrix-total">
            <th class="heat-year">总计</th>
            <td v-for="n in 12" :key="n" class="heat-cell empty">
              <span class="heat-empty">-</span>
            </td>
            <td
              :class="[
                'heat-cell',
                'heat-total',
                tone(data.grandProfit, data.grandReturn),
              ]"
              @mouseenter="
                showTip(
                  $event,
                  '全部总计',
                  data.grandProfit,
                  data.grandReturn,
                  data.grandTrades,
                )
              "
              @mousemove="moveTip"
              @mouseleave="hideTip"
            >
              <div class="heat-amt">{{ signed(data.grandProfit) }}</div>
              <div class="heat-pct">{{ pctText(data.grandReturn) }}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <Teleport to="body">
      <div
        v-if="tip"
        class="pnl-heat-tip"
        :style="{ left: tip.x + 'px', top: tip.y + 'px' }"
      >
        <div class="tip-title">{{ tip.title }}</div>
        <div class="tip-row">
          <span class="tip-dot profit"></span>利润金额 {{ tip.amount }}
        </div>
        <div class="tip-row">
          <span class="tip-dot pct"></span>收益率 {{ tip.pct }}
        </div>
        <div class="tip-row muted">
          <span class="tip-dot"></span>交易次数 {{ tip.trades }}
        </div>
      </div>
    </Teleport>
  </section>
</template>
