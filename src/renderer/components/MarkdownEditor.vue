<template>
  <div class="markdown-editor">
    <!-- URL 链接对话框 -->
    <LinkDialog
      v-model="showUrlDialog"
      :note-id="noteId"
      link-type="url"
      @url-confirm="handleUrlConfirm"
    />
    <!-- 附件链接对话框 -->
    <LinkDialog
      v-model="showLinkDialog"
      :note-id="noteId"
      link-type="attachment"
      @select="handleLinkSelect"
    />
    <!-- 图片选择对话框 -->
    <ImageDialog
      v-model="showImageDialog"
      :note-id="noteId"
      @select="handleImageSelect"
    />
    <ConfirmDialog
      v-model="showConfirmDialog"
      title="下载附件"
      :message="`确定要下载附件「${downloadFilename}」吗？`"
      confirm-text="下载"
      @confirm="confirmDownload"
    />
    <!-- 右键菜单 -->
    <ContextMenu
      v-model="showContextMenu"
      :position="contextMenuPosition"
      :items="contextMenuItems"
    />
    <!-- 工具栏 -->
    <div class="editor-toolbar">
      <button
        class="toolbar-btn"
        :class="{ active: showLineNumbers }"
        @click="toggleLineNumbers"
        title="显示/隐藏行号"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="4" y1="6" x2="20" y2="6"></line>
          <line x1="4" y1="12" x2="14" y2="12"></line>
          <line x1="4" y1="18" x2="18" y2="18"></line>
        </svg>
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: highlightSelection }"
        @click="toggleHighlightSelection"
        title="选中文字自动高亮"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3-3m0 0l3 3m-3-3v8m-6 4h12a2 2 0 002-2v-5a2 2 0 00-2-2H5a2 2 0 00-2 2v5a2 2 0 002 2z"/>
          <path d="M12 3a3 3 0 100 6 3 3 0 000-6z"/>
        </svg>
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: showWhitespace }"
        @click="toggleWhitespace"
        title="显示/隐藏空白字符"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 6h16M4 12h16M4 18h16"/>
          <circle cx="8" cy="6" r="1" fill="currentColor"/>
          <circle cx="16" cy="6" r="1" fill="currentColor"/>
          <circle cx="8" cy="18" r="1" fill="currentColor"/>
          <circle cx="16" cy="18" r="1" fill="currentColor"/>
        </svg>
      </button>
      <div class="toolbar-divider"></div>
      <div class="toolbar-group">
        <button
          class="toolbar-btn"
          @click="setLink"
          title="添加链接"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </button>
        <button
          class="toolbar-btn"
          @click="showImageDialog = true"
          title="插入图片"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>
      </div>
      <div class="toolbar-divider"></div>
      <div class="toolbar-spacer"></div>
      <button
        class="toolbar-btn"
        :class="{ active: showSource }"
        @click="toggleSource"
        title="显示/隐藏源码"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
      </button>
      <button
        class="toolbar-btn"
        :class="{ active: showPreview }"
        @click="togglePreview"
        title="显示/隐藏预览"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      </button>
    </div>

    <!-- 编辑器主体 -->
    <div class="editor-panes">
      <!-- 左侧: CodeMirror 源码编辑 -->
      <div class="pane source-pane" v-show="showSource" :style="{ width: sourcePaneWidth + 'px' }">
        <div class="pane-header">Markdown 源码编辑</div>
        <div class="codemirror-wrapper" ref="sourceRef"></div>
      </div>

      <!-- 分割栏 -->
      <div
        v-if="showSource && showPreview"
        class="pane-divider"
        @mousedown="startDrag"
      >
        <div class="divider-handle"></div>
      </div>

      <!-- 右侧: Milkdown 只读预览 -->
      <div class="pane preview-pane" v-show="showPreview" :style="{ flex: showSource ? 'none' : '1' }">
        <div class="pane-header">Markdown 预览</div>
        <div class="milkdown-wrapper" ref="previewRef" @click="handlePreviewClick"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, editorStateCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { gfm } from '@milkdown/kit/preset/gfm'
