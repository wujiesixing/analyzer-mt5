<script setup lang="ts">
import {
  Upload,
  Download,
  ShieldCheck,
  FileSpreadsheet,
  X,
} from 'lucide-vue-next'
import { useTradeWorkspace } from '../composables/useTradeWorkspace.ts'
const {
  exportExcel,
  uploadOpen,
  busy,
  error,
  loadFile,
  report,
  accountRules,
  accountIdOf,
} = useTradeWorkspace()

const knownAccounts = () => Object.keys(accountRules.value).sort()
const currentAccountId = () => accountIdOf(report.value)
import { ref } from 'vue'
import { demoTrades } from '../lib/analytics.ts'
const fileInput = ref<HTMLInputElement | null>(null)
async function handleFile(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  await loadFile(input.files?.[0])
  // 重置选择器，允许修正文件后再次选择同一个文件名。
  input.value = ''
}
function handleDrop(event: DragEvent) {
  if (!busy.value) void loadFile(event.dataTransfer?.files[0])
}
function downloadTemplate() {
  exportExcel(demoTrades().slice(0, 5), 'MT5导入模板.xlsx')
}
</script>

<template>
  <div
    v-if="uploadOpen"
    class="modal-overlay"
    @click.self="!busy && (uploadOpen = false)"
  >
    <section
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-title"
    >
      <button
        class="modal-close icon-button"
        aria-label="关闭导入"
        @click="uploadOpen = false"
      >
        <X :size="20" /></button
      ><span class="modal-icon"><FileSpreadsheet :size="30" /></span>
      <h2 id="import-title">导入 MT5 历史数据</h2>
      <p>
        支持 MT5 完整交易历史 Excel（持仓、订单、成交、未平仓及结果），以及策略测试报告
        ReportTester。测试报告按开仓成交还原持仓，用开仓备注归类。自动识别账号
        ID：同账号将复用已保存的策略规则，历史数据直接覆盖。
      </p>
      <p v-if="currentAccountId()" class="import-account-hint">
        当前账号 <b>MT5 #{{ currentAccountId() }}</b>
        <template v-if="accountRules[currentAccountId()]?.length">
          · 已存 {{ accountRules[currentAccountId()]!.length }} 条规则
        </template>
      </p>
      <p
        v-else-if="knownAccounts().length"
        class="import-account-hint"
      >
        已归档账号：{{
          knownAccounts()
            .map((id) => `#${id}`)
            .join('、')
        }}
      </p>
      <div class="drop-zone" @dragover.prevent @drop.prevent="handleDrop">
        <Upload :size="28" /><b>{{
          busy ? '正在解析数据…' : '拖放 Excel 文件到此处'
        }}</b
        ><span>.xlsx、.xls 或 .csv · 最大 30 MB</span
        ><button
          class="button primary"
          :disabled="busy"
          @click="fileInput?.click()"
        >
          选择文件</button
        ><input
          ref="fileInput"
          hidden
          type="file"
          accept=".xlsx,.xls,.csv"
          @change="handleFile"
        />
      </div>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <div class="import-info">
        <ShieldCheck :size="17" /><span
          >文件仅在浏览器内解析。导入覆盖历史交易；策略规则按账号 ID
          保存复用。建议先备份。</span
        >
      </div>
      <div class="modal-bottom">
        <span>支持 MT5 多分区中文报告</span
        ><button @click="downloadTemplate">
          下载示例模板<Download :size="14" />
        </button>
      </div>
    </section>
  </div>
</template>
