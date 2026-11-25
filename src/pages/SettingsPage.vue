<script setup lang="ts">
import { computed } from 'vue'
import { Upload, Download, Trash2 } from 'lucide-vue-next'
import AppSelect from '../components/AppSelect.vue'
import { useTradeWorkspace } from '../composables/useTradeWorkspace.ts'

const {
  trades,
  initial,
  currency,
  account,
  money,
  downloadBackup,
  restore,
  clearData,
  loadDemo,
  accountRules,
  accountIdOf,
  report,
  removeAccountRules,
  ruleLabel,
} = useTradeWorkspace()

const currencyOptions = ['USD', 'EUR', 'CNY', 'GBP', 'JPY'].map((c) => ({
  value: c,
  label: c,
}))

const archivedAccounts = computed(() =>
  Object.entries(accountRules.value)
    .map(([id, rules]) => ({
      id,
      rules,
      count: rules.length,
      current: accountIdOf(report.value) === id,
    }))
    .filter((a) => a.count > 0)
    .sort((a, b) => a.id.localeCompare(b.id)),
)
</script>

<template>
  <section class="panel form-panel">
    <h2>账户设置</h2>
    <p>
      起始资金由导入报告自动推算：成交账本期间起始大于 0 时用之，否则取首笔入金后的结余；仍无法推算时才使用默认值。不可手动修改。币种切换仅改变显示，不换算汇率；备份恢复会带回当时保存的起始资金。
    </p>
    <div class="settings-grid">
      <label
        >账户名称<input
          class="control-input"
          v-model="account"
          maxlength="40"
      /></label>
      <label
        >起始资金<input
          type="text"
          readonly
          class="control-input readonly-field"
          :value="money(initial)"
      /></label>
      <AppSelect
        label="账户币种"
        v-model="currency"
        :options="currencyOptions"
      />
    </div>
  </section>
  <section class="panel form-panel">
    <h2>数据与备份</h2>
    <p>
      {{ trades.length }}
      笔交易保存在当前浏览器中。备份包含交易、策略规则和账户参数。
    </p>
    <div class="inline-form">
      <button class="button" @click="downloadBackup">
        <Download :size="16" />导出备份</button
      ><label class="button restore"
        ><Upload :size="16" />恢复备份<input
          hidden
          type="file"
          accept=".json"
          @change="restore" /></label
      ><button class="button" @click="loadDemo">载入演示</button
      ><button class="button danger" @click="clearData">
        <Trash2 :size="16" />清除数据
      </button>
    </div>

    <div class="archived-rules">
      <h3>已保存的账号规则</h3>
      <p class="archived-rules-desc">
        按 MT5 账号 ID 归档；再次导入同账号历史时自动复用。可在此手动删除。
      </p>
      <div v-if="archivedAccounts.length" class="table-wrap archived-rules-table">
        <table>
          <thead>
            <tr>
              <th>账号</th>
              <th>规则数</th>
              <th>规则明细</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in archivedAccounts" :key="a.id">
              <td>
                <div class="archived-account-cell">
                  <b>MT5 #{{ a.id }}</b>
                  <span v-if="a.current" class="tag">当前</span>
                </div>
              </td>
              <td>{{ a.count }}</td>
              <td class="archived-rules-detail">
                <div class="rule-remarks-wrap">
                  <span
                    v-for="r in a.rules"
                    :key="a.id + r.name + r.magic"
                    class="tag"
                    >{{ r.name }} · {{ ruleLabel(r) }}</span
                  >
                </div>
              </td>
              <td class="archived-rules-actions">
                <button
                  type="button"
                  class="button danger"
                  title="删除该账号规则"
                  aria-label="删除该账号规则"
                  @click="removeAccountRules(a.id)"
                >
                  <Trash2 :size="14" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="archived-rules-empty">
        暂无已归档规则。在策略管理中配置并导入带账号 ID 的报告后，会显示在这里。
      </p>
    </div>
  </section>
  <section class="panel form-panel">
    <h2>统计口径</h2>
    <p>
      净利润 = 利润 + 手续费 + 库存费 +
      费用。回撤基于已平仓交易的余额峰值，不包含持仓浮亏。夏普比率使用有交易日净盈亏
      / 起始资金计算，年化系数为 √252，未计无风险利率。
    </p>
    <p>
      筛选后的曲线从导入推算的起始资金重新累计。完整报告优先分析历史持仓。策略测试报告没有持仓表时，按开仓与平仓成交配对还原，方向和备注取开仓侧。只有退出成交时才按退出记录统计。EA
      备注通过持仓号或开仓订单关联，不把止损、止盈备注作为策略。
    </p>
  </section>
</template>