import { clipboard } from '@milkdown/plugin-clipboard'
import { diagram, mermaidConfigCtx } from '@milkdown/plugin-diagram'
import { parserCtx } from '@milkdown/core'
import mermaid from 'mermaid'
import { EditorState, EditorSelection } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightSpecialChars, highlightWhitespace, drawSelection } from '@codemirror/view'
import { defaultKeymap, history as cmHistory, historyKeymap, indentWithTab } from '@codemirror/commands'
import { search, searchKeymap, openSearchPanel, highlightSelectionMatches } from '@codemirror/search'
import { Compartment } from '@codemirror/state'
import { githubLight, githubDark } from '@uiw/codemirror-theme-github'
import { markdown, markdownKeymap } from '@codemirror/lang-markdown'
import { autocompletion, closeBrackets } from '@codemirror/autocomplete'
import { imageInlineComponent, inlineImageConfig } from '@milkdown/kit/component/image-inline'
import LinkDialog from './LinkDialog.vue'
import ImageDialog from './ImageDialog.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import ContextMenu from './ContextMenu.vue'

const props = defineProps<{ content: string; noteId?: string | null }>()
const emit = defineEmits<{ update: [content: string] }>()

// 对话框状态
const showLinkDialog = ref(false)
const showUrlDialog = ref(false)
const showImageDialog = ref(false)
const showConfirmDialog = ref(false)
const downloadFilename = ref('')
const pendingDownloadId = ref<string | null>(null)

// 右键菜单状态
const showContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuAnchor = ref<{ from: number; to: number } | null>(null)

// 附件列表
const attachments = ref<any[]>([])

async function loadAttachments() {
  if (props.noteId) {
    attachments.value = await window.vaultAPI.attachments.list(props.noteId)
  }
}

watch(() => props.noteId, loadAttachments, { immediate: true })

// 面板显示状态
const showSource = ref(true)
const showPreview = ref(true)
const showLineNumbers = ref(false)
const highlightSelection = ref(true)
const showWhitespace = ref(false)
const sourceRef = ref<HTMLDivElement | null>(null)
const previewRef = ref<HTMLDivElement | null>(null)
const sourcePaneWidth = ref(300) // 默认宽度

// 拖动相关
let isDragging = false
let startX = 0
let startWidth = 0

// 编辑器实例
let milkdownEditor: Editor | null = null
let cmView: EditorView | null = null
let cmContent = ''
let observer: MutationObserver | null = null

// 主题 Compartment，用于动态切换
const themeCompartment = new Compartment()
// 选中高亮 Compartment，用于动态开关
const highlightCompartment = new Compartment()
// 空白字符 Compartment，用于动态开关
const whitespaceCompartment = new Compartment()

// 获取当前主题的高亮样式
function getHighlightStyle() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  return isDark ? githubDark : githubLight
}

// 获取选中高亮扩展
function getHighlightSelection() {
  return highlightSelection.value ? highlightSelectionMatches() : []
}

// 获取空白字符显示扩展
function getWhitespaceExtension() {
  if (showWhitespace.value) {
    return [highlightWhitespace(), drawSelection()]
  }
  return [drawSelection({ drawRangeCursor: false })]
}

// 加载保存的设置
async function loadSettings() {
  const settings = await window.vaultAPI.settings.getMarkdownEditorSettings()
  showLineNumbers.value = settings.showLineNumbers
  showSource.value = settings.showSource
  showPreview.value = settings.showPreview
  highlightSelection.value = settings.highlightSelection ?? true
  showWhitespace.value = settings.showWhitespace ?? false
  sourcePaneWidth.value = settings.sourcePaneWidth ?? 300
}

// 保存设置
function saveSettings() {
  window.vaultAPI.settings.updateMarkdownEditorSettings({
    showLineNumbers: showLineNumbers.value,
    showSource: showSource.value,
    showPreview: showPreview.value,
    highlightSelection: highlightSelection.value,
    showWhitespace: showWhitespace.value,
    sourcePaneWidth: sourcePaneWidth.value
  })
}

