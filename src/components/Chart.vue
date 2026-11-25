<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'
import type { ECharts, EChartsOption } from 'echarts'
const props = withDefaults(
  defineProps<{
    option: EChartsOption
    height?: number
    /** 指定像素宽；用于大矩阵，避免被父级压成 100% */
    width?: number
  }>(),
  { height: 300 },
)
const el = ref<HTMLDivElement | null>(null)
let chart: ECharts | undefined, observer: ResizeObserver | undefined

function applySize() {
  if (!el.value || !chart) return
  el.value.style.height = `${props.height}px`
  if (props.width) {
    el.value.style.width = `${props.width}px`
    el.value.style.minWidth = `${props.width}px`
    el.value.style.maxWidth = 'none'
  } else {
    el.value.style.width = '100%'
    el.value.style.minWidth = ''
    el.value.style.maxWidth = ''
  }
  chart.resize()
}

onMounted(() => {
  if (!el.value) return
  chart = echarts.init(el.value)
  chart.setOption(props.option)
  applySize()
  observer = new ResizeObserver(() => {
    if (!props.width) chart?.resize()
  })
  observer.observe(el.value.parentElement || el.value)
})
watch(
  () => props.option,
  (v) => {
    chart?.setOption(v, true)
    requestAnimationFrame(applySize)
  },
  { deep: true },
)
watch(
  () => [props.height, props.width] as const,
  () => requestAnimationFrame(applySize),
)
onBeforeUnmount(() => {
  observer?.disconnect()
  chart?.dispose()
})
</script>
<template>
  <div
    ref="el"
    class="chart"
    :class="{ 'chart-fixed': Boolean(width) }"
    :style="{
      height: height + 'px',
      width: width ? width + 'px' : '100%',
      minWidth: width ? width + 'px' : undefined,
    }"
  />
</template>
