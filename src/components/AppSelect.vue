<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

const props = withDefaults(
  defineProps<{
    modelValue: string | number | Array<string | number>
    options: SelectOption[]
    multiple?: boolean
    placeholder?: string
    label?: string
    disabled?: boolean
    /** 多选时最多直接展示的标签数，超出显示「已选 N 项」 */
    maxTags?: number
  }>(),
  {
    multiple: false,
    placeholder: '请选择',
    label: '',
    disabled: false,
    maxTags: 2,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number | Array<string | number>]
}>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const panelVisible = ref(false)
const dropUp = ref(false)

const selectedValues = computed(() =>
  Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue],
)

const displayText = computed(() => {
  if (props.multiple) {
    const selected = props.options.filter((o) =>
      selectedValues.value.includes(o.value),
    )
    if (!selected.length) return props.placeholder
    if (selected.length <= props.maxTags)
      return selected.map((o) => o.label).join('、')
    return `已选 ${selected.length} 项`
  }
  const match = props.options.find((o) => o.value === props.modelValue)
  return match?.label ?? props.placeholder
})

function updatePlacement() {
  const el = root.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom - 8
  const spaceAbove = rect.top - 8
  dropUp.value = spaceBelow < 200 && spaceAbove > spaceBelow
}

watch(open, async (value) => {
  if (value) {
    panelVisible.value = true
    await nextTick()
    updatePlacement()
  } else {
    await new Promise((r) => setTimeout(r, 150))
    if (!open.value) panelVisible.value = false
  }
})

function toggle() {
  if (props.disabled) return
  open.value = !open.value
}

function close() {
  open.value = false
}

function onTriggerPointer(event: MouseEvent) {
  event.preventDefault()
  toggle()
  ;(event.currentTarget as HTMLButtonElement).focus({ preventScroll: true })
}

function onOutside(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof Node)) return
  if (root.value?.contains(target)) return
  close()
}

function selectOne(option: SelectOption) {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  close()
}

function toggleMulti(option: SelectOption) {
  if (option.disabled || !Array.isArray(props.modelValue)) return
  const next = props.modelValue.includes(option.value)
    ? props.modelValue.filter((v) => v !== option.value)
    : [...props.modelValue, option.value]
  emit('update:modelValue', next)
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    close()
    return
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    toggle()
  }
}

function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget
  if (next instanceof Node && root.value?.contains(next)) return
  if (!next) return
  close()
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
    class="app-select"
    :class="{ open, disabled, 'drop-up': dropUp }"
  >
    <label v-if="label" class="app-select-label">{{ label }}</label>
    <button
      type="button"
      class="app-select-trigger"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @mousedown="onTriggerPointer"
      @focusout="onFocusOut"
      @keydown="onTriggerKeydown"
    >
      <span :class="{ placeholder: displayText === placeholder }">{{
        displayText
      }}</span>
      <ChevronDown :size="14" class="app-select-chevron" />
    </button>
    <div
      v-show="panelVisible"
      ref="panelEl"
      class="app-select-panel"
      :class="{ open }"
      role="listbox"
      :aria-multiselectable="multiple"
    >
      <template v-if="multiple">
        <label
          v-for="option in options"
          :key="String(option.value)"
          class="app-select-option"
          :class="{
            disabled: option.disabled,
            active: selectedValues.includes(option.value),
          }"
        >
          <input
            type="checkbox"
            :checked="selectedValues.includes(option.value)"
            :disabled="option.disabled"
            @change="toggleMulti(option)"
          />
          <span>{{ option.label }}</span>
        </label>
        <button type="button" class="app-select-done" @click="close">
          完成
        </button>
      </template>
      <template v-else>
        <button
          v-for="option in options"
          :key="String(option.value)"
          type="button"
          class="app-select-option single"
          :class="{
            active: modelValue === option.value,
            disabled: option.disabled,
          }"
          :disabled="option.disabled"
          role="option"
          :aria-selected="modelValue === option.value"
          @click="selectOne(option)"
        >
          {{ option.label }}
        </button>
      </template>
    </div>
  </div>
</template>
