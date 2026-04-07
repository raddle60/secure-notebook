<template>
  <div class="dialog-overlay" @click.self="$emit('close')">
    <div class="dialog">
      <div class="dialog-header">
        <h2>设置</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      <div class="dialog-body">
        <div class="setting-item">
          <span class="setting-label">主题</span>
          <div class="theme-selector">
            <button
              class="theme-btn"
              :class="{ active: currentTheme === 'dark' }"
              @click="changeTheme('dark')"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
              <span>暗色</span>
            </button>
            <button
              class="theme-btn"
              :class="{ active: currentTheme === 'light' }"
              @click="changeTheme('light')"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
              <span>亮色</span>
            </button>
          </div>
        </div>
        <div class="setting-item">
          <span class="setting-label">编辑器字体</span>
          <div class="editor-font-control">
            <select v-model="fontFamily" @change="updateEditorFont" class="font-select">
              <option v-for="font in availableFonts" :key="font.value" :value="font.value">
                {{ font.label }}
              </option>
            </select>
            <select v-model="fontSize" @change="updateEditorFont" class="font-size-select">
              <option :value="12">12px</option>
              <option :value="13">13px</option>
              <option :value="14">14px</option>
              <option :value="15">15px</option>
              <option :value="16">16px</option>
              <option :value="18">18px</option>
              <option :value="20">20px</option>
            </select>
          </div>
        </div>
        <div class="setting-item">
          <span class="setting-label">自动锁定</span>
          <div class="auto-lock-control">
            <select v-model="autoLockMinutes" @change="updateAutoLock" class="auto-lock-select">
              <option :value="0">禁用</option>
              <option :value="1">1 分钟</option>
              <option :value="2">2 分钟</option>
              <option :value="3">3 分钟</option>
              <option :value="5">5 分钟</option>
              <option :value="10">10 分钟</option>
              <option :value="15">15 分钟</option>
              <option :value="30">30 分钟</option>
              <option :value="60">1 小时</option>
            </select>
          </div>
        </div>
        <div class="setting-item">
          <span class="setting-label">锁定</span>
          <button class="setting-btn" @click="handleLock">立即锁定</button>
        </div>
        <div class="setting-item">
          <span class="setting-label">密码</span>
          <button class="setting-btn" @click="showChangePassword = true">修改密码</button>
        </div>
        <div class="setting-item">
          <span class="setting-label">导出</span>
          <button class="setting-btn" @click="handleExportVault">备份数据</button>
        </div>
        <div class="setting-item">
          <span class="setting-label">编辑器缓存</span>
          <div class="cache-size-control">
            <select v-model="cacheSize" @change="updateCacheSize" class="cache-size-select">
              <option :value="5">5 个</option>
              <option :value="10">10 个</option>
              <option :value="20">20 个</option>
              <option :value="50">50 个</option>
              <option :value="100">100 个</option>
            </select>
            <span class="cache-size-hint">限制同时缓存的编辑器实例数量</span>
          </div>
        </div>
        <div class="setting-item">
          <span class="setting-label">关于</span>
          <span class="setting-value">Secure Notebook v1.0.0</span>
        </div>
      </div>

      <!-- 密码修改对话框 -->
      <ChangePasswordDialog
        v-if="showChangePassword"
        @close="showChangePassword = false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useVault } from '../composables/useVault'
import ChangePasswordDialog from './ChangePasswordDialog.vue'
import { getAvailableFonts } from '../utils/fontDetector'

const emit = defineEmits<{ close: [] }>()
const { lock } = useVault()

const showChangePassword = ref(false)
const currentTheme = ref<'light' | 'dark'>('dark')
const autoLockMinutes = ref(10)
const fontFamily = ref('Consolas, "Courier New", monospace')
const fontSize = ref(14)
const cacheSize = ref(20)
const availableFonts = ref<Array<{ value: string; label: string }>>([])

onMounted(async () => {
  currentTheme.value = await window.vaultAPI.settings.getTheme()
  autoLockMinutes.value = await window.vaultAPI.settings.getAutoLockMinutes()
  const font = await window.vaultAPI.settings.getEditorFont()
  if (font?.fontFamily) {
    fontFamily.value = font.fontFamily
  }
  if (font?.fontSize) {
    fontSize.value = font.fontSize
  }
  cacheSize.value = await window.vaultAPI.settings.getEditorInstanceCacheSize()
  // 加载可用的字体列表
  availableFonts.value = await getAvailableFonts()
  // 如果当前选择的字体不在可用列表中，使用第一个可用字体
  if (fontFamily.value && !availableFonts.value.find(f => f.value === fontFamily.value)) {
    fontFamily.value = availableFonts.value[0]?.value || 'Consolas, "Courier New", monospace'
  }
})

