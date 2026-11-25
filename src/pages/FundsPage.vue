<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RotateCcw, Search } from 'lucide-vue-next'
import { useTradeWorkspace } from '../composables/useTradeWorkspace.ts'
import { round2 } from '../lib/twr.ts'

const { report, money, signed } = useTradeWorkspace()
const search = ref('')
const from = ref('')
const to = ref('')
const currentPage = ref(1)
const pageSize = 20

const flows = computed(() => {
  let list = [...(report.value?.cashflows ?? [])].sort((a, b) =>
    b.time.localeCompare(a.time),
  )
  if (from.value) list = list.filter((f) => f.time.slice(0, 10) >= from.value)
  if (to.value) list = list.filter((f) => f.time.slice(0, 10) <= to.value)
  const q = search.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((f) =>
    `${f.time} ${f.id} ${f.orderId} ${f.direction} ${f.comment} ${f.net}`
      .toLowerCase()
      .includes(q),
  )
})

const summary = computed(() => {
  const deposits = flows.value.filter((t) => t.net > 0)
  const withdrawals = flows.value.filter((t) => t.net < 0)
  const totalIn = round2(deposits.reduce((a, t) => a + t.net, 0))
  const totalOut = round2(-withdrawals.reduce((a, t) => a + t.net, 0))
  return {
    count: flows.value.length,
    depositCount: deposits.length,
    withdrawalCount: withdrawals.length,
    totalIn,
    totalOut,
    net: round2(totalIn - totalOut),
  }
})

const pageCount = computed(() =>
  Math.max(1, Math.ceil(flows.value.length / pageSize)),
)
const rows = computed(() => {
  const page = Math.min(currentPage.value, pageCount.value)
  const start = (page - 1) * pageSize
  return flows.value.slice(start, start + pageSize)
})

watch([from, to, search], () => {
  currentPage.value = 1
})
watch(pageCount, (n) => {
  if (currentPage.value > n) currentPage.value = n
})

function resetDateFilter() {
  from.value = ''
  to.value = ''
}

function kindLabel(net: number) {
  if (net > 0) return '入金'
  if (net < 0) return '出金'
  return '其他'
}
</script>

<template>
  <div class="filters panel funds-filters">
    <label
      >开始日期<input type="date" class="control-input" v-model="from"
    /></label>
    <label
      >结束日期<input type="date" class="control-input" v-model="to"
    /></label>
    <button
      class="icon-button reset"
      title="清除时间筛选"
      aria-label="清除时间筛选"
      @click="resetDateFilter"
    >
      <RotateCcw :size="18" />
    </button>
  </div>

  <div class="kpi-grid funds-kpis">
    <div class="kpi blue">
      <span class="kpi-label">记录数</span>
      <strong>{{ summary.count.toLocaleString() }}</strong>
      <small
        >入金 {{ summary.depositCount }} / 出金
        {{ summary.withdrawalCount }}</small
      >
    </div>
    <div class="kpi green">
      <span class="kpi-label">总入金</span>
      <strong>{{ money(summary.totalIn) }}</strong>
    </div>
    <div class="kpi red">
      <span class="kpi-label">总出金</span>
      <strong>{{ money(summary.totalOut) }}</strong>
    </div>
    <div class="kpi" :class="summary.net >= 0 ? 'green' : 'red'">
      <span class="kpi-label">净流入</span>
      <strong>{{ signed(summary.net) }}</strong>
    </div>
  </div>

  <section class="panel">
    <div class="panel-title">
      <h2>
        出入金记录 <span class="count">{{ flows.length }}</span>
      </h2>
      <div class="search">
        <Search :size="16" /><input
          v-model="search"
          placeholder="搜索时间、订单、备注或金额"
        />
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>类型</th>
            <th>订单 / 成交</th>
            <th>方向</th>
            <th>金额</th>
            <th>结余</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="f in rows" :key="f.id + f.time + f.net">
            <td>{{ f.time.replace('T', ' ') }}</td>
            <td>
              <span
                :class="[
                  'direction',
                  f.net > 0 ? 'buy' : f.net < 0 ? 'sell' : '',
                ]"
                >{{ kindLabel(f.net) }}</span
              >
            </td>
            <td class="subtle">{{ f.orderId || f.id || '—' }}</td>
            <td class="subtle">{{ f.direction || '—' }}</td>
            <td :class="f.net >= 0 ? 'positive' : 'negative'">
              {{ signed(f.net) }}
            </td>
            <td>
              {{
                f.balance !== null && f.balance !== undefined
                  ? money(f.balance)
                  : '—'
              }}
            </td>
            <td class="subtle">{{ f.comment || '—' }}</td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="7" class="empty">
              {{
                report
                  ? '暂无出入金记录。'
                  : '请先导入 MT5 报告以查看资金明细。'
              }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="pagination">
      <span>{{ flows.length }} 笔记录 · 每页 {{ pageSize }} 笔</span>
      <div>
        <button
          class="button"
          :disabled="currentPage === 1"
          @click="currentPage--"
        >
          上一页</button
        ><span>{{ currentPage }} / {{ pageCount }}</span
        ><button
          class="button"
          :disabled="currentPage >= pageCount"
          @click="currentPage++"
        >
          下一页
        </button>
      </div>
    </div>
  </section>
</template>
