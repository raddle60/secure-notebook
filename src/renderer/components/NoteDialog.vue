<template>
  <div v-if="modelValue" class="note-dialog-overlay" @click="handleCancel">
    <div class="note-dialog" @click.stop>
      <h3 class="dialog-title">
        {{ title }}{{ folderName ? `（${folderName}）` : '' }}
      </h3>
      <input
        ref="inputRef"
        v-model="inputValue"
        class="dialog-input"
        placeholder="请输入笔记标题"
        @keyup.enter="handleConfirm"
        @keyup.esc="handleCancel"
      />
      <div class="format-selector">
        <label class="format-label">笔记格式：</label>
        <div class="format-options">
          <label
            v-for="format in formats"
            :key="format.value"
            class="format-option"
            :class="{ active: selectedFormat === format.value }"
          >
            <input
              type="radio"
              name="format"
              :value="format.value"
              v-model="selectedFormat"
              class="format-radio"
            />
            <span class="format-icon" :class="format.icon"></span>
            <span class="format-name">{{ format.label }}</span>
          </label>
        </div>
      </div>
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
  folderName?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'confirm': [value: { title: string; format: string }]
  'cancel': []
}>()

const formats = [
  { value: 'plain', label: '纯文本', icon: 'svg-note-plain' },
  { value: 'markdown', label: 'Markdown', icon: 'svg-note-markdown' },
  { value: 'richtext', label: '富文本', icon: 'svg-note-richtext' }
]

const inputValue = ref(props.defaultValue)
const selectedFormat = ref<'plain' | 'markdown' | 'richtext'>('plain')
const inputRef = ref<HTMLInputElement | null>(null)

watch(() => props.modelValue, async (val) => {
  if (val) {
    inputValue.value = props.defaultValue
    selectedFormat.value = 'plain'
    await nextTick()
    // 使用 setTimeout 确保 DOM 完全渲染后再聚焦
    setTimeout(() => {
      inputRef.value?.focus()
      inputRef.value?.select()
    }, 10)
  }
})

function handleConfirm() {
  if (inputValue.value.trim()) {
    emit('confirm', { title: inputValue.value.trim(), format: selectedFormat.value })
    emit('update:modelValue', false)
  }
}

function handleCancel() {
  emit('cancel')
  emit('update:modelValue', false)
}
</script>

<style scoped>
.note-dialog-overlay {
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

.note-dialog {
  background: var(--bg-primary);
  border-radius: 8px;
  padding: 20px;
  min-width: 360px;
  max-width: 420px;
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
  margin-bottom: 16px;
}

.dialog-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

/* 暗色主题下使用更柔和的边框颜色 */
:root[data-theme='dark'] .dialog-input:focus {
  border-color: var(--bg-selected);
}

.format-selector {
  margin-bottom: 20px;
}

.format-label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.format-options {
  display: flex;
  gap: 8px;
}

.format-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.format-option:hover {
  background: var(--bg-secondary);
  border-color: var(--accent-color);
}

/* 暗色主题下使用不同的边框颜色 */
:root[data-theme='dark'] .format-option:hover {
  border-color: var(--bg-selected);
}

.format-option.active {
  background: var(--bg-secondary);
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-color);
}

/* 暗色主题下使用更柔和的边框颜色 */
:root[data-theme='dark'] .format-option.active {
  border-color: var(--bg-selected);
  box-shadow: 0 0 0 2px var(--bg-selected);
}

.format-radio {
  display: none;
}

.format-icon {
  font-size: 20px;
  margin-bottom: 4px;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* SVG 图标样式 */
.format-icon.svg-note-plain,
.format-icon.svg-note-markdown,
.format-icon.svg-note-richtext {
  background-color: var(--text-primary);
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
}

.format-icon.svg-note-plain {
  -webkit-mask-image: url('../assets/icons/note-plain.svg');
  mask-image: url('../assets/icons/note-plain.svg');
}

.format-icon.svg-note-markdown {
  -webkit-mask-image: url('../assets/icons/note-markdown.svg');
  mask-image: url('../assets/icons/note-markdown.svg');
}

.format-icon.svg-note-richtext {
  -webkit-mask-image: url('../assets/icons/note-richtext.svg');
  mask-image: url('../assets/icons/note-richtext.svg');
}

.format-name {
  font-size: 12px;
  color: var(--text-primary);
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

/* 暗色主题下使用不同的背景色 */
:root[data-theme='dark'] .btn-confirm {
  background: var(--bg-selected);
}

:root[data-theme='dark'] .btn-confirm:hover {
  opacity: 1;
  background: var(--bg-hover);
}
</style>
