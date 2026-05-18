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
            <div class="font-combobox">
              <div class="font-combobox-input-wrapper">
                <input
                  v-model="fontInputText"
                  @focus="showFontDropdown = true"
                  @input="onFontInput"
                  @blur="onFontBlur"
                  @keydown.down.prevent="navigateFontDropdown(1)"
                  @keydown.up.prevent="navigateFontDropdown(-1)"
                  @keydown.enter.prevent="applyTypedFont"
                  class="font-input"
                  placeholder="选择或输入字体"
                />
                <button class="font-dropdown-btn" @click="toggleFontDropdown" type="button">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </div>
              <div v-if="showFontDropdown" class="font-dropdown">
                <div
                  v-for="(font, index) in filteredFonts"
                  :key="font.value"
                  class="font-dropdown-item"
                  :class="{ highlighted: index === highlightedFontIndex }"
                  @mousedown.prevent="selectFont(font)"
                  @mouseover="highlightedFontIndex = index"
                >
                  {{ font.label }}
                </div>
                <div v-if="filteredFonts.length === 0" class="font-dropdown-empty">
                  无匹配字体
                </div>
              </div>
            </div>
            <span v-if="fontError" class="font-error">{{ fontError }}</span>
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
          <div class="password-actions">
            <button class="setting-btn" @click="showChangePassword = true">修改密码</button>
            <button class="setting-btn" @click="handleShowRecoveryKey">生成重置密钥文件</button>
          </div>
          <p v-if="recoveryKeyGenCount > 0" class="setting-hint">已生成 {{ recoveryKeyGenCount }} 次</p>
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

      <!-- 重置密钥生成对话框 -->
      <RecoveryKeyDialog
        v-if="showRecoveryKeyDialog"
        @close="showRecoveryKeyDialog = false"
        @skipped="handleRecoveryKeySkipped"
        @generated="handleRecoveryKeyGenerated"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useVault } from '../composables/useVault'
import ChangePasswordDialog from './ChangePasswordDialog.vue'
import RecoveryKeyDialog from './RecoveryKeyDialog.vue'
import { getAvailableFonts, isFontAvailable } from '../utils/fontDetector'

const emit = defineEmits<{ close: [] }>()
const { lock, getRecoveryKeyGenCount } = useVault()

const showChangePassword = ref(false)
const showRecoveryKeyDialog = ref(false)
const recoveryKeyGenCount = ref(0)
const currentTheme = ref<'light' | 'dark'>('dark')
const autoLockMinutes = ref(10)
const fontFamily = ref('Consolas, "Courier New", monospace')
const fontSize = ref(14)
const cacheSize = ref(20)
const fontError = ref('')
const availableFonts = ref<Array<{ value: string; label: string }>>([])
const fontInputText = ref('')
const showFontDropdown = ref(false)
const highlightedFontIndex = ref(0)

