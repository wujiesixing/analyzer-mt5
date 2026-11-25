<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { useTradeWorkspace } from '../../composables/useTradeWorkspace.ts'
const { notice } = useTradeWorkspace()
</script>

<template>
  <div v-if="notice" class="toast" role="status">
    <Check :size="17" />{{ notice }}
  </div>
</template>
