<template>
  <svg class="icon" :class="className" :width="size" :height="size">
    <use :href="iconHref"></use>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  name: string
  size?: number
  className?: string
}>(), {
  size: 16
})

const iconHref = computed(() => `#icon-${props.name}`)
</script>

<style scoped>
.icon {
  flex-shrink: 0;
  color: currentColor;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
