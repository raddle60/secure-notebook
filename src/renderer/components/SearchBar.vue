<template>
  <div class="search-container">
    <div class="search-bar">
      <select v-model="scope" class="scope-select" @change="handleScopeChange">
        <option value="title">标题</option>
        <option value="content">全文</option>
      </select>
      <input
        ref="inputRef"
        v-model="query"
        type="text"
        placeholder="搜索..."
        class="search-input"
        @input="handleInput"
        @keydown="handleKeydown"
      />
      <button v-if="query" class="clear-btn" @click="clearSearch">×</button>
    </div>

    <!-- 搜索结果浮层 -->
    <div v-show="showDropdown" class="search-dropdown">
      <div v-show="isPerformingSearch" class="search-loading">
        搜索中...
      </div>
      <ul v-show="!isPerformingSearch && searchResults.length > 0" class="search-results">
        <li
          v-for="(result, index) in searchResults"
          :key="result.id || result.noteId"
          class="search-result-item"
          :class="{ selected: index === selectedIndex }"
          @click="selectResult(result)"
          tabindex="-1"
        >
          <div class="result-icon svg-note-plain" v-if="scope === 'title'"></div>
          <div class="result-icon svg-note-markdown" v-else></div>
          <div class="result-info">
            <div class="result-title">{{ result.title }}</div>
            <div class="result-path">
              <span v-for="(folder, folderIndex) in result.folderPath" :key="folderIndex">
                <span v-if="folderIndex > 0" class="path-separator"> / </span>
                {{ folder }}
              </span>
            </div>
          </div>
        </li>
      </ul>
      <div v-show="!isPerformingSearch && query && searchResults.length === 0" class="search-empty">
        未找到匹配的结果
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { useVault } from '../composables/useVault'

const { search, clearSearch: clear, searchResults, selectNote } = useVault()

const query = ref('')
const scope = ref<'title' | 'content'>('title')
const showDropdown = ref(false)
const selectedIndex = ref(-1) // 当前选中的结果索引，-1 表示搜索框
const inputRef = ref<HTMLElement | null>(null)
const isPerformingSearch = ref(false) // 本地搜索状态，用于内容搜索

// 用于内容搜索的防重入标志
let isContentSearching = false

function handleScopeChange() {
  // 切换搜索类型时清空搜索结果
  clearSearch()
}

function handleInput() {
  if (scope.value === 'title') {
    // 标题搜索：边输入边搜索
    performSearch()
  } else {
    // 内容搜索模式：不自动触发，等待回车
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    // 优先处理选中结果的选择
    if (selectedIndex.value >= 0 && searchResults.value.length > 0) {
      event.preventDefault()
      event.stopPropagation()
      const result = searchResults.value[selectedIndex.value]
      selectResult(result)
      return
    }

    // 没有选中结果时，才执行搜索逻辑
    if (scope.value === 'content' && !isContentSearching) {
      performSearch()
    }
    return
  }

  if (!showDropdown.value) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    // 向下移动：搜索框 -> 第一条结果 -> 第二条结果 -> ...
    if (selectedIndex.value < searchResults.value.length - 1) {
      selectedIndex.value++
    }
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    // 向上移动：... -> 第二条结果 -> 第一条结果 -> 搜索框
    if (selectedIndex.value > 0) {
      selectedIndex.value--
    } else if (selectedIndex.value === 0) {
      // 在第一条结果上按上，焦点回到搜索框
      selectedIndex.value = -1
      inputRef.value?.focus()
    }
  }
}

async function performSearch() {
  const currentQuery = query.value.trim()
  if (!currentQuery) {
    clear()
    return
  }

  // 内容搜索时才显示搜索中状态（因为内容搜索较慢）
  const isContentSearch = scope.value === 'content'
  if (isContentSearch) {
    isPerformingSearch.value = true
    isContentSearching = true
  }

  try {
    await search(query.value, scope.value)
    selectedIndex.value = -1 // 重置选中索引
  } finally {
    if (isContentSearch) {
      isPerformingSearch.value = false
      isContentSearching = false
    }
  }
}

function clearSearch() {
  query.value = ''
  clear()
  showDropdown.value = false
  selectedIndex.value = -1 // 重置选中索引
}

function selectResult(result: any) {
  const noteId = result.id || result.noteId
  selectNote(noteId)
  showDropdown.value = false
  selectedIndex.value = -1 // 重置选中索引
}

// 点击外部关闭浮层
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  // 如果点击的是搜索容器内部的元素，不关闭
  if (target.closest('.search-container')) {
    return
  }
  showDropdown.value = false
}

// 监听 showDropdown 变化来添加/移除全局监听
watch(showDropdown, (isShown) => {
  if (isShown) {
    // 使用 setTimeout 延迟添加，避免立即触发
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 50)
  } else {
    document.removeEventListener('mousedown', handleClickOutside)
  }
})

// 组件卸载时移除监听
onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})

// 监听搜索结果变化，当结果变化时确保浮层显示
watch([searchResults, isPerformingSearch], ([newResults, searching]) => {
  // 搜索进行中时，不更新浮层状态，避免闪烁
  if (searching) {
    return
  }
  if (!query.value.trim()) {
    showDropdown.value = false
    return
  }
  // 有搜索词时，保持浮层显示（无论是否有结果）
  showDropdown.value = true
})
</script>

<style scoped>
.search-container {
  position: relative;
  flex: 1;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
}

.scope-select {
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 13px;
  background: var(--bg-primary);
  color: var(--text-primary);
  outline: none;
}

.scope-select:focus {
  border-color: var(--bg-selected);
}

.search-input {
  flex: 1;
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 13px;
  background: var(--bg-primary);
  color: var(--text-primary);
  outline: none;
}

.search-input:focus {
  border-color: var(--bg-selected);
}

.search-input::placeholder {
  color: var(--text-secondary);
}

.clear-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0 8px;
}

.search-dropdown {
  position: absolute;
  top: 100%;
  left: 16px;
  right: 16px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 400px;
  overflow-y: auto;
  z-index: 1000;
}

.search-loading,
.search-empty {
  padding: 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}

.search-results {
  list-style: none;
  padding: 0;
  margin: 0;
}

.search-result-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
}

.search-result-item.selected {
  background: var(--bg-hover);
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background: var(--bg-hover);
}

.result-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  background-color: var(--text-primary);
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
}

.result-icon.svg-note-plain {
  -webkit-mask-image: url('../assets/icons/note-plain.svg');
  mask-image: url('../assets/icons/note-plain.svg');
}

.result-icon.svg-note-markdown {
  -webkit-mask-image: url('../assets/icons/note-markdown.svg');
  mask-image: url('../assets/icons/note-markdown.svg');
}

/* 暗色主题下进一步降低图标亮度 */
:root[data-theme='dark'] .result-icon {
  filter: brightness(0.7);
}

.result-info {
  flex: 1;
  min-width: 0;
}

.result-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-path {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path-separator {
  color: var(--text-secondary);
}
</style>
