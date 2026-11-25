<script setup lang="ts">
import type { KpiItem } from '../../types/trading.ts'
defineProps<{ items: KpiItem[] }>()
</script>
<template>
  <div class="kpi-grid">
    <article v-for="k in items" :class="['kpi', k.color]">
      <span class="kpi-label">{{ k.label }}</span
      ><strong>{{ k.value }}</strong
      ><span v-if="k.second" class="negative">{{ k.second }}</span
      ><small v-else>{{ k.detail }}</small>
    </article>
  </div>
</template>
