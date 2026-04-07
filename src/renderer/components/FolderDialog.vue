<template>
  <div v-if="modelValue" class="folder-dialog-overlay" @click="handleCancel">
    <div class="folder-dialog" @click.stop>
      <h3 class="dialog-title">{{ title }}</h3>
      <input
        ref="inputRef"
        v-model="inputValue"
        class="dialog-input"
        placeholder="请输入文件夹名称"
        @keyup.enter="handleConfirm"
        @keyup.esc="handleCancel"
      />
      <div class="dialog-actions">
        <button class="btn-cancel" @click="handleCancel">取消</button>
        <button class="btn-confirm" @click="handleConfirm">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  modelValue: boolean
  title: string
  defaultValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'confirm': [value: string]
  'cancel': []
}>()

const inputValue = ref(props.defaultValue)
const inputRef = ref<HTMLInputElement | null>(null)

watch(() => props.modelValue, async (val) => {
  if (val) {
    inputValue.value = props.defaultValue
    await nextTick()
    inputRef.value?.focus()
    inputRef.value?.select()
  }
}, { immediate: true })

function handleConfirm() {
  if (inputValue.value.trim()) {
    emit('confirm', inputValue.value.trim())
    emit('update:modelValue', false)
  }
}

function handleCancel() {
  emit('cancel')
  emit('update:modelValue', false)
}
</script>

<style scoped>
.folder-dialog-overlay {
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

.folder-dialog {
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 20px;
  min-width: 320px;
  max-width: 400px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.dialog-title {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.dialog-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 14px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  box-sizing: border-box;
}

.dialog-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.btn-cancel,
.btn-confirm {
  padding: 8px 20px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-cancel {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.btn-cancel:hover {
  background: var(--border-color);
}

.btn-confirm {
  background: var(--accent-color);
  color: white;
}

.btn-confirm:hover {
  opacity: 0.9;
}
</style>
