<template>
  <div class="editor">
    <div v-if="!currentNote" class="empty-state">
      <p>选择一篇笔记开始编辑</p>
    </div>
    <div v-else class="editor-content">
      <div class="editor-header" :class="{ 'collapsed': isHeaderCollapsed }">
        <div class="header-top-row">
          <div class="title-row">
            <div class="title-left">
              <span class="note-type-icon svg-note-plain" v-if="currentNote.content_type === 'plain'" :title="typeTitle(currentNote.content_type)"></span>
              <span class="note-type-icon svg-note-markdown" v-else-if="currentNote.content_type === 'markdown'" :title="typeTitle(currentNote.content_type)"></span>
              <span class="note-type-icon svg-note-richtext" v-else-if="currentNote.content_type === 'richtext'" :title="typeTitle(currentNote.content_type)"></span>
              <span class="note-type-icon svg-note-plain" v-else :title="typeTitle(currentNote.content_type)"></span>
              <input
                v-model="title"
                class="title-input"
                placeholder="笔记标题"
                @blur="saveTitle"
                @keyup.enter="$event.target.blur()"
              />
              <span class="editor-type-label">{{ typeLabel(currentNote.content_type) }}</span>
            </div>
            <AttachmentPanel :note-id="currentNoteId" class="attachment-panel" />
          </div>
          <button
            v-show="!isHeaderCollapsed"
            class="toggle-btn"
            @click="toggleHeaderCollapse"
            title="收起头部"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
        <!-- 头部折叠时显示的展开按钮 -->
        <div v-show="isHeaderCollapsed" class="collapsed-header-content">
          <button class="expand-header-btn" @click="toggleHeaderCollapse" title="展开头部">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="editor-body">
        <keep-alive :max="maxCacheSize">
          <PlainTextEditor
            v-if="contentType === 'plain'"
            :key="currentNoteId"
            :content="content"
            :note-id="currentNoteId"
            @update="updateContent"
          />
          <MarkdownEditor
            v-else-if="contentType === 'markdown'"
            :key="currentNoteId"
            :content="content"
            :note-id="currentNoteId"
            @update="updateContent"
          />
          <RichTextEditor
            v-else-if="contentType === 'richtext'"
            :key="currentNoteId"
            :content="content"
            :note-id="currentNoteId"
            @update="updateContent"
          />
        </keep-alive>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useVault } from '../composables/useVault'
import PlainTextEditor from './PlainTextEditor.vue'
import MarkdownEditor from './MarkdownEditor.vue'
import RichTextEditor from './RichTextEditor.vue'
import AttachmentPanel from './AttachmentPanel.vue'

const { currentNote, currentNoteId, updateNote } = useVault()

const title = ref('')
const content = ref('')
const contentType = ref<'plain' | 'markdown' | 'richtext'>('plain')

// 头部折叠状态
const isHeaderCollapsed = ref(false)
// 编辑器实例缓存大小
const maxCacheSize = ref(20)

// 加载设置
onMounted(async () => {
  try {
    const uiSettings = await window.vaultAPI.settings.getUiDisplaySettings()
    isHeaderCollapsed.value = uiSettings.editorHeaderCollapsed
    maxCacheSize.value = await window.vaultAPI.settings.getEditorInstanceCacheSize()
  } catch (e) {
    console.error('[Editor] Error loading settings:', e)
  }
})

// 切换头部折叠状态
async function toggleHeaderCollapse() {
  isHeaderCollapsed.value = !isHeaderCollapsed.value
  try {
    await window.vaultAPI.settings.updateEditorHeaderCollapsed(isHeaderCollapsed.value)
  } catch (e) {
    console.error('[Editor] Error saving UI settings:', e)
  }
}

watch(currentNote, (note) => {
  if (note) {
    title.value = note.title
    content.value = note.content || ''
    contentType.value = note.content_type
  }
}, { immediate: true })

function typeLabel(type: string): string {
  const labels: Record<string, string> = { plain: '纯文本', markdown: 'Markdown', richtext: '富文本' }
  return labels[type] || type
}

function typeTitle(type: string): string {
  const titles: Record<string, string> = { plain: '纯文本', markdown: 'Markdown', richtext: '富文本' }
  return titles[type] || type
}

async function saveTitle() {
  if (currentNote.value && title.value !== currentNote.value.title) {
    await updateNote({ title: title.value })
  }
}

async function updateContent(newContent: string) {
  content.value = newContent
  await updateNote({ content: newContent })
}
</script>

<style scoped>
.editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  height: 100%;
  overflow: hidden;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.editor-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  flex: 1;
}

.editor-header {
  position: relative;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  overflow: hidden;
  max-height: 200px;
  transition: max-height 0.2s ease;
}

.editor-header.collapsed {
  max-height: 16px;
  padding: 0;
}

.editor-header.collapsed .header-top-row {
  visibility: hidden;
}

.collapsed-header-content {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 16px;
  display: none;
}

.editor-header.collapsed .collapsed-header-content {
  display: block;
}

.header-top-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.toggle-btn {
  background: none;
  border: none;
  width: 28px;
  height: 28px;
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: 8px;
  transition: all 0.2s ease;
}

.toggle-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.toggle-btn svg {
  transform: rotate(180deg);
}

.title-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
  flex: 1;
}

.title-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.note-type-icon {
  flex-shrink: 0;
  cursor: default;
  width: 18px;
  height: 18px;
  background-color: var(--text-primary);
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
}

.note-type-icon.svg-note-plain {
  -webkit-mask-image: url('../assets/icons/note-plain.svg');
  mask-image: url('../assets/icons/note-plain.svg');
}

.note-type-icon.svg-note-markdown {
  -webkit-mask-image: url('../assets/icons/note-markdown.svg');
  mask-image: url('../assets/icons/note-markdown.svg');
}

.note-type-icon.svg-note-richtext {
  -webkit-mask-image: url('../assets/icons/note-richtext.svg');
  mask-image: url('../assets/icons/note-richtext.svg');
}

/* 暗色主题下进一步降低图标亮度 */
:root[data-theme='dark'] .note-type-icon {
  filter: brightness(0.7);
}

.title-input {
  flex: 1;
  min-width: 100px;
  max-width: 400px;
  border: none;
  font-size: 20px;
  font-weight: 600;
  outline: none;
  background: transparent;
  color: var(--text-primary);
}

.title-input::placeholder {
  color: var(--text-secondary);
}

.editor-type-label {
  width: 100%;
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.attachment-panel {
  flex: 1;
}

.editor-tabs {
  display: flex;
  gap: 8px;
}

.tab-btn {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  cursor: pointer;
  font-size: 13px;
}

.tab-btn.active {
  background: var(--toolbar-active-bg);
  color: var(--toolbar-active-color);
  border-color: var(--toolbar-active-bg);
}

.editor-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.collapsed-header-bar {
  position: relative;
  height: 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-shrink: 0;
}

.expand-header-btn {
  position: absolute;
  right: 16px;
  top: 0;
  background: none;
  border: none;
  width: 28px;
  height: 16px;
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.expand-header-btn:hover {
  background: var(--bg-hover);
  color: var(--accent-color);
}
</style>
