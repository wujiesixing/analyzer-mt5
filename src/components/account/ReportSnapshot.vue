<script setup lang="ts">
import { computed } from 'vue'
import { useTradeWorkspace } from '../../composables/useTradeWorkspace.ts'

const { report, initial, currency, money, displayedBalance } =
  useTradeWorkspace()

/** 入金为正、出金为负；初始入金取首笔正入金，否则用分析起始资金。 */
const cashSummary = computed(() => {
  const flows = report.value?.cashflows ?? []
  const deposits = flows.filter((t) => t.net > 0)
  const withdrawals = flows.filter((t) => t.net < 0)
  const totalDeposit = deposits.reduce((a, t) => a + t.net, 0)
  const totalWithdrawal = -withdrawals.reduce((a, t) => a + t.net, 0)
  const firstDeposit = deposits[0]?.net
  return {
    equity:
      report.value?.balance ??
      report.value?.ledgerEndBalance ??
      displayedBalance.value,
    initialDeposit:
      firstDeposit !== undefined && firstDeposit > 0
        ? firstDeposit
        : (report.value?.initial ?? initial.value),
    totalDeposit,
    totalWithdrawal,
  }
})
</script>

<template>
  <section v-if="report" class="panel report-overview">
    <div class="panel-title">
      <h2>报告账户快照</h2>
      <span class="subtle"
        >{{ report.date || '导入时' }} · {{ report.currency || currency }}</span
      >
    </div>
    <div class="report-summary snapshot-metrics">
      <div>
        <span>净值</span><b>{{ money(cashSummary.equity) }}</b>
      </div>
      <div>
        <span>初始入金</span><b>{{ money(cashSummary.initialDeposit) }}</b>
      </div>
      <div>
        <span>出金</span><b>{{ money(cashSummary.totalWithdrawal) }}</b>
      </div>
      <div>
        <span>总入金</span><b>{{ money(cashSummary.totalDeposit) }}</b>
      </div>
    </div>
  </section>
</template>
