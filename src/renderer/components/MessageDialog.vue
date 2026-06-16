<template>
  <BaseDialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    @close="handleClose"
  >
    <h3 class="dialog-title">{{ title }}</h3>
    <p class="dialog-message">{{ message }}</p>
    <div class="dialog-actions">
      <button class="btn-ok" @click="handleClose">确定</button>
    </div>
  </BaseDialog>
</template>

<script setup lang="ts">
import BaseDialog from './common/BaseDialog.vue'

const props = defineProps<{
  modelValue: boolean
  title: string
  message: string
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
.dialog-title {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  padding-right: 32px;
}

.dialog-message {
  margin: 0 0 24px 0;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
}

.btn-ok {
  padding: 8px 24px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  border: none;
  background: var(--accent-color);
  color: white;
  transition: all 0.2s;
}

.btn-ok:hover {
  opacity: 0.9;
}

:root[data-theme='dark'] .btn-ok {
  background: var(--bg-selected);
}

:root[data-theme='dark'] .btn-ok:hover {
  background: var(--bg-hover);
}
</style>
