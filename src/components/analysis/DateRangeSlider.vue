<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { datesFromRatios, rangeRatios } from '../../lib/dateRange.ts'

const props = defineProps<{
  min: string
  max: string
  from: string
  to: string
}>()

const emit = defineEmits<{
  change: [value: { from: string; to: string }]
}>()

const track = ref<HTMLElement | null>(null)
const start = ref(0)
const end = ref(1)
const dragging = ref(false)
let mode: 'start' | 'end' | 'move' | 'brush' = 'move'
let originRatio = 0
let originStart = 0
let originEnd = 0
let brushAnchor = 0

function applyProps() {
  if (dragging.value) return
  const [left, right] = rangeRatios(props.min, props.max, props.from, props.to)
  start.value = left
  end.value = right
}

watch(() => [props.min, props.max, props.from, props.to], applyProps, {
  immediate: true,
})

const label = computed(() => {
  const picked = datesFromRatios(props.min, props.max, start.value, end.value)
  return {
    from: picked.from || props.min,
    to: picked.to || props.max,
  }
})

const atFull = computed(
  () => !dragging.value && !props.from && !props.to,
)

function ratioAt(clientX: number) {
  const rect = track.value?.getBoundingClientRect()
  if (!rect || rect.width <= 0) return 0
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
}

function onPointerDown(event: PointerEvent) {
  if (!props.min || !props.max || props.min === props.max) return
  const current = event.currentTarget
  if (!(current instanceof HTMLElement) || !track.value) return
  try {
    current.setPointerCapture(event.pointerId)
  } catch {
    // 某些合成事件不能捕获指针，拖动仍由后续 pointermove 完成。
  }
  const rect = track.value.getBoundingClientRect()
  const x = event.clientX - rect.left
  const startX = start.value * rect.width
  const endX = end.value * rect.width
  const ratio = ratioAt(event.clientX)
  dragging.value = true
  originRatio = ratio
  originStart = start.value
  originEnd = end.value
  if (Math.abs(x - startX) <= 14 && Math.abs(x - startX) <= Math.abs(x - endX)) {
    mode = 'start'
  } else if (Math.abs(x - endX) <= 14) {
    mode = 'end'
  } else if (x > startX && x < endX) {
    mode = 'move'
  } else {
    mode = 'brush'
    brushAnchor = ratio
    start.value = ratio
    end.value = ratio
  }
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value) return
  const ratio = ratioAt(event.clientX)
  if (mode === 'start') {
    start.value = Math.min(ratio, originEnd)
  } else if (mode === 'end') {
    end.value = Math.max(ratio, originStart)
  } else if (mode === 'move') {
    const width = originEnd - originStart
    const next = Math.min(Math.max(originStart + (ratio - originRatio), 0), 1 - width)
    start.value = next
    end.value = next + width
  } else {
    start.value = Math.min(brushAnchor, ratio)
    end.value = Math.max(brushAnchor, ratio)
  }
}

function finish() {
  if (!dragging.value) return
  dragging.value = false
  const next = datesFromRatios(props.min, props.max, start.value, end.value)
  if (next.from === props.from && next.to === props.to) {
    applyProps()
    return
  }
  emit('change', next)
}

function onPointerUp(event: PointerEvent) {
  const current = event.currentTarget
  if (current instanceof HTMLElement && current.hasPointerCapture(event.pointerId)) {
    current.releasePointerCapture(event.pointerId)
  }
  finish()
}

function reset() {
  dragging.value = false
  start.value = 0
  end.value = 1
  if (!props.from && !props.to) return
  emit('change', { from: '', to: '' })
}

const fillStyle = computed(() => ({
  left: `${start.value * 100}%`,
  width: `${Math.max(end.value - start.value, 0) * 100}%`,
}))
const startStyle = computed(() => ({ left: `${start.value * 100}%` }))
const endStyle = computed(() => ({ left: `${end.value * 100}%` }))
</script>

<template>
  <div class="range-slider">
    <div
      ref="track"
      class="range-track"
      :class="{ dragging }"
      role="slider"
      aria-label="绩效日期区间"
      :aria-valuemin="0"
      :aria-valuemax="100"
      :aria-valuenow="Math.round(start * 100)"
      :aria-valuetext="`${label.from} 至 ${label.to}`"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div class="range-rail" />
      <div class="range-fill" :style="fillStyle" />
      <div class="range-handle" :style="startStyle" />
      <div class="range-handle" :style="endStyle" />
    </div>
    <span class="range-label">{{ label.from }} 至 {{ label.to }}</span>
    <button
      type="button"
      class="range-reset"
      :disabled="atFull"
      @click="reset"
    >
      重置
    </button>
  </div>
</template>