async function updateCacheSize() {
  await window.vaultAPI.settings.updateEditorInstanceCacheSize(cacheSize.value)
}

async function changeTheme(theme: 'light' | 'dark') {
  currentTheme.value = theme
  await window.vaultAPI.settings.updateTheme(theme)
  document.documentElement.setAttribute('data-theme', theme)
}

async function updateAutoLock() {
  await window.vaultAPI.settings.updateAutoLockMinutes(autoLockMinutes.value)
}

async function updateEditorFont() {
  await window.vaultAPI.settings.updateEditorFont(fontFamily.value, fontSize.value)
  // 立即更新 CSS 变量
  document.documentElement.style.setProperty('--editor-font-family', fontFamily.value)
  document.documentElement.style.setProperty('--editor-font-size', `${fontSize.value}px`)
  // 触发自定义事件，通知编辑器更新
  window.dispatchEvent(new CustomEvent('editor-font-changed'))
}

async function handleLock() {
  await lock()
  emit('close')
}

async function handleExportVault() {
  try {
    // Let user select export directory and filename
    const filePath = await window.vaultAPI.export.selectExportDirectory()
    if (!filePath) {
      return // User cancelled
    }

    // Export the vault
    const result = await window.vaultAPI.export.vault(filePath)
    if (result.success) {
      alert('导出成功！文件已保存到：' + filePath)
    } else {
      alert('导出失败：' + (result.error || '未知错误'))
    }
  } catch (error) {
    console.error('[Export] Error:', error)
    alert('导出失败：' + (error instanceof Error ? error.message : String(error)))
  }
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--bg-primary);
  border-radius: 8px;
  width: 400px;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.dialog-header h2 {
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-secondary);
}

.dialog-body {
  padding: 16px 20px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-label {
  font-size: 14px;
  color: var(--text-primary);
}

.theme-selector {
  display: flex;
  gap: 8px;
}

.theme-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  transition: all 0.15s ease;
}

.theme-btn:hover {
  background: var(--bg-hover);
  border-color: var(--accent-color);
}

/* 暗色主题下使用不同的边框颜色 */
:root[data-theme='dark'] .theme-btn:hover {
  border-color: var(--bg-selected);
}

.theme-btn.active {
  background: var(--toolbar-active-bg);
  color: var(--toolbar-active-color);
  border-color: var(--toolbar-active-bg);
}

.theme-btn svg {
  flex-shrink: 0;
}

.setting-btn {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
}

.setting-btn:hover {
  background: var(--bg-hover);
}

.setting-value {
  font-size: 13px;
  color: var(--text-secondary);
}

.auto-lock-control {
  display: flex;
  align-items: center;
}

.auto-lock-select {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
}

.auto-lock-select:hover {
  background: var(--bg-hover);
}

/* 暗色主题下使用不同的边框颜色 */
:root[data-theme='dark'] .auto-lock-select:hover {
  border-color: var(--bg-selected);
}

.auto-lock-select:focus {
  outline: none;
  border-color: var(--accent-color);
}

:root[data-theme='dark'] .auto-lock-select:focus {
  border-color: var(--bg-selected);
}

.editor-font-control {
  display: flex;
  gap: 8px;
  align-items: center;
}

.font-select {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
  max-width: 200px;
}

.font-select:hover {
  background: var(--bg-hover);
}

:root[data-theme='dark'] .font-select:hover {
  border-color: var(--bg-selected);
}

.font-select:focus {
  outline: none;
  border-color: var(--accent-color);
}

:root[data-theme='dark'] .font-select:focus {
  border-color: var(--bg-selected);
}

.font-size-select {
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
  width: 80px;
}

.font-size-select:hover {
  background: var(--bg-hover);
}

:root[data-theme='dark'] .font-size-select:hover {
  border-color: var(--bg-selected);
}

.font-size-select:focus {
  outline: none;
  border-color: var(--accent-color);
}

:root[data-theme='dark'] .font-size-select:focus {
  border-color: var(--bg-selected);
}

.cache-size-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cache-size-select {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
}

.cache-size-select:hover {
  background: var(--bg-hover);
}

:root[data-theme='dark'] .cache-size-select:hover {
  border-color: var(--bg-selected);
}

.cache-size-select:focus {
  outline: none;
  border-color: var(--accent-color);
}

:root[data-theme='dark'] .cache-size-select:focus {
  border-color: var(--bg-selected);
}

.cache-size-hint {
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
