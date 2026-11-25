<script setup lang="ts">
import { ChartNoAxesCombined, TrendingUp, PieChart, GitBranch } from 'lucide-vue-next'
import Chart from '../../components/Chart.vue'
import KpiGrid from './KpiGrid.vue'
import MonthlyPnlHeatmap from './MonthlyPnlHeatmap.vue'
import DateRangeSlider from './DateRangeSlider.vue'
import { useTradeWorkspace } from '../../composables/useTradeWorkspace.ts'
import { formatNum } from '../../lib/twr.ts'

const {
  page,
  filters,
  analysisDateSpan,
  drawdown,
  splitStrategies,
  performanceMode,
  stats,
  money,
  signed,
  fmt,
  kpis,
  displayedBalance,
  balanceOption,
  returnOption,
  equityCleanOption,
  symbolShareOption,
  symbolSideOption,
  growthPct,
  avgMonthlyGrowth,
  twrGrowthLabel,
  pnlHeatmap,
  symbolOption,
} = useTradeWorkspace()

function setDateRange(next: { from: string; to: string }) {
  filters.value = { ...filters.value, from: next.from, to: next.to }
}
</script>

<template>
  <KpiGrid :items="kpis" />

  <!-- 总览：五块图表 -->
  <template v-if="page === 'dashboard'">
    <div class="chart-grid">
      <section class="panel">
        <div class="panel-title">
          <h2><TrendingUp :size="17" />账户收益曲线</h2>
        </div>
        <div class="chart-subtitle dual">
          <span
            >{{ formatNum(growthPct) }}%<small>{{ twrGrowthLabel }}</small></span
          >
          <span>{{ formatNum(avgMonthlyGrowth) }}%<small>月均</small></span>
        </div>
        <Chart :option="returnOption" :height="300" />
      </section>
      <section class="panel">
        <div class="panel-title">
          <h2><ChartNoAxesCombined :size="17" />账户净值曲线</h2>
        </div>
        <div class="chart-subtitle">
          {{ money(displayedBalance) }}<small>账户净值</small>
        </div>
        <Chart :option="equityCleanOption" :height="300" />
      </section>
    </div>
    <div class="bottom-charts">
      <section class="panel">
        <div class="panel-title">
          <h2><PieChart :size="17" />品种分布百分比</h2>
        </div>
        <Chart :option="symbolShareOption" :height="255" />
      </section>
      <section class="panel">
        <div class="panel-title">
          <h2>品种收益</h2>
          <span class="subtle">净利润</span>
        </div>
        <Chart :option="symbolOption" :height="255" />
      </section>
      <section class="panel">
        <div class="panel-title">
          <h2><GitBranch :size="17" />各个品种的多空交易分布</h2>
        </div>
        <Chart :option="symbolSideOption" :height="255" />
      </section>
    </div>
    <MonthlyPnlHeatmap :data="pnlHeatmap" :signed="signed" />
  </template>

  <!-- 分析页：成长 / 结余 -->
  <template v-else>
    <div class="chart-grid analysis">
      <section class="panel">
        <div class="panel-title">
          <h2><ChartNoAxesCombined :size="17" />已平仓交易绩效</h2>
          <div class="panel-controls">
            <label class="toggle"
              ><input type="checkbox" v-model="drawdown" />显示回撤</label
            >
            <label
              class="toggle"
              title="每条线从起始资金单独累计该策略的已平仓盈亏"
              ><input type="checkbox" v-model="splitStrategies" />拆分策略</label
            >
            <div class="segmented">
              <button
                type="button"
                :class="{ active: performanceMode === 'growth' }"
                @click="performanceMode = 'growth'"
              >
                成长
              </button>
              <button
                type="button"
                :class="{ active: performanceMode === 'balance' }"
                @click="performanceMode = 'balance'"
              >
                结余
              </button>
            </div>
          </div>
        </div>
        <div class="chart-subtitle dual">
          <template v-if="drawdown">
            <span>{{ money(stats.dd) }}<small>最大回撤</small></span>
            <span>{{ fmt(stats.recovery) }}<small>恢复因子</small></span>
          </template>
          <template v-else-if="performanceMode === 'growth'">
            <span
              >{{ formatNum(growthPct) }}%<small>{{
                twrGrowthLabel
              }}</small></span
            >
            <span
              >{{ formatNum(avgMonthlyGrowth) }}%<small>月均</small></span
            >
          </template>
          <template v-else>
            <span
              >{{ money(displayedBalance)
              }}<small>{{
                splitStrategies ? '合计净值' : '账户净值'
              }}</small></span
            >
            <span>{{ signed(stats.net) }}<small>已平仓净利润</small></span>
          </template>
        </div>
        <p v-if="splitStrategies" class="split-hint">
          每条线从起始资金单独累计该策略的已平仓盈亏。
        </p>
        <Chart :option="balanceOption" :height="420" />
        <DateRangeSlider
          v-if="analysisDateSpan.min && analysisDateSpan.max"
          :min="analysisDateSpan.min"
          :max="analysisDateSpan.max"
          :from="filters.from"
          :to="filters.to"
          @change="setDateRange"
        />
      </section>
    </div>
    <div class="bottom-charts">
      <section class="panel">
        <div class="panel-title">
          <h2><PieChart :size="17" />品种分布百分比</h2>
        </div>
        <Chart :option="symbolShareOption" :height="255" />
      </section>
      <section class="panel">
        <div class="panel-title">
          <h2>品种收益</h2>
          <span class="subtle">净利润</span>
        </div>
        <Chart :option="symbolOption" :height="255" />
      </section>
      <section class="panel">
        <div class="panel-title">
          <h2><GitBranch :size="17" />各个品种的多空交易分布</h2>
        </div>
        <Chart :option="symbolSideOption" :height="255" />
      </section>
    </div>
    <MonthlyPnlHeatmap :data="pnlHeatmap" :signed="signed" />
  </template>

  <div v-if="!stats.count" class="empty">
    暂无交易，请导入数据或调整筛选条件。
  </div>
</template>
