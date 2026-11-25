<script setup lang="ts">
import { Printer, ChevronRight, Menu } from 'lucide-vue-next'
import { useTradeWorkspace } from '../../composables/useTradeWorkspace.ts'
const { page, mobile, printReport } = useTradeWorkspace()
import { titles } from '../../config/navigation.ts'
</script>

<template>
  <header>
    <div class="breadcrumb">
      <button
        class="mobile-menu icon-button"
        aria-label="打开导航"
        @click="mobile = true"
      >
        <Menu :size="20" /></button
      ><span>工作空间</span><ChevronRight :size="13" /><b>{{
        titles[page][0]
      }}</b>
    </div>
    <div class="header-actions">
      <span class="local-status"><span class="status-dot" /> 本地分析模式</span
      ><button
        class="icon-button"
        title="打印 / 保存 PDF"
        aria-label="打印 / 保存 PDF"
        @click="printReport"
      >
        <Printer :size="17" /></button
      ><span class="avatar">MT</span>
    </div>
  </header>
</template>
