<script setup lang="ts">
import { Upload, Download } from 'lucide-vue-next'
import { useTradeWorkspace } from '../../composables/useTradeWorkspace.ts'
const { page, activeTrades, openImport, exportExcel } = useTradeWorkspace()
import { titles } from '../../config/navigation.ts'
</script>

<template>
  <div class="page-heading">
    <div>
      <h1>{{ titles[page][0] }}</h1>
      <p>{{ titles[page][1] }}</p>
    </div>
    <div class="heading-actions">
      <button class="button" @click="exportExcel(activeTrades)">
        <Download :size="16" />导出数据</button
      ><button class="button primary" @click="openImport">
        <Upload :size="16" />导入 MT5 数据
      </button>
    </div>
  </div>
</template>
