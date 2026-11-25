<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Layers3,
  ChevronRight,
  X,
  Plus,
  LayoutGrid,
  List,
  Pencil,
  Check,
} from 'lucide-vue-next'
import CommentPrefixPicker from '../components/CommentPrefixPicker.vue'
import { useTradeWorkspace } from '../composables/useTradeWorkspace.ts'

const {
  rules,
  ruleName,
  ruleMagics,
  editingRuleName,
  money,
  signed,
  fmt,
  formatNum,
  strategyStats,
  addRule,
  viewStrategy,
  ruleLabel,
  ruleRemarks,
  startEditRule,
  cancelEditRule,
  removeRule,
  claimedComments,
} = useTradeWorkspace()

const viewMode = ref<'cards' | 'list'>('cards')
const showRuleTable = ref(true)

const excludeComments = computed(() =>
  claimedComments(editingRuleName.value || ''),
)

const isEditing = computed(() => !!editingRuleName.value)
</script>

<template>
  <section class="panel form-panel">
    <h2>{{ isEditing ? '编辑策略规则' : '添加策略规则' }}</h2>
    <p>
      按开仓备注识别 EA：输入关键字模糊检索备注，勾选后保存为一条规则（按保存顺序匹配）。点击下方标签可回填编辑。
    </p>
    <form class="inline-form" @submit.prevent="addRule">
      <label
        >策略名称<input
          v-model="ruleName"
          placeholder="例如：黄金区间突破"
          required
      /></label>
      <CommentPrefixPicker
        v-model="ruleMagics"
        :exclude="excludeComments"
      />
      <button
        class="button primary"
        type="submit"
        :disabled="!ruleName.trim() || !ruleMagics.length"
      >
        <Check v-if="isEditing" :size="16" />
        <Plus v-else :size="16" />
        {{ isEditing ? '更新规则' : '保存规则' }}
      </button>
      <button
        v-if="isEditing"
        class="button"
        type="button"
        @click="cancelEditRule"
      >
        取消编辑
      </button>
    </form>
    <div class="rule-list">
      <button
        v-for="r in rules"
        :key="r.name + r.magic"
        type="button"
        class="tag rule-tag"
        :class="{ active: editingRuleName === r.name }"
        :title="'点击编辑：' + r.name"
        @click="startEditRule(r)"
      >
        <span>{{ r.name }} · {{ ruleLabel(r) }}</span>
        <span
          class="rule-tag-remove"
          role="button"
          :aria-label="'删除规则 ' + r.name"
          @click.stop="removeRule(r.name)"
        >
          <X :size="14" />
        </span>
      </button>
    </div>

    <div class="rule-table-toolbar">
      <button
        type="button"
        class="button"
        @click="showRuleTable = !showRuleTable"
      >
        {{ showRuleTable ? '收起规则列表' : '展开规则列表' }}
      </button>
      <span class="subtle">共 {{ rules.length }} 条规则，可核对备注是否选错</span>
    </div>
    <div v-if="showRuleTable" class="table-wrap rule-table-wrap">
      <table class="rule-check-table">
        <thead>
          <tr>
            <th>策略名称</th>
            <th>备注条数</th>
            <th>备注明细</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in rules"
            :key="'row-' + r.name"
            :class="{ editing: editingRuleName === r.name }"
          >
            <td><b>{{ r.name }}</b></td>
            <td>{{ ruleRemarks(r).length }}</td>
            <td class="rule-remarks-cell">
              <div class="rule-remarks-wrap">
                <span
                  v-for="m in ruleRemarks(r)"
                  :key="m"
                  class="tag rule-remark-chip"
                  >{{ m }}</span
                >
              </div>
            </td>
            <td class="rule-row-actions">
              <button
                type="button"
                class="icon-button"
                title="编辑"
                aria-label="编辑规则"
                @click="startEditRule(r)"
              >
                <Pencil :size="15" />
              </button>
              <button
                type="button"
                class="icon-button"
                title="删除"
                aria-label="删除规则"
                @click="removeRule(r.name)"
              >
                <X :size="15" />
              </button>
            </td>
          </tr>
          <tr v-if="!rules.length">
            <td colspan="4" class="empty">尚未添加策略规则。</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <div class="strategy-toolbar">
    <span class="strategy-toolbar-count"
      >{{ strategyStats.length }} 个策略</span
    >
    <div class="view-toggle" role="group" aria-label="视图切换">
      <button
        type="button"
        class="view-toggle-btn"
        :class="{ active: viewMode === 'cards' }"
        title="卡片视图"
        aria-label="卡片视图"
        @click="viewMode = 'cards'"
      >
        <LayoutGrid :size="16" />
      </button>
      <button
        type="button"
        class="view-toggle-btn"
        :class="{ active: viewMode === 'list' }"
        title="列表视图"
        aria-label="列表视图"
        @click="viewMode = 'list'"
      >
        <List :size="16" />
      </button>
    </div>
  </div>

  <div v-if="viewMode === 'cards'" class="strategy-cards">
    <section
      class="panel strategy-card"
      v-for="s in strategyStats"
      :key="s.name"
    >
      <div class="panel-title">
        <h2><Layers3 :size="18" />{{ s.name }}</h2>
        <span class="tag">{{ s.count }} 笔</span>
      </div>
      <strong :class="s.net >= 0 ? 'positive' : 'negative'">{{
        signed(s.net)
      }}</strong>
      <div class="strategy-metrics">
        <span
          >胜率<b>{{ formatNum(s.winRate) }}%</b></span
        ><span
          >盈利因子<b>{{ fmt(s.factor) }}</b></span
        ><span
          >最大回撤<b>{{ money(s.dd) }}</b></span
        >
      </div>
      <button class="button full" @click="viewStrategy(s.name)">
        查看策略分析<ChevronRight :size="14" />
      </button>
    </section>
  </div>

  <section v-else class="panel strategy-list-panel">
    <div class="table-wrap">
      <table class="strategy-list-table">
        <thead>
          <tr>
            <th>策略</th>
            <th>笔数</th>
            <th>净盈亏</th>
            <th>胜率</th>
            <th>盈利因子</th>
            <th>最大回撤</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in strategyStats" :key="s.name">
            <td>
              <b class="strategy-list-name"
                ><Layers3 :size="14" />{{ s.name }}</b
              >
            </td>
            <td>{{ s.count }}</td>
            <td :class="s.net >= 0 ? 'positive' : 'negative'">
              {{ signed(s.net) }}
            </td>
            <td>{{ formatNum(s.winRate) }}%</td>
            <td>{{ fmt(s.factor) }}</td>
            <td>{{ money(s.dd) }}</td>
            <td>
              <button class="button" @click="viewStrategy(s.name)">
                查看分析<ChevronRight :size="14" />
              </button>
            </td>
          </tr>
          <tr v-if="!strategyStats.length">
            <td colspan="7" class="empty">暂无策略数据，请先导入交易报告。</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