// 拖动相关函数
function startDrag(e: MouseEvent) {
  isDragging = true
  startX = e.clientX
  startWidth = sourcePaneWidth.value
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onDrag(e: MouseEvent) {
  if (!isDragging) return
  const deltaX = e.clientX - startX
  const newWidth = Math.max(200, Math.min(800, startWidth + deltaX))
  sourcePaneWidth.value = newWidth
}

function stopDrag() {
  isDragging = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  saveSettings()
}

// 切换源码面板
function toggleSource() {
  showSource.value = !showSource.value
  if (!showSource.value && !showPreview.value) {
    showPreview.value = true
  }
  saveSettings()
}

// 切换预览面板
function togglePreview() {
  showPreview.value = !showPreview.value
  if (!showPreview.value && !showSource.value) {
    showSource.value = true
  }
  saveSettings()
}

// 切换选中高亮
function toggleHighlightSelection() {
  highlightSelection.value = !highlightSelection.value
  saveSettings()
  // 动态更新扩展
  if (cmView) {
    cmView.dispatch({
      effects: highlightCompartment.reconfigure(getHighlightSelection())
    })
  }
}

// 切换空白字符显示
function toggleWhitespace() {
  showWhitespace.value = !showWhitespace.value
  saveSettings()
  // 动态更新扩展
  if (cmView) {
    cmView.dispatch({
      effects: whitespaceCompartment.reconfigure(getWhitespaceExtension())
    })
  }
}

// 设置链接
function setLink() {
  showLinkDialog.value = true
}

// 处理 URL 链接确认
function handleUrlConfirm(url: string) {
  const markdownLink = `[${url}](${url})`
  insertMarkdown(markdownLink)
}

// 处理附件链接选择
function handleLinkSelect(data: { id: string; filename: string; href?: string }) {
  const href = data.href || `http://attachment/${data.id}`
  const markdownLink = `[${data.filename}](${href})`
  insertMarkdown(markdownLink)
}

// 处理图片选择
function handleImageSelect(data: { id: string; filename: string; data: string }) {
  const markdownImage = `![${data.filename}](http://attach_image/${data.id})`
  insertMarkdown(markdownImage)
}

// 插入 markdown 文本
function insertMarkdown(text: string) {
  if (cmView) {
    const docLength = cmView.state.doc.length
    const range = cmView.state.selection.main
    const from = Math.min(range.from, docLength)
    const to = Math.min(range.to, docLength)
    cmView.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length }
    })
    // 同步到 Milkdown
    cmContent = cmView.state.doc.toString()
    updateMilkdown(cmContent)
    emit('update', cmContent)
  }
}

// 更新 CodeMirror 内容
function updateCodeMirror(content: string) {
  if (cmView) {
    cmView.dispatch({
      changes: { from: 0, to: cmView.state.doc.length, insert: content }
    })
    cmContent = content
  }
}

// 大小写转换函数
function transformCase(transform: 'upper' | 'lower' | 'capitalize' | 'toggle') {
  if (!cmView) return

  const state = cmView.state
  const selection = state.selection.main
  if (selection.empty) return

  const text = state.sliceDoc(selection.from, selection.to)
  let transformed: string

  switch (transform) {
    case 'upper':
      transformed = text.toUpperCase()
      break
    case 'lower':
      transformed = text.toLowerCase()
      break
    case 'capitalize':
      transformed = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
      break
    case 'toggle':
      transformed = text.split('').map(c =>
        c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()
      ).join('')
      break
  }

  cmView.dispatch({
    changes: { from: selection.from, to: selection.to, insert: transformed }
  })
}

// 右键菜单项
const contextMenuItems = [
  { label: '查找', icon: 'svg-search', action: () => openSearch() },
  { label: '', icon: '', action: () => {}, separator: true },
  { label: '转换为大写', icon: 'svg-uppercase', action: () => transformCase('upper') },
  { label: '转换为小写', icon: 'svg-lowercase', action: () => transformCase('lower') },
  { label: '首字母大写', icon: 'svg-capitalize', action: () => transformCase('capitalize') }
]

