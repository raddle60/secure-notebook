<template>
  <div v-if="modelValue" class="search-dialog-overlay" @click="close">
    <div class="search-dialog" @click.stop :style="dialogStyle">
      <div class="search-row">
        <div class="search-input-wrapper">
          <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            v-model="searchText"
            type="text"
            class="search-input"
            placeholder="查找..."
            @keyup.enter="findNext"
            ref="searchInput"
          />
          <div class="search-actions">
            <button
              class="icon-btn-sm"
              :class="{ active: matchCase }"
              title="区分大小写 (Alt+C)"
              @click="matchCase = !matchCase"
            >
              Aa
            </button>
            <button
              class="icon-btn-sm"
              :class="{ active: matchWholeWord }"
              title="全字匹配 (Alt+W)"
              @click="matchWholeWord = !matchWholeWord"
            >
              Ab
            </button>
          </div>
          <div class="match-count" v-if="searchText && totalMatches > 0">
            {{ currentMatchIndex + 1 }} / {{ totalMatches }}
          </div>
          <div class="match-count no-match" v-else-if="searchText && totalMatches === 0">
            无匹配
          </div>
        </div>
        <button class="close-btn" @click="close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="search-row replace-row">
        <div class="search-input-wrapper">
          <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 14 4 9 9 4"/>
            <path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
          </svg>
          <input
            v-model="replaceText"
            type="text"
            class="search-input"
            placeholder="替换为..."
          />
        </div>
        <div class="replace-actions">
          <button class="icon-btn" @click="findPrevious" :disabled="totalMatches === 0" title="上一个 (Shift+Enter)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <button class="icon-btn" @click="findNext" :disabled="totalMatches === 0" title="下一个 (Enter)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <button class="icon-btn" @click="replaceCurrent" :disabled="currentMatchIndex < 0" title="替换 (Alt+Enter)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="17 1 21 5 17 9"/>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
              <polyline points="7 23 3 19 7 15"/>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
            </svg>
          </button>
          <button class="icon-btn" @click="replaceAll" :disabled="totalMatches === 0" title="全部替换">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="17 1 21 5 17 9"/>
              <path d="M3 7V5a4 4 0 0 1 4-4h14"/>
              <polyline points="7 23 3 19 7 15"/>
              <path d="M21 17v2a4 4 0 0 1-4 4H3"/>
              <line x1="12" y1="3" x2="12" y2="21"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import { Decoration } from '@tiptap/pm/view'

const props = defineProps<{
  modelValue: boolean
  editor?: any
  initialSearchText?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'close': []
}>()

const searchText = ref('')
const replaceText = ref('')
const matchCase = ref(false)
const matchWholeWord = ref(false)
const currentMatchIndex = ref(-1)
const totalMatches = ref(0)
const searchInput = ref<HTMLInputElement | null>(null)

const dialogStyle = ref({
  top: '100px',
  right: '20px'
})

watch(() => props.modelValue, async (val) => {
  if (val) {
    await nextTick()
    // 如果有初始搜索文本，自动填入
    if (props.initialSearchText) {
      searchText.value = props.initialSearchText
    }
    searchInput.value?.focus()
  } else {
    // 对话框关闭时清空初始文本
    searchText.value = ''
  }
}, { immediate: true })

watch(searchText, () => {
  performSearch()
})

watch(() => props.editor, () => {
  if (searchText.value && props.editor) {
    performSearch()
  }
}, { immediate: true })

function close() {
  emit('update:modelValue', false)
  emit('close')
  clearHighlights()
}

function getEditorText(): string {
  if (!props.editor) return ''
  return props.editor.state.doc.textContent
}

function performSearch() {
  if (!props.editor || !searchText.value) {
    clearHighlights()
    totalMatches.value = 0
    currentMatchIndex.value = -1
    return
  }

  const text = getEditorText()
  const matches = findAllMatches(text)
  totalMatches.value = matches.length

  if (matches.length > 0 && currentMatchIndex.value >= matches.length) {
    currentMatchIndex.value = 0
  }

  highlightAllMatches(matches)

  if (currentMatchIndex.value >= 0) {
    scrollToMatch(matches[currentMatchIndex.value])
  }
}

function findAllMatches(text: string): { from: number; to: number }[] {
  const matches: { from: number; to: number }[] = []
  const searchStr = searchText.value
  let regexStr = searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  if (matchWholeWord.value) {
    regexStr = `\\b${regexStr}\\b`
  }

  const flags = matchCase.value ? 'g' : 'gi'
  const regex = new RegExp(regexStr, flags)

  let match
  while ((match = regex.exec(text)) !== null) {
    matches.push({ from: match.index, to: match.index + match[0].length })
  }

  return matches
}

