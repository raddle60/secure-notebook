<template>
  <div v-if="modelValue" class="message-dialog-overlay" @click="handleClose">
    <div class="message-dialog" @click.stop>
      <h3 class="dialog-title">{{ title }}</h3>
      <p class="dialog-message">{{ message }}</p>
      <div class="dialog-actions">
        <button class="btn-ok" @click="handleClose">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
.message-dialog-overlay {
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

.message-dialog {
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 24px;
  min-width: 320px;
  max-width: 400px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.dialog-title {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
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

/* 暗色主题下使用不同的背景色 */
:root[data-theme='dark'] .btn-ok {
  background: var(--bg-selected);
}

:root[data-theme='dark'] .btn-ok:hover {
  background: var(--bg-hover);
}
</style>
