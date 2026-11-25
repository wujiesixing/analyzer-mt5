<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import type { PageId } from './types/trading.ts'
import { provideTradeWorkspace } from './composables/useTradeWorkspace.ts'
import AppSidebar from './components/layout/AppSidebar.vue'
import AppTopbar from './components/layout/AppTopbar.vue'
import PageHeading from './components/layout/PageHeading.vue'
import DataNotice from './components/layout/DataNotice.vue'
import AppFooter from './components/layout/AppFooter.vue'
import StatusToast from './components/layout/StatusToast.vue'
import ImportDialog from './components/ImportDialog.vue'
import DashboardPage from './pages/DashboardPage.vue'
import AnalysisPage from './pages/AnalysisPage.vue'
import TradesPage from './pages/TradesPage.vue'
import FundsPage from './pages/FundsPage.vue'
import StrategiesPage from './pages/StrategiesPage.vue'
import CorrelationPage from './pages/CorrelationPage.vue'
import SettingsPage from './pages/SettingsPage.vue'

const { page, mobile } = provideTradeWorkspace()
const pages: Record<PageId, Component> = {
  dashboard: DashboardPage,
  analysis: AnalysisPage,
  trades: TradesPage,
  funds: FundsPage,
  strategies: StrategiesPage,
  correlation: CorrelationPage,
  settings: SettingsPage,
}
const currentPage = computed(() => pages[page.value] || DashboardPage)
</script>

<template>
  <div class="app-shell">
    <AppSidebar />
    <div v-if="mobile" class="sidebar-overlay" @click="mobile = false" />
    <main>
      <AppTopbar />
      <div class="content">
        <PageHeading />
        <DataNotice />
        <component :is="currentPage" />
        <AppFooter />
      </div>
    </main>
    <StatusToast />
    <ImportDialog />
  </div>
</template>
