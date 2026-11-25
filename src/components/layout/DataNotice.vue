<script setup lang="ts">
import { ChevronRight, Info } from 'lucide-vue-next'
import { useTradeWorkspace } from '../../composables/useTradeWorkspace.ts'
const { sourceMode, isDemo, uploadOpen } = useTradeWorkspace()
</script>

<template>
  <div v-if="sourceMode === 'deals' && !isDemo" class="demo-banner">
    <Info :size="16" /><span
      >当前使用退出成交记录：交易数与方向按退出成交统计，可能缺失开仓手续费。建议导入历史持仓报告。</span
    >
  </div>
  <div v-if="isDemo" class="demo-banner">
    <Info :size="16" /><span
      >正在查看演示数据。导入 MT5 历史报告或策略测试报告，开始分析你的真实交易。</span
    ><button @click="uploadOpen = true">
      导入我的数据 <ChevronRight :size="14" />
    </button>
  </div>
</template>