// 获取当前字体对应的显示文本（label）
const currentFontLabel = computed(() => {
  const found = availableFonts.value.find(f => f.value === fontFamily.value)
  return found ? found.label : fontFamily.value.split(',')[0].replace(/["']/g, '')
})

// 过滤后的字体列表（根据输入文本过滤）
const filteredFonts = computed(() => {
  if (!fontInputText.value) return availableFonts.value
  const search = fontInputText.value.toLowerCase()
  return availableFonts.value.filter(f => f.label.toLowerCase().includes(search))
})

// 点击外部关闭下拉框
function handleDocumentMousedown(e: MouseEvent) {
  const combobox = document.querySelector('.font-combobox')
  if (combobox && !combobox.contains(e.target as Node)) {
    showFontDropdown.value = false
    fontInputText.value = currentFontLabel.value
  }
}

function closeFontDropdown() {
  showFontDropdown.value = false
}

function toggleFontDropdown() {
  showFontDropdown.value = !showFontDropdown.value
  if (showFontDropdown.value) {
    fontInputText.value = ''
    highlightedFontIndex.value = 0
  }
}

function onFontInput() {
  showFontDropdown.value = true
  highlightedFontIndex.value = 0
}

function onFontBlur() {
  // 延迟关闭以便点击下拉项
  setTimeout(async () => {
    showFontDropdown.value = false
    // 检查输入的是否是自定义字体（不在下拉列表中）
    const typedText = fontInputText.value.trim()
    const matchedFont = availableFonts.value.find(f => f.label === typedText || f.value === typedText)

    if (matchedFont) {
      // 如果匹配到下拉列表中的字体，使用它
      fontFamily.value = matchedFont.value
      fontInputText.value = matchedFont.label
      fontError.value = ''
    } else if (typedText) {
      // 如果是自定义输入，验证字体是否可用
      const available = await isFontAvailable(typedText)
      if (available) {
        // 可用，保存自定义字体（使用输入的值作为 font family）
        fontFamily.value = typedText
        fontError.value = ''
        await window.vaultAPI.settings.updateEditorFont(fontFamily.value, fontSize.value)
        document.documentElement.style.setProperty('--editor-font-family', fontFamily.value)
        document.documentElement.style.setProperty('--editor-font-size', `${fontSize.value}px`)
        window.dispatchEvent(new CustomEvent('editor-font-changed'))
      } else {
        // 不可用，恢复显示当前选中字体的 label
        fontError.value = '该字体未安装或不可用'
        fontInputText.value = currentFontLabel.value
      }
    } else {
      // 输入为空，恢复显示当前选中字体的 label
      fontInputText.value = currentFontLabel.value
    }
  }, 150)
}

function navigateFontDropdown(direction: number) {
  const fonts = filteredFonts.value
  if (fonts.length === 0) return
  highlightedFontIndex.value = Math.max(0, Math.min(fonts.length - 1, highlightedFontIndex.value + direction))
}

function selectHighlightedFont() {
  const fonts = filteredFonts.value
  if (fonts.length === 0) return
  selectFont(fonts[highlightedFontIndex.value])
}

async function applyTypedFont() {
  const typedText = fontInputText.value.trim()
  const matchedFont = availableFonts.value.find(f => f.label === typedText || f.value === typedText)

  if (matchedFont) {
    // 匹配到下拉列表中的字体
    selectFont(matchedFont)
  } else if (typedText) {
    // 自定义输入，验证字体是否可用
    const available = await isFontAvailable(typedText)
    if (available) {
      fontFamily.value = typedText
      fontInputText.value = typedText
      fontError.value = ''
      await window.vaultAPI.settings.updateEditorFont(fontFamily.value, fontSize.value)
      document.documentElement.style.setProperty('--editor-font-family', fontFamily.value)
      document.documentElement.style.setProperty('--editor-font-size', `${fontSize.value}px`)
      window.dispatchEvent(new CustomEvent('editor-font-changed'))
      showFontDropdown.value = false
    } else {
      fontError.value = '该字体未安装或不可用'
    }
  }
}

function selectFont(font: { value: string; label: string }) {
  fontFamily.value = font.value
  fontInputText.value = font.label
  showFontDropdown.value = false
  updateEditorFont()
}

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
  // 加载重置密钥生成次数
  recoveryKeyGenCount.value = await getRecoveryKeyGenCount()
  // 初始化字体输入框显示文本
  fontInputText.value = currentFontLabel.value
  // 添加点击外部关闭下拉框
  document.addEventListener('mousedown', handleDocumentMousedown)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleDocumentMousedown)
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
  // 检查字体是否已安装
  const available = await isFontAvailable(fontFamily.value)
  if (!available) {
    fontError.value = '该字体未安装或不可用'
    return
  }
  fontError.value = ''
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

async function handleShowRecoveryKey() {
  showRecoveryKeyDialog.value = true
}

function handleRecoveryKeySkipped() {
  // 用户跳过生成，不更新计数
}

function handleRecoveryKeyGenerated() {
  // 生成成功，更新计数显示
  recoveryKeyGenCount.value++
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

.password-actions {
  display: flex;
  gap: 8px;
  flex-direction: column;
}

.setting-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
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
  align-items: flex-start;
  position: relative;
}

.font-combobox {
  position: relative;
}

.font-combobox-input-wrapper {
  display: flex;
  align-items: center;
}

.font-input {
  min-width: 140px;
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px 0 0 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
}

.font-input:hover {
  background: var(--bg-hover);
}

:root[data-theme='dark'] .font-input:hover {
  border-color: var(--bg-selected);
}

.font-input:focus {
  outline: none;
  border-color: var(--accent-color);
  border-right-color: var(--border-color);
}

:root[data-theme='dark'] .font-input:focus {
  border-color: var(--bg-selected);
}

.font-dropdown-btn {
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-left: none;
  border-radius: 0 4px 4px 0;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.font-dropdown-btn:hover {
  background: var(--bg-hover);
}

:root[data-theme='dark'] .font-dropdown-btn:hover {
  border-color: var(--bg-selected);
}

.font-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 100%;
  max-height: 200px;
  overflow-y: auto;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 1000;
  margin-top: 4px;
}

.font-dropdown-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
}

.font-dropdown-item:hover,
.font-dropdown-item.highlighted {
  background: var(--bg-hover);
}

.font-dropdown-empty {
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-secondary);
}

.font-error {
  position: absolute;
  top: 100%;
  left: 0;
  font-size: 11px;
  color: #e53935;
  margin-top: 2px;
  white-space: nowrap;
  z-index: 100;
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