// 查找相关函数
function openSearch() {
  if (cmView) {
    // 如果有选中的文字，自动填充到搜索框
    const selection = cmView.state.selection.main
    const selectedText = !selection.empty ? cmView.state.sliceDoc(selection.from, selection.to) : null

    // 打开搜索面板
    openSearchPanel(cmView)

    // 打开搜索面板后，将选中的文字填充到搜索框
    if (selectedText) {
      setTimeout(() => {
        const searchInput = document.querySelector('.cm-searchPanel input[type="text"]') as HTMLInputElement
        if (searchInput && !searchInput.value) {
          searchInput.value = selectedText
          // 触发搜索
          const event = new Event('input', { bubbles: true })
          searchInput.dispatchEvent(event)
        }
      }, 100)
    }
  }
}

// 处理 Milkdown 点击事件（附件下载）
function handlePreviewClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  const link = target.closest('a')

  if (link) {
    const href = link.getAttribute('href')

    if (href?.startsWith('http://attachment/')) {
      // 附件链接：仅在 Ctrl+左键 时下载
      if (event.ctrlKey) {
        event.preventDefault()
        const attachmentId = href.replace('http://attachment/', '')
        const att = attachments.value.find(a => a.id === attachmentId)
        downloadFilename.value = att?.filename || '附件'
        pendingDownloadId.value = attachmentId
        showConfirmDialog.value = true
      }
    } else if (event.ctrlKey && href) {
      // Ctrl + 左键：在默认浏览器中打开
      event.preventDefault()
      window.open(href, '_blank')
    }
  }
}

// 确认下载附件
async function confirmDownload() {
  if (!pendingDownloadId.value) return
  await downloadAttachment(pendingDownloadId.value)
  pendingDownloadId.value = null
}

// 下载附件
async function downloadAttachment(attachmentId: string) {
  const data = await window.vaultAPI.attachments.get(attachmentId)
  if (!data) return

  const att = attachments.value.find(a => a.id === attachmentId)
  const filename = att?.filename || 'attachment'

  const byteCharacters = atob(data.data)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray])
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// 初始化 CodeMirror
function initCodeMirror(content: string) {
  if (!sourceRef.value) return

  cmContent = content

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      cmContent = update.state.doc.toString()
      updateMilkdown(cmContent)
      emit('update', cmContent)
    }
  })

  const extensions = [
    highlightActiveLine(),
    highlightSpecialChars(),
    cmHistory(),
    autocompletion(),
    closeBrackets(),
    search({
      top: true  // 搜索框显示在顶部
    }),
    highlightCompartment.of(getHighlightSelection()),
    whitespaceCompartment.of(getWhitespaceExtension()),
    keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...markdownKeymap, ...searchKeymap]),
    markdown(),
    updateListener,
    EditorView.lineWrapping,
    themeCompartment.of(getHighlightStyle()),
  ]

  if (showLineNumbers.value) {
    extensions.unshift(lineNumbers())
  }

  const state = EditorState.create({
    doc: content,
    extensions,
  })

  cmView = new EditorView({
    state,
    parent: sourceRef.value
  })

  // 添加右键菜单事件处理
  sourceRef.value.addEventListener('contextmenu', (event: MouseEvent) => {
    const pos = cmView!.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos !== null) {
      event.preventDefault()

      // 保持当前选区，不取消选择
      const selection = cmView!.state.selection

      // 显示右键菜单
      contextMenuPosition.value = { x: event.clientX, y: event.clientY }
      contextMenuAnchor.value = { from: pos, to: pos }
      showContextMenu.value = true
    }
  })
}

// 切换行号显示
function toggleLineNumbers() {
  showLineNumbers.value = !showLineNumbers.value
  saveSettings()
  if (cmView && sourceRef.value) {
    const content = cmContent
    cmView.destroy()
    cmView = null
    initCodeMirror(content)
  }
}