function highlightAllMatches(matches: { from: number; to: number }[]) {
  clearHighlights()

  if (!props.editor || matches.length === 0) return

  const decorations: any[] = []

  matches.forEach((match, index) => {
    const from = match.from
    const to = match.to

    try {
      decorations.push(
        Decoration.inline(from, to, {
          class: index === currentMatchIndex.value ? 'search-match-current' : 'search-match'
        })
      )
    } catch (e) {
      // Ignore invalid positions
    }
  })

  if (decorations.length > 0) {
    try {
      const { tr } = props.editor.state
      tr.setMeta('searchHighlights', decorations)
      props.editor.view.dispatch(tr)
    } catch (e) {
      // Ignore dispatch errors
    }
  }
}

function clearHighlights() {
  if (!props.editor) return

  try {
    const tr = props.editor.state.tr
    tr.setMeta('searchHighlights', null)
    props.editor.view.dispatch(tr)
  } catch (e) {
    // Ignore errors
  }
}

function scrollToMatch(match: { from: number; to: number }) {
  if (!props.editor) return

  try {
    props.editor.commands.setTextSelection({ from: match.from, to: match.to })
    const node = props.editor.view.dom.querySelector('.search-match-current')
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  } catch (e) {
    // Ignore scroll errors
  }
}

function findNext() {
  if (!props.editor || totalMatches.value === 0) return

  const text = getEditorText()
  const matches = findAllMatches(text)

  if (matches.length === 0) return

  currentMatchIndex.value = (currentMatchIndex.value + 1) % matches.length
  highlightAllMatches(matches)
  scrollToMatch(matches[currentMatchIndex.value])
}

function findPrevious() {
  if (!props.editor || totalMatches.value === 0) return

  const text = getEditorText()
  const matches = findAllMatches(text)

  if (matches.length === 0) return

  currentMatchIndex.value = currentMatchIndex.value <= 0
    ? matches.length - 1
    : currentMatchIndex.value - 1
  highlightAllMatches(matches)
  scrollToMatch(matches[currentMatchIndex.value])
}

function replaceCurrent() {
  if (!props.editor || currentMatchIndex.value < 0) return

  const text = getEditorText()
  const matches = findAllMatches(text)

  if (matches.length === 0 || currentMatchIndex.value >= matches.length) return

  const match = matches[currentMatchIndex.value]

  try {
    props.editor.commands.setTextSelection({ from: match.from, to: match.to })
    props.editor.commands.insertContent(replaceText.value)

    searchText.value = replaceText.value + searchText.value.slice(replaceText.value.length)
    performSearch()
  } catch (e) {
    // Ignore replace errors
  }
}

function replaceAll() {
  if (!props.editor || totalMatches.value === 0) return

  const text = getEditorText()
  const matches = findAllMatches(text).reverse()

  for (const match of matches) {
    try {
      props.editor.commands.setTextSelection({ from: match.from, to: match.to })
      props.editor.commands.insertContent(replaceText.value)
    } catch (e) {
      // Ignore individual replace errors
    }
  }

  searchText.value = ''
  performSearch()
}
</script>

<style scoped>
.search-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 9998;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 10px;
}

.search-dialog {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 5px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
  width: 420px;
  padding: 8px;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.search-row:last-child {
  margin-bottom: 0;
}

.search-input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  background: var(--bg-secondary);
  padding: 3px 6px;
  gap: 6px;
}

.search-input-wrapper:focus-within {
  border-color: var(--bg-selected);
}

.search-icon {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
  height: 20px;
}

.search-input:focus {
  outline: none;
}

.search-input::placeholder {
  color: var(--text-secondary);
}

.search-actions {
  display: flex;
  gap: 2px;
}

.icon-btn-sm {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 4px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 10px;
  font-weight: 600;
  transition: all 0.1s;
}

.icon-btn-sm:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.icon-btn-sm.active {
  background: var(--accent-color);
  color: white;
}

.match-count {
  font-size: 11px;
  color: var(--text-secondary);
  min-width: 50px;
  text-align: right;
}

.match-count.no-match {
  color: #f44336;
}

:root[data-theme='dark'] .match-count.no-match {
  color: #ef5350;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.replace-row {
  margin-top: 0;
}

.replace-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.1s;
}

.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.icon-btn:disabled:hover {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

/* 暗色主题 */
:root[data-theme='dark'] .search-input-wrapper:focus-within {
  border-color: var(--bg-selected);
}

:root[data-theme='dark'] .icon-btn-sm.active {
  background: var(--bg-selected);
}

:root[data-theme='dark'] .icon-btn:hover {
  border-color: var(--bg-selected);
}
</style>
