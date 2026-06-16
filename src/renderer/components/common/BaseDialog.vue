<template>
  <Teleport to="body">
    <div v-if="modelValue" class="base-dialog-overlay">
      <div class="base-dialog" @click.stop>
        <button class="base-dialog-close" @click="handleClose">×</button>
        <slot></slot>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'close': []
}>()

function handleClose() {
  emit('close')
  emit('update:modelValue', false)
}
</script>

<style scoped>
.base-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.base-dialog {
  position: relative;
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 24px;
  min-width: 320px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.base-dialog-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 20px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.base-dialog-close:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
</style>