// 图片 URL 拦截器：将 attach_image URL 转换为实际数据
async function proxyImageUrl(url: string): Promise<string> {
  if (url.startsWith('http://attach_image/')) {
    const id = url.replace('http://attach_image/', '')
    const data = await window.vaultAPI.attachments.get(id)
    if (data) {
      const att = attachments.value.find(a => a.id === id)
      const mimeType = att?.mime_type || 'image/png'
      return `data:${mimeType};base64,${data.data}`
    }
  }
  return url
}

// 初始化 Milkdown
async function initMilkdown(content: string) {
  if (!previewRef.value) return

  // 初始化 mermaid
  mermaid.initialize({
    startOnLoad: false,
    theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default',
  })

  milkdownEditor = Editor.make()

  milkdownEditor
    .config((ctx) => {
      ctx.set(rootCtx, previewRef.value!)
      ctx.set(defaultValueCtx, content || '')
      ctx.set(inlineImageConfig.key, {
        proxyDomURL: proxyImageUrl,
      })
      ctx.set(mermaidConfigCtx.key, {
        startOnLoad: false,
        theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default',
      })
    })
    .use(commonmark)
    .use(gfm)
    .use(clipboard)
    .use(imageInlineComponent)
    .use(diagram)

  await milkdownEditor.create()

  // 为 diagram 节点添加 NodeView 来渲染 mermaid
  milkdownEditor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    view.dom.setAttribute('contenteditable', 'false')
    view.dom.style.cursor = 'default'
  })

  // 渲染 mermaid 图表
  renderMermaidDiagrams()
}

// 渲染 mermaid 图表
async function renderMermaidDiagrams() {
  if (!previewRef.value) return

  const diagramElements = previewRef.value.querySelectorAll<HTMLDivElement>('div[data-type="diagram"]')
  if (diagramElements.length === 0) return

  for (const diagramEl of diagramElements) {
    const code = diagramEl.dataset.value || diagramEl.textContent || ''
    const id = diagramEl.dataset.id || `mermaid-${Date.now()}`

    if (!code.trim()) continue

    try {
      // 检查代码是否有效
      const { svg } = await mermaid.render(id, code)
      diagramEl.innerHTML = svg
    } catch (error) {
      // 渲染失败时显示错误信息
      diagramEl.innerHTML = `<div style="color: #ef4444; padding: 10px; background: #fee2e2; border-radius: 4px;">Mermaid 渲染失败：${code.substring(0, 50)}...</div>`
    }
  }
}

// 更新 Milkdown 内容
function updateMilkdown(content: string) {
  if (milkdownEditor) {
    milkdownEditor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const state = ctx.get(editorStateCtx)
      const parser = ctx.get(parserCtx)
      // 将 HTML <br/> 标签转换为 Markdown 硬行 breaks（两个空格 + 换行）
      const processedContent = content.replace(/<br\s*\/?>/gi, '  \n')
      const newDoc = parser(processedContent)
      view.dispatch(state.tr.replaceWith(0, state.doc.content.size, newDoc.content))
    })
    // 更新后重新渲染 mermaid 图表
    renderMermaidDiagrams()
  }
}

onMounted(async () => {
  await loadSettings()
  await initMilkdown(props.content || '')
  initCodeMirror(props.content || '')

  // 使用 MutationObserver 监听主题变化
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
        if (cmView) {
          // 使用 reconfigure 动态切换主题
          cmView.dispatch({
            effects: themeCompartment.reconfigure(getHighlightStyle())
          })
        }
        // 切换 Mermaid 主题并重新渲染
        if (milkdownEditor) {
          const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
          mermaid.initialize({
            startOnLoad: false,
            theme: isDark ? 'dark' : 'default',
          })
          // 重新渲染 Mermaid 图表
          renderMermaidDiagrams()
        }
        break
      }
    }
  })
  observer.observe(document.documentElement, { attributes: true })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  milkdownEditor?.destroy()
  cmView?.destroy()
  // 清理拖动事件监听器
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
})

