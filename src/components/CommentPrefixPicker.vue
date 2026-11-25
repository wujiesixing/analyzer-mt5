<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { useTradeWorkspace } from '../composables/useTradeWorkspace.ts'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    label?: string
    placeholder?: string
    /** 已占用、应从列表中隐藏的备注 */
    exclude?: ReadonlySet<string> | string[]
  }>(),
  {
    label: '备注前缀',
    placeholder: '输入关键字检索开仓备注',
    exclude: () => [],
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const { trades } = useTradeWorkspace()
const open = ref(false)
const query = ref('')
const root = ref<HTMLElement | null>(null)
const searchEl = ref<HTMLInputElement | null>(null)
const panelVisible = ref(false)
const dropUp = ref(false)

const excludeSet = computed(() => {
  if (props.exclude instanceof Set) return props.exclude
  return new Set(props.exclude)
})

const allComments = computed(() => {
  const map = new Map<string, number>()
  for (const t of trades.value) {
    const c = (t.comment || '').trim()
    if (!c) continue
    map.set(c, (map.get(c) || 0) + 1)
  }
  return [...map.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
})

const available = computed(() =>
  allComments.value.filter(
    (c) =>
      !excludeSet.value.has(c.value) || props.modelValue.includes(c.value),
  ),
)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = q
    ? available.value.filter((c) => c.value.toLowerCase().includes(q))
    : available.value
  return list.slice(0, 80)
})

const allFilteredSelected = computed(
  () =>
    filtered.value.length > 0 &&
    filtered.value.every((c) => props.modelValue.includes(c.value)),
)

const summary = computed(() => {
  if (!props.modelValue.length) return props.placeholder
  if (props.modelValue.length === 1) return props.modelValue[0]
  return `已选 ${props.modelValue.length} 条备注`
})

function updatePlacement() {
  const el = root.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom - 8
  const spaceAbove = rect.top - 8
  dropUp.value = spaceBelow < 220 && spaceAbove > spaceBelow
}

watch(open, async (value) => {
  if (value) {
    panelVisible.value = true
    await nextTick()
    updatePlacement()
    searchEl.value?.focus()
  } else {
    await new Promise((r) => setTimeout(r, 150))
    if (!open.value) panelVisible.value = false
  }
})

function toggle() {
  open.value = !open.value
}

function close() {
  open.value = false
}

function onOutside(e: MouseEvent) {
  const t = e.target
  if (!(t instanceof Node)) return
  if (root.value?.contains(t)) return
  close()
}

function toggleOne(value: string) {
  const next = props.modelValue.includes(value)
    ? props.modelValue.filter((v) => v !== value)
    : [...props.modelValue, value]
  emit('update:modelValue', next)
}

function toggleAllFiltered() {
  const values = filtered.value.map((c) => c.value)
  if (allFilteredSelected.value) {
    emit(
      'update:modelValue',
      props.modelValue.filter((v) => !values.includes(v)),
    )
  } else {
    emit('update:modelValue', [...new Set([...props.modelValue, ...values])])
  }
}

function onViewportChange() {
  if (open.value) updatePlacement()
}

onMounted(() => {
  document.addEventListener('mousedown', onOutside)
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onOutside)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})
</script>

<template>
  <div
    ref="root"
    class="comment-picker app-select"
    :class="{ open, 'drop-up': dropUp }"
  >
    <label v-if="label" class="app-select-label">{{ label }}</label>
    <button
      type="button"
      class="app-select-trigger"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
    >
      <span :class="{ placeholder: !modelValue.length }">{{ summary }}</span>
      <ChevronDown :size="14" class="app-select-chevron" />
    </button>
    <div
      v-show="panelVisible"
      class="app-select-panel comment-picker-panel"
      :class="{ open }"
      role="listbox"
      aria-multiselectable="true"
    >
      <div class="comment-picker-head">
        <div class="comment-picker-search">
          <input
            ref="searchEl"
            v-model="query"
            class="control-input"
            type="search"
            :placeholder="placeholder"
            @keydown.stop
          />
        </div>
        <div class="comment-picker-actions">
          <button
            type="button"
            class="comment-picker-select-all"
            :disabled="!filtered.length"
            @click="toggleAllFiltered"
          >
            {{ allFilteredSelected ? '取消全选' : '全选当前结果' }}
          </button>
          <span class="subtle">{{ filtered.length }} 条</span>
        </div>
      </div>
      <div class="comment-picker-options">
        <label
          v-for="item in filtered"
          :key="item.value"
          class="app-select-option"
          :class="{ active: modelValue.includes(item.value) }"
        >
          <input
            type="checkbox"
            :checked="modelValue.includes(item.value)"
            @change="toggleOne(item.value)"
          />
          <span class="comment-picker-text">{{ item.value }}</span>
          <span class="comment-picker-count">{{ item.count }}</span>
        </label>
        <p v-if="!filtered.length" class="comment-picker-empty">
          {{
            query.trim()
              ? '没有可选用的匹配备注'
              : '暂无可用备注（可能已被其他规则占用）'
          }}
        </p>
      </div>
      <div class="comment-picker-foot">
        <button type="button" class="app-select-done" @click="close">
          完成
        </button>
      </div>
    </div>
  </div>
</template>
