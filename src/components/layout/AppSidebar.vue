<script setup lang="ts">
import {
  ChartNoAxesCombined,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
} from 'lucide-vue-next'
import { useTradeWorkspace } from '../../composables/useTradeWorkspace.ts'
const { isDemo, account, page, mobile, navigateTo } = useTradeWorkspace()
import { nav } from '../../config/navigation.ts'
</script>

<template>
  <aside :class="['sidebar', { open: mobile }]">
    <a class="brand" href="#" @click.prevent="page = 'dashboard'"
      ><span class="brand-mark"><ChartNoAxesCombined :size="24" /></span
      ><span>Trade Lens<small>MT5 交易分析</small></span></a
    >
    <div class="workspace">
      <span class="account-icon">MT</span>
      <div>
        <b>{{ account }}</b
        ><small
          >{{ isDemo ? '演示账户' : '本地账户' }} <span class="status-dot"
        /></small>
      </div>
      <ChevronDown :size="14" />
    </div>
    <nav v-for="section in nav" :key="section.label">
      <p class="nav-label">{{ section.label }}</p>
      <button
        v-for="item in section.items"
        :key="item.id"
        :class="['nav-item', { active: page === item.id }]"
        @click="navigateTo(item.id)"
      >
        <component :is="item.icon" :size="18" /><span>{{ item.name }}</span
        ><ChevronRight v-if="page === item.id" :size="14" />
      </button>
    </nav>
    <div class="sidebar-bottom">
      <div class="privacy">
        <ShieldCheck :size="18" />
        <div>数据仅保存在本机<small>无需上传 · 无需连接账户</small></div>
      </div>
      <div class="version">Trade Lens <span>v1.0</span></div>
    </div>
  </aside>
</template>