watch(() => props.content, (newContent) => {
  if (newContent !== undefined && cmView && milkdownEditor) {
    const cmContent = cmView.state.doc.toString()
    if (newContent !== cmContent) {
      cmView.dispatch({
        changes: { from: 0, to: cmContent.length, insert: newContent },
      })
    }
    updateMilkdown(newContent)
  }
})
</script>

<style scoped>
.markdown-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-wrap: wrap;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.15s ease;
}

.toolbar-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}

.toolbar-btn.active {
  background: var(--toolbar-active-bg);
  color: var(--toolbar-active-color);
  border-color: var(--toolbar-active-bg);
}

.toolbar-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar-btn svg {
  width: 18px;
  height: 18px;
}

.toolbar-spacer {
  flex: 1;
}

.toolbar-divider {
  width: 1px;
  height: 18px;
  background: var(--border-color);
  margin: 0 4px;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 1px;
}

.toolbar-hint {
  font-size: 11px;
  color: var(--text-secondary);
}

.icon {
  font-family: monospace;
}

.editor-panes {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.pane {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pane-divider {
  width: 4px;
  cursor: col-resize;
  background: var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.pane-divider:hover {
  background: var(--accent-color);
}

.divider-handle {
  width: 2px;
  height: 30px;
  background: var(--text-secondary);
  border-radius: 2px;
  opacity: 0.5;
}

.pane-divider:hover .divider-handle {
  opacity: 1;
}

.source-pane {
  border-right: 1px solid var(--border-color);
}

.pane-header {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.codemirror-wrapper {
  flex: 1;
  overflow: auto;
}

/* 搜索面板样式 */
.codemirror-wrapper :deep(.cm-searchPanel) {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 8px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.codemirror-wrapper :deep(.cm-searchPanel input[type="text"]) {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  width: 200px;
}

.codemirror-wrapper :deep(.cm-searchPanel input[type="text"]:focus) {
  outline: none;
  border-color: var(--accent-color);
}

/* 暗色主题下使用更柔和的聚焦边框 */
:root[data-theme='dark'] .codemirror-wrapper :deep(.cm-searchPanel input[type="text"]:focus) {
  border-color: var(--bg-selected);
}

.codemirror-wrapper :deep(.cm-searchPanel button) {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
}

.codemirror-wrapper :deep(.cm-searchPanel button:hover) {
  background: var(--hover-bg);
}

.codemirror-wrapper :deep(.cm-searchPanel label) {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 空白字符样式 - 暗色模式下降低亮度 */
/* 空格 */
.codemirror-wrapper :deep(.cm-highlightSpace) {
  opacity: 0.4;
}

/* Tab */
.codemirror-wrapper :deep(.cm-highlightTab) {
  opacity: 0.4;
}

[data-theme="dark"] .codemirror-wrapper :deep(.cm-highlightSpace) {
  opacity: 0.3;
}

[data-theme="dark"] .codemirror-wrapper :deep(.cm-highlightTab) {
  opacity: 0.4;
}

.codemirror-wrapper :deep(.cm-editor) {
  height: 100%;
}

.codemirror-wrapper :deep(.cm-scroller) {
  font-family: var(--editor-font-family, 'Consolas, "Courier New", monospace');
  font-size: var(--editor-font-size, 14px);
  line-height: 1.6;
  padding: 12px;
}

.codemirror-wrapper :deep(.cm-content) {
  caret-color: var(--editor-cursor);
}

.codemirror-wrapper :deep(.cm-activeLine) {
  background: var(--editor-active-line);
}

.codemirror-wrapper :deep(.cm-gutters) {
  background: var(--editor-gutter-bg);
  border-right: 1px solid var(--border-color);
}

.milkdown-wrapper {
  flex: 1;
  overflow: auto;
}

.milkdown-wrapper :deep(.milkdown) {
  height: 100%;
  padding: 16px;
  outline: none;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--editor-font-family, 'Consolas, "Courier New", monospace');
  font-size: var(--editor-font-size, 14px);
}

/* 只读模式：允许文本选中和复制 */
.milkdown-wrapper :deep(.ProseMirror) {
  background: var(--bg-primary);
  color: var(--text-primary);
  user-select: text;
  -webkit-user-select: text;
  font-family: var(--editor-font-family, 'Consolas, "Courier New", monospace');
  font-size: var(--editor-font-size, 14px);
}

/* 链接和图片可以点击 */
.milkdown-wrapper :deep(.milkdown a),
.milkdown-wrapper :deep(.milkdown img) {
  cursor: pointer;
}

/* 暗色主题下的 Milkdown 样式 */
:root[data-theme='dark'] .milkdown-wrapper :deep(.milkdown) {
  background: var(--bg-primary);
  color: var(--text-primary);
}

:root[data-theme='dark'] .milkdown-wrapper :deep(.ProseMirror) {
  background: var(--bg-primary);
  color: var(--text-primary);
}

:root[data-theme='dark'] .milkdown-wrapper :deep(.ProseMirror-focused) {
  background: var(--bg-primary);
}

:root[data-theme='dark'] .milkdown-wrapper :deep(.milkdown h1),
:root[data-theme='dark'] .milkdown-wrapper :deep(.milkdown h2),
:root[data-theme='dark'] .milkdown-wrapper :deep(.milkdown h3),
:root[data-theme='dark'] .milkdown-wrapper :deep(.milkdown h4),
:root[data-theme='dark'] .milkdown-wrapper :deep(.milkdown h5),
:root[data-theme='dark'] .milkdown-wrapper :deep(.milkdown h6) {
  color: var(--text-primary);
}

:root[data-theme='dark'] .milkdown-wrapper :deep(.milkdown p) {
  color: var(--text-primary);
}

:root[data-theme='dark'] .milkdown-wrapper :deep(.milkdown li) {
  color: var(--text-primary);
}

:root[data-theme='dark'] .milkdown-wrapper :deep(.milkdown blockquote) {
  border-left-color: var(--border-color);
  color: var(--text-secondary);
}

:root[data-theme='dark'] .milkdown-wrapper :deep(.milkdown table) {
  border-color: var(--border-color);
}

.milkdown-wrapper :deep(.milkdown table) {
  border-collapse: collapse;
  margin: 0.1em 0;
  width: 100%;
  font-family: var(--editor-font-family, 'Consolas, "Courier New", monospace') !important;
  font-size: var(--editor-font-size, 14px) !important;
}

:root[data-theme='dark'] .milkdown-wrapper :deep(.milkdown table th),
:root[data-theme='dark'] .milkdown-wrapper :deep(.milkdown table td) {
  border-color: var(--border-color);
  color: var(--text-primary);
}

:root[data-theme='dark'] .milkdown-wrapper :deep(.milkdown table th) {
  background: var(--bg-secondary);
}

:root[data-theme='dark'] .milkdown-wrapper :deep(.milkdown hr) {
  border-color: var(--border-color);
}

:root[data-theme='dark'] .milkdown-wrapper :deep(.milkdown a) {
  color: var(--accent-color);
}

:root[data-theme='dark'] .milkdown-wrapper :deep(.milkdown strong) {
  color: var(--text-primary);
}

:root[data-theme='dark'] .milkdown-wrapper :deep(.milkdown em) {
  color: var(--text-primary);
}

/* 暗色主题下的文本选中样式 */
:root[data-theme='dark'] .milkdown-wrapper :deep(.milkdown ::selection) {
  background: var(--editor-selection);
}

:root[data-theme='dark'] .milkdown-wrapper :deep(.ProseMirror ::selection) {
  background: var(--editor-selection);
}

:root[data-theme='dark'] .milkdown-wrapper :deep(.ProseMirror-focused ::selection) {
  background: var(--editor-selection);
}

.milkdown-wrapper :deep(.ProseMirror) {
  padding: 0 !important;
}

.milkdown-wrapper :deep(.milkdown .ProseMirror p) {
  padding: 1px 0;
}

.milkdown-wrapper :deep(.milkdown p) {
  margin: 0.1em 0;
  line-height: 1.6;
  font-family: var(--editor-font-family, 'Consolas, "Courier New", monospace') !important;
  font-size: var(--editor-font-size, 14px) !important;
}

.milkdown-wrapper :deep(.milkdown h1),
.milkdown-wrapper :deep(.milkdown h2),
.milkdown-wrapper :deep(.milkdown h3),
.milkdown-wrapper :deep(.milkdown h4),
.milkdown-wrapper :deep(.milkdown h5),
.milkdown-wrapper :deep(.milkdown h6) {
  margin-top: 0.1em;
  margin-bottom: 0.1em;
  font-weight: 600;
  font-family: var(--editor-font-family, 'Consolas, "Courier New", monospace') !important;
}

.milkdown-wrapper :deep(.milkdown code) {
  background: var(--code-bg);
  padding: 0.1em 0.3em;
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', monospace !important;
  color: var(--text-primary);
}

.milkdown-wrapper :deep(.milkdown pre) {
  background: var(--code-bg);
  padding: 0.5em 1em;
  border-radius: 5px;
  overflow-x: auto;
  border: 1px solid var(--code-border);
  margin: 0.1em 0;
}

.milkdown-wrapper :deep(.milkdown pre code) {
  background: none;
  padding: 0;
}

.milkdown-wrapper :deep(.milkdown blockquote) {
  border-left: 3px solid var(--border-color);
  margin-left: 0;
  padding-left: 1em;
  color: var(--text-secondary);
  margin: 0.1em 0;
  font-family: var(--editor-font-family, 'Consolas, "Courier New", monospace') !important;
  font-size: var(--editor-font-size, 14px) !important;
}

.milkdown-wrapper :deep(.milkdown ul),
.milkdown-wrapper :deep(.milkdown ol) {
  margin: 0.1em 0;
  padding-left: 1.5em;
  font-family: var(--editor-font-family, 'Consolas, "Courier New", monospace') !important;
  font-size: var(--editor-font-size, 14px) !important;
}

.milkdown-wrapper :deep(.milkdown a) {
  color: var(--accent-color);
  text-decoration: underline;
}

.milkdown-wrapper :deep(.milkdown img) {
  max-width: 100%;
}

/* 任务列表（GFM）样式 */
.milkdown-wrapper :deep(.milkdown li[data-item-type="task"]) {
  list-style: none;
  position: relative;
  padding-left: 24px;
}

.milkdown-wrapper :deep(.milkdown li[data-item-type="task"])::before {
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-color);
  border-radius: 3px;
  background: var(--bg-primary);
  cursor: pointer;
}

.milkdown-wrapper :deep(.milkdown li[data-item-type="task"][data-checked="true"])::before {
  content: '✓';
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  font-weight: bold;
}

/* 亮色主题下的任务列表 */
:root[data-theme='light'] .milkdown-wrapper :deep(.milkdown li[data-item-type="task"][data-checked="true"])::before {
  background: #2da44e;
  border-color: #2da44e;
}

/* 暗色主题下的任务列表 - 使用更柔和的绿色 */
.milkdown-wrapper :deep(.milkdown li[data-item-type="task"][data-checked="true"])::before {
  background: #2da44e;
  border-color: #2da44e;
}

/* Mermaid 图表样式 */
.milkdown-wrapper :deep(.milkdown div[data-type="diagram"]) {
  margin: 1em 0;
  padding: 1em;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.milkdown-wrapper :deep(.milkdown div[data-type="diagram"]) svg {
  max-width: 100%;
  height: auto;
}

:root[data-theme='dark'] .milkdown-wrapper :deep(.milkdown div[data-type="diagram"]) {
  background: #161b22;
  border-color: #30363d;
}
</style>
