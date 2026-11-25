<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import { useTradeWorkspace } from '../composables/useTradeWorkspace.ts'
const { search, currentPage, money, signed, tableTrades, pageCount, rows } =
  useTradeWorkspace()
import TradeFilters from '../components/analysis/TradeFilters.vue'
</script>

<template>
  <TradeFilters />
  <section class="panel">
    <div class="panel-title">
      <h2>
        历史交易 <span class="count">{{ tableTrades.length }}</span>
      </h2>
      <div class="search">
        <Search :size="16" /><input
          v-model="search"
          placeholder="搜索订单、品种或策略"
        />
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>平仓时间</th>
            <th>持仓 / 订单</th>
            <th>开仓时间</th>
            <th>开仓价 / 平仓价</th>
            <th>品种</th>
            <th>方向</th>
            <th>手数</th>
            <th>策略</th>
            <th>手续费</th>
            <th>库存费</th>
            <th>净盈亏</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in rows" :key="t.id + t.time">
            <td>{{ t.time.replace('T', ' ') }}</td>
            <td class="subtle">{{ t.id }}</td>
            <td>{{ t.openTime?.replace('T', ' ') || '—' }}</td>
            <td>{{ t.openPrice ?? '—' }} / {{ t.closePrice ?? '—' }}</td>
            <td>
              <b>{{ t.symbol }}</b>
            </td>
            <td>
              <span :class="['direction', t.direction]">{{
                t.direction === 'buy' ? '多单' : '空单'
              }}</span>
            </td>
            <td>{{ t.volume }}</td>
            <td>{{ t.strategy }}</td>
            <td>{{ money(t.commission) }}</td>
            <td>{{ money(t.swap) }}</td>
            <td :class="t.net >= 0 ? 'positive' : 'negative'">
              {{ signed(t.net) }}
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="11" class="empty">没有匹配的交易。</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="pagination">
      <span>{{ tableTrades.length }} 笔交易 · 每页 20 笔</span>
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
