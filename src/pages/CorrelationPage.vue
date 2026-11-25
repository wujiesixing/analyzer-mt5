<script setup lang="ts">
import { onMounted } from 'vue'
import Chart from '../components/Chart.vue'
import { useTradeWorkspace } from '../composables/useTradeWorkspace.ts'

const { corrBy, resolved, corrOption, corrLayout } = useTradeWorkspace()

onMounted(() => {
  corrBy.value = 'strategySymbol'
})
</script>

<template>
  <section class="panel corr-panel">
    <div class="panel-title">
      <h2>每日净盈亏相关系数</h2>
      <div class="corr-meta">
        <span class="subtle"
          >策略 × 品种 · {{ corrLayout.n }} 项 · 格
          {{ corrLayout.cell }}px</span
        >
      </div>
    </div>
    <div v-if="resolved.length" class="corr-scroll">
      <div
        class="corr-canvas"
        :style="{
          width: corrLayout.width + 'px',
          height: corrLayout.height + 'px',
        }"
      >
        <Chart
          :option="corrOption"
          :height="corrLayout.height"
          :width="corrLayout.width"
        />
      </div>
    </div>
    <div v-else class="empty">导入交易后查看相关性。</div>
  </section>
  <p class="footnote">
    按「策略 × 品种」组合计算 Pearson 相关系数（如 Pulse Engine
    BTCUSD），衡量各策略在不同品种上是否同涨同跌。无交易日记为 0；接近 1
    表示同向，接近 −1 表示反向。矩阵随维度变大，单元格固定
    {{ corrLayout.cell }}px，可滚动查看。
  </p>
</template>
