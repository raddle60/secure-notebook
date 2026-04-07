<template>
  <div class="plain-editor">
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
      <select class="toolbar-select" v-model="selectedLanguage" title="语法高亮">
        <option value="">普通文本</option>
        <option value="javascript">JavaScript</option>
        <option value="typescript">TypeScript</option>
        <option value="python">Python</option>
        <option value="html">HTML</option>
        <option value="css">CSS</option>
        <option value="json">JSON</option>
        <option value="markdown">Markdown</option>
        <option value="sql">SQL</option>
        <option value="java">Java</option>
        <option value="cpp">C++</option>
        <option value="go">Go</option>
        <option value="rust">Rust</option>
        <option value="xml">XML</option>
        <option value="yaml">YAML</option>
        <option value="php">PHP</option>
        <option value="bash">Bash</option>
      </select>
      <div class="toolbar-divider"></div>
      <span class="toolbar-label">列编辑：Alt+ 拖动 | 多光标：Ctrl+ 点击</span>
      <div class="toolbar-spacer"></div>
    </div>

    <!-- 编辑器主体 -->
    <div class="editor-wrapper" ref="editorRef"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { EditorState, EditorSelection, ChangeSpec } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightSpecialChars, crosshairCursor, drawSelection, highlightWhitespace } from '@codemirror/view'
import { defaultKeymap, history as cmHistory, historyKeymap, indentWithTab } from '@codemirror/commands'
import { autocompletion, closeBrackets } from '@codemirror/autocomplete'
import { search, searchKeymap, openSearchPanel, highlightSelectionMatches, getSearchQuery } from '@codemirror/search'
import ContextMenu from './ContextMenu.vue'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { sql } from '@codemirror/lang-sql'
import { java } from '@codemirror/lang-java'
import { cpp } from '@codemirror/lang-cpp'
import { go } from '@codemirror/lang-go'
import { rust } from '@codemirror/lang-rust'
import { xml } from '@codemirror/lang-xml'
import { yaml } from '@codemirror/lang-yaml'
import { php } from '@codemirror/lang-php'
import { Compartment } from '@codemirror/state'
import { githubLight, githubDark } from '@uiw/codemirror-theme-github'
import mee from 'math-expression-evaluator'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { StreamLanguage } from '@codemirror/language'
import { ViewPlugin, ViewUpdate } from '@codemirror/view'

const mexp = new mee();

// Tab 键处理 - 直接插入 Tab 字符
function insertTab() {
  return EditorView.domEventHandlers({
    keydown(event, view) {
      if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        const selection = view.state.selection
        const changes = selection.ranges.map(range => {
          if (range.empty) {
            return { from: range.from, insert: '\t' }
          } else {
            return { from: range.from, to: range.to, insert: '\t' }
          }
        })
        // 计算新的光标位置（插入 Tab 后）
        const newSelection = selection.ranges.map(range => {
          const newFrom = range.from + 1
          return EditorSelection.cursor(newFrom)
        })
        view.dispatch({
          changes,
          selection: EditorSelection.create(newSelection, selection.mainIndex)
        })
        return true
      }
      return false
    }
  })
}

// 获取字符的视觉宽度（Tab 动态计算，非 ASCII 字符算 2 个单位，其他算 1 个单位）
// visualCol: 当前字符的视觉列位置（从 0 开始）
function getCharWidth(code: number, visualCol?: number): number {
  if (code === 9) { // Tab 字符
    if (visualCol === undefined) return 4
    // Tab 宽度 = 4 - (visualCol % 4)
    // 视觉列 0,4,8,12 → 宽度 4; 视觉列 1,5,9,13 → 宽度 3; 以此类推
    return 4 - (visualCol % 4)
  }
  if (code > 127) return 2  // 非 ASCII 字符（中文、全角等）
  return 1  // ASCII 字符
}

// 计算从行首到指定位置的视觉列数
function getVisualColumn(lineText: string, charIndex: number): number {
  let visualCol = 0
  for (let i = 0; i < charIndex && i < lineText.length; i++) {
    const code = lineText.charCodeAt(i)
    visualCol += getCharWidth(code, visualCol)
  }
  return visualCol
}

// 根据视觉列数反推字符索引
function getCharIndexFromVisualColumn(lineText: string, targetVisualCol: number): number {
  let visualCol = 0
  for (let i = 0; i < lineText.length; i++) {
    const code = lineText.charCodeAt(i)
    const charWidth = getCharWidth(code, visualCol)
    if (visualCol + charWidth > targetVisualCol) {
      return i
    }
    visualCol += charWidth
  }
  return lineText.length
}

// 自定义列选择扩展 - 支持中文字符按 2 个单位计算 + Tab 动态宽度
function chineseAwareRectangularSelection() {
  let rectStartAnchor: number | null = null
  let rectStartVisualCol: number | null = null
  let rectStartLineNum: number | null = null

  return ViewPlugin.fromClass(class {
    update(update: ViewUpdate) {
      // 状态清理在 mouseup 时处理
    }
  }, {
    eventHandlers: {
      mousedown(event, view) {
        // 只在 Alt 键按下时处理列选择
        if (!event.altKey) return false

        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        if (pos === null) return false

        event.preventDefault()
        rectStartAnchor = pos
        const startLine = view.state.doc.lineAt(pos)
        rectStartVisualCol = getVisualColumn(startLine.text, pos - startLine.from)
        rectStartLineNum = startLine.number

        function handleMouseMove(e: MouseEvent) {
          if (rectStartAnchor === null || rectStartVisualCol === null || rectStartLineNum === null) return

          const currentPos = view.posAtCoords({ x: e.clientX, y: e.clientY })
          if (currentPos === null) return

          const state = view.state
          const currentLine = state.doc.lineAt(currentPos)

          // 确定选择的行范围
          const minLineNum = Math.min(rectStartLineNum, currentLine.number)
          const maxLineNum = Math.max(rectStartLineNum, currentLine.number)

          // 计算结束位置的视觉列
          const endVisualCol = getVisualColumn(currentLine.text, currentPos - currentLine.from)

          // 确定左右视觉列边界
          const leftVisualCol = Math.min(rectStartVisualCol, endVisualCol)
          const rightVisualCol = Math.max(rectStartVisualCol, endVisualCol)

          // 构建新的选区
          const ranges = []
          for (let lineNum = minLineNum; lineNum <= maxLineNum; lineNum++) {
            const line = state.doc.line(lineNum)
            const leftCharIndex = getCharIndexFromVisualColumn(line.text, leftVisualCol)
            const rightCharIndex = getCharIndexFromVisualColumn(line.text, rightVisualCol)

            const lineFrom = line.from + leftCharIndex
            const lineTo = line.from + rightCharIndex

            if (lineFrom <= line.to && lineTo >= line.from) {
              ranges.push(EditorSelection.range(lineFrom, lineTo))
            }
          }

          if (ranges.length > 0) {
            view.dispatch({
              selection: EditorSelection.create(ranges, 0)
            })
          }
        }

        function handleMouseUp(e: MouseEvent) {
          document.removeEventListener('mousemove', handleMouseMove)
          document.removeEventListener('mouseup', handleMouseUp)
          rectStartAnchor = null
          rectStartVisualCol = null
          rectStartLineNum = null
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)

        return true
      }
    }
  })
}
// 列选择键盘快捷键 - 支持中文字符按 2 个单位计算 + Tab 动态宽度
function columnSelectionKeymap() {
  let rectAnchor: number | null = null
  let rectAnchorVisualCol: number | null = null

  // 重置状态的辅助函数
  const resetState = () => {
    rectAnchor = null
    rectAnchorVisualCol = null
  }

  return keymap.of([
    {
      key: 'Shift-Alt-ArrowDown',
      run: (view) => {
        const state = view.state
        const main = state.selection.main

        // 如果是第一次按下，记录 anchor 位置
        if (rectAnchor === null) {
          rectAnchor = main.anchor
          const anchorLine = state.doc.lineAt(main.anchor)
          rectAnchorVisualCol = getVisualColumn(anchorLine.text, main.anchor - anchorLine.from)
        }

        const anchorLine = state.doc.lineAt(rectAnchor!)
        const currentHeadLine = state.doc.lineAt(main.head)
        const nextLineNum = Math.min(currentHeadLine.number + 1, state.doc.lines)
        const nextLine = state.doc.line(nextLineNum)

        // 构建多行矩形选择
        const startLineNum = Math.min(anchorLine.number, nextLineNum)
        const endLineNum = Math.max(anchorLine.number, nextLineNum)
        const ranges = []

        for (let lineNum = startLineNum; lineNum <= endLineNum; lineNum++) {
          const line = state.doc.line(lineNum)
          const idx = getCharIndexFromVisualColumn(line.text, rectAnchorVisualCol!)
          const linePos = Math.min(line.from + idx, line.to)
          ranges.push(EditorSelection.range(linePos, linePos))
        }

        view.dispatch({
          selection: EditorSelection.create(ranges, 0)
        })
        return true
      }
    },
    {
      key: 'Shift-Alt-ArrowUp',
      run: (view) => {
        const state = view.state
        const main = state.selection.main

        // 如果是第一次按下，记录 anchor 位置
        if (rectAnchor === null) {
          rectAnchor = main.anchor
          const anchorLine = state.doc.lineAt(main.anchor)
          rectAnchorVisualCol = getVisualColumn(anchorLine.text, main.anchor - anchorLine.from)
        }

        const anchorLine = state.doc.lineAt(rectAnchor!)
        const currentHeadLine = state.doc.lineAt(main.head)
        const prevLineNum = Math.max(currentHeadLine.number - 1, 1)
        const prevLine = state.doc.line(prevLineNum)

        // 构建多行矩形选择
        const startLineNum = Math.min(anchorLine.number, prevLineNum)
        const endLineNum = Math.max(anchorLine.number, prevLineNum)
        const ranges = []

        for (let lineNum = startLineNum; lineNum <= endLineNum; lineNum++) {
          const line = state.doc.line(lineNum)
          const idx = getCharIndexFromVisualColumn(line.text, rectAnchorVisualCol!)
          const linePos = Math.min(line.from + idx, line.to)
          ranges.push(EditorSelection.range(linePos, linePos))
        }

        view.dispatch({
          selection: EditorSelection.create(ranges, 0)
        })
        return true
      }
    },
    // 其他按键时重置状态
    {
      key: 'any',
      run: () => {
        resetState()
        return false
      }
    }
  ])
}
const props = defineProps<{ content: string; noteId?: string | null }>()
const emit = defineEmits<{ update: [content: string] }>()

const editorRef = ref<HTMLDivElement | null>(null)
const showLineNumbers = ref(false)
const highlightSelection = ref(true)
const showWhitespace = ref(false)
const selectedLanguage = ref('')
// 字体设置从 CSS 变量读取，不再使用本地状态

// 右键菜单状态
const showContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })

let cmView: EditorView | null = null
let cmContent = ''
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let observer: MutationObserver | null = null

// 主题 Compartment，用于动态切换
const themeCompartment = new Compartment()
// 选中高亮 Compartment，用于动态开关
const highlightCompartment = new Compartment()
// 空白字符 Compartment，用于动态开关
const whitespaceCompartment = new Compartment()
// 字体样式 Compartment，用于动态更新字体
const fontCompartment = new Compartment()

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
  // 当 showWhitespace 为 true 时，全局显示空白字符
  if (showWhitespace.value) {
    return [highlightWhitespace()]
  }
  return []
}

// 获取字体样式扩展
function getFontStyle() {
  return EditorView.theme({
    '&': {
      fontFamily: 'var(--editor-font-family, Consolas, "Courier New", monospace)',
      fontSize: 'var(--editor-font-size, 14px)'
    },
    '.cm-content': {
      fontFamily: 'var(--editor-font-family, Consolas, "Courier New", monospace)',
      fontSize: 'var(--editor-font-size, 14px)'
    },
    '.cm-scroller': {
      fontFamily: 'var(--editor-font-family, Consolas, "Courier New", monospace)',
      fontSize: 'var(--editor-font-size, 14px)'
    }
  })
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

// 排序行函数
function sortLines(order: 'asc' | 'desc' = 'asc') {
  if (!cmView) return

  const state = cmView.state
  const selection = state.selection.main

  // 如果没有选中文字，使用整个文档内容
  // 如果选中了文字，需要扩展到整行
  let from = 0
  let to = state.doc.length

  if (!selection.empty) {
    const fromLine = state.doc.lineAt(selection.from)
    const toLine = state.doc.lineAt(selection.to)
    from = fromLine.from
    to = toLine.to
  }

  const text = state.sliceDoc(from, to)
  const lines = text.split('\n')
  const sorted = order === 'asc'
    ? lines.sort((a, b) => a.localeCompare(b, 'zh-CN'))
    : lines.sort((a, b) => b.localeCompare(a, 'zh-CN'))

  cmView.dispatch({
    changes: { from, to, insert: sorted.join('\n') }
  })
}

// 去重行函数
function removeDuplicateLines() {
  if (!cmView) return

  const state = cmView.state
  const selection = state.selection.main

  // 如果没有选中文字，使用整个文档内容
  // 如果选中了文字，需要扩展到整行
  let from = 0
  let to = state.doc.length

  if (!selection.empty) {
    const fromLine = state.doc.lineAt(selection.from)
    const toLine = state.doc.lineAt(selection.to)
    from = fromLine.from
    to = toLine.to
  }

  const text = state.sliceDoc(from, to)
  const lines = text.split('\n')
  const seen = new Set<string>()
  const unique: string[] = []

  for (const line of lines) {
    if (!seen.has(line)) {
      seen.add(line)
      unique.push(line)
    }
  }

  cmView.dispatch({
    changes: { from, to, insert: unique.join('\n') }
  })
}

// 去除空白函数
function trimWhitespace(trim: 'both' | 'start' | 'end') {
  if (!cmView) return

  const state = cmView.state
  const selection = state.selection.main

  // 如果没有选中文字，使用整个文档内容
  // 如果选中了文字，需要扩展到整行
  let from = 0
  let to = state.doc.length

  if (!selection.empty) {
    const fromLine = state.doc.lineAt(selection.from)
    const toLine = state.doc.lineAt(selection.to)
    from = fromLine.from
    to = toLine.to
  }

  const text = state.sliceDoc(from, to)
  const lines = text.split('\n')
  const trimmed: string[] = []

  for (const line of lines) {
    switch (trim) {
      case 'both':
        trimmed.push(line.trim())
        break
      case 'start':
        trimmed.push(line.trimStart())
        break
      case 'end':
        trimmed.push(line.trimEnd())
        break
    }
  }

  cmView.dispatch({
    changes: { from, to, insert: trimmed.join('\n') }
  })
}

// 检查是否是有效的数学表达式
function isValidMathExpression(text: string): boolean {
  if (!text || text.trim().length === 0) return false
  // 只包含数字、运算符、括号、小数点、空格和数学常数
  const validPattern = /^[\d+\-*/^().\sπpieE]+$/.test(text)
  if (!validPattern) return false
  // 不能以运算符开头（负号除外）
  if (/^[+*/^)]/.test(text.trim())) return false
  // 括号要匹配
  const openParens = (text.match(/\(/g) || []).length
  const closeParens = (text.match(/\)/g) || []).length
  if (openParens !== closeParens) return false
  try {
    const result = mexp.eval(text)
    return typeof result === 'number' && !isNaN(result)
  } catch {
    return false
  }
}

// 数学计算函数
function calculateExpression() {
  if (!cmView) return

  const state = cmView.state
  const selection = state.selection.main
  if (selection.empty) return

  const text = state.sliceDoc(selection.from, selection.to).trim()

  if (!isValidMathExpression(text)) return

  try {
    const result = mexp.eval(text)
    const resultText = ` = ${result}`
    cmView.dispatch({
      changes: { from: selection.to, insert: resultText }
    })
  } catch {
    // 计算失败，不处理
  }
}

// 获取当前选中的文本
function getSelectedText(): string {
  if (!cmView) return ''
  const selection = cmView.state.selection.main
  if (selection.empty) return ''
  return cmView.state.sliceDoc(selection.from, selection.to).trim()
}

// 选中整行函数
function selectLine() {
  if (!cmView) return

  const state = cmView.state

  // 获取搜索查询
  const searchQuery = getSearchQuery(state)

  if (searchQuery && searchQuery.search) {
    // 如果有搜索查询，获取所有匹配结果并选中所在行
    const matches: Array<{from: number, to: number}> = []
    const text = state.doc.toString()
    const searchStr = searchQuery.search
    const flags = searchQuery.caseSensitive ? 'g' : 'gi'

    try {
      const regex = new RegExp(searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
      let match
      while ((match = regex.exec(text)) !== null) {
        matches.push({ from: match.index, to: match.index + match[0].length })
      }
    } catch {
      // 正则表达式无效，不处理
    }

    if (matches.length > 0) {
      // 扩展所有匹配结果所在行到选中区域
      const newRanges = matches.map(m => {
        const fromLine = state.doc.lineAt(m.from)
        const toLine = state.doc.lineAt(m.to)
        return EditorSelection.range(fromLine.from, toLine.to)
      })

      cmView.dispatch({
        selection: EditorSelection.create(newRanges, 0),
        scrollIntoView: true,
        userEvent: 'select'
      })
      // 聚焦到编辑器
      cmView.focus()
      return
    }
  }

  // 没有搜索时，扩展当前选区到整行
  const selection = state.selection.main
  const ranges = state.selection.ranges

  // 遍历所有选区，扩展每个选区到整行
  const newRanges = ranges.map(range => {
    const fromLine = state.doc.lineAt(range.from)
    const toLine = state.doc.lineAt(range.to)
    return EditorSelection.range(fromLine.from, toLine.to)
  })

  cmView.dispatch({
    selection: EditorSelection.create(newRanges, state.selection.mainIndex)
  })
}

// 选中搜索结果函数
function selectSearchResults() {
  if (!cmView) return

  const state = cmView.state
  const searchQuery = getSearchQuery(state)

  // 没有搜索查询时，不做任何操作
  if (!searchQuery || !searchQuery.search) return

  // 获取所有匹配结果
  const matches: Array<{from: number, to: number}> = []
  const text = state.doc.toString()
  const searchStr = searchQuery.search
  const flags = searchQuery.caseSensitive ? 'g' : 'gi'

  try {
    const regex = new RegExp(searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
    let match
    while ((match = regex.exec(text)) !== null) {
      matches.push({ from: match.index, to: match.index + match[0].length })
    }
  } catch {
    // 正则表达式无效，不处理
  }

  // 有匹配结果时，选中所有匹配项
  if (matches.length > 0) {
    const newRanges = matches.map(m => EditorSelection.range(m.from, m.to))
    cmView.dispatch({
      selection: EditorSelection.create(newRanges, 0),
      scrollIntoView: true,
      userEvent: 'select'
    })
    // 聚焦到编辑器
    cmView.focus()
  }
}

// 右键菜单项
const contextMenuItems = [
  { label: '查找', icon: 'svg-search', action: () => openSearch() },
  { label: '选中搜索结果', icon: 'svg-target', action: () => selectSearchResults() },
  { label: '扩展选择整行', icon: 'svg-line', action: () => selectLine() },
  { label: '', icon: '', action: () => {}, separator: true },
  { label: '计算', icon: 'svg-calculate', action: () => calculateExpression(), disabled: true, dynamicDisable: true },
  { label: '', icon: '', action: () => {}, separator: true },
  { label: '转换为大写', icon: 'svg-uppercase', action: () => transformCase('upper') },
  { label: '转换为小写', icon: 'svg-lowercase', action: () => transformCase('lower') },
  { label: '首字母大写', icon: 'svg-capitalize', action: () => transformCase('capitalize') },
  { label: '', icon: '', action: () => {}, separator: true },
  { label: '去空白', icon: 'svg-trim', action: () => trimWhitespace('both') },
  { label: '去头部空白', icon: 'svg-trim-start', action: () => trimWhitespace('start') },
  { label: '去尾部空白', icon: 'svg-trim-end', action: () => trimWhitespace('end') },
  { label: '', icon: '', action: () => {}, separator: true },
  { label: '升序排序', icon: 'svg-sort-asc', action: () => sortLines('asc') },
  { label: '降序排序', icon: 'svg-sort-desc', action: () => sortLines('desc') },
  { label: '去除重复行', icon: 'svg-unique', action: () => removeDuplicateLines() }
]

// 查找函数
function openSearch() {
  if (cmView) {
    const selection = cmView.state.selection.main
    const selectedText = !selection.empty ? cmView.state.sliceDoc(selection.from, selection.to) : null

    openSearchPanel(cmView)

    if (selectedText) {
      setTimeout(() => {
        const searchInput = document.querySelector('.cm-searchPanel input[type="text"]') as HTMLInputElement
        if (searchInput && !searchInput.value) {
          searchInput.value = selectedText
          const event = new Event('input', { bubbles: true })
          searchInput.dispatchEvent(event)
        }
      }, 100)
    }
  }
}

// 获取语言扩展
function getLanguageExtension(lang: string) {
  switch (lang) {
    case 'javascript': return javascript()
    case 'typescript': return javascript({ typescript: true })
    case 'python': return python()
    case 'html': return html()
    case 'css': return css()
    case 'json': return json()
    case 'markdown': return markdown()
    case 'sql': return sql()
    case 'java': return java()
    case 'cpp': return cpp()
    case 'go': return go()
    case 'rust': return rust()
    case 'xml': return xml()
    case 'yaml': return yaml()
    case 'php': return php()
    case 'bash': return StreamLanguage.define(shell)
    default: return null
  }
}

// 加载保存的设置
async function loadSettings() {
  const settings = await window.vaultAPI.settings.getPlainTextEditorSettings()
  showLineNumbers.value = settings.showLineNumbers
  highlightSelection.value = settings.highlightSelection ?? true
  showWhitespace.value = settings.showWhitespace ?? false
  // 语言从笔记记录中加载
}

// 保存行号设置（全局）
function saveSettings() {
  window.vaultAPI.settings.updatePlainTextEditorSettings({
    showLineNumbers: showLineNumbers.value,
    highlightSelection: highlightSelection.value,
    showWhitespace: showWhitespace.value
  })
}

// 切换高亮
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

// 保存语言设置（笔记级别）
async function saveLanguage(language: string) {
  if (props.noteId) {
    await window.vaultAPI.notes.update(props.noteId, { language })
  }
}

// 初始化编辑器
function initEditor(content: string) {
  if (!editorRef.value) return

  cmContent = content

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      cmContent = update.state.doc.toString()
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        emit('update', cmContent)
      }, 500)
    }
  })

  const extensions = [
    highlightActiveLine(),
    highlightSpecialChars(),
    cmHistory(),
    autocompletion(),
    closeBrackets(),
    search({
      top: true
    }),
    highlightCompartment.of(getHighlightSelection()),
    whitespaceCompartment.of(getWhitespaceExtension()),
    fontCompartment.of(getFontStyle()),
    chineseAwareRectangularSelection(),
    columnSelectionKeymap(),
    crosshairCursor(),
    drawSelection(),
    EditorState.allowMultipleSelections.of(true),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    insertTab(),
    updateListener,
    EditorView.lineWrapping,
    themeCompartment.of(getHighlightStyle()),
  ]

  if (showLineNumbers.value) {
    extensions.unshift(lineNumbers())
  }

  const langExt = getLanguageExtension(selectedLanguage.value)
  if (langExt) {
    extensions.push(langExt)
  }

  const state = EditorState.create({
    doc: content,
    extensions: [
      ...extensions,
      EditorView.theme({
        '&': {
          fontVariantLigatures: 'none',
          textRendering: 'geometricPrecision'
        },
        '.cm-content': {
          fontVariantLigatures: 'none',
          textRendering: 'geometricPrecision'
        },
        '.cm-scroller': {
          fontVariantLigatures: 'none',
          textRendering: 'geometricPrecision'
        },
        // 列编辑视觉优化：使用 CSS 变量统一字符宽度感知
        '.cm-line': {
          letterSpacing: '0px'
        }
      })
    ],
  })

  cmView = new EditorView({
    state,
    parent: editorRef.value,
  })

  // 添加右键菜单事件处理
  editorRef.value.addEventListener('contextmenu', (event: MouseEvent) => {
    const pos = cmView!.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos !== null) {
      event.preventDefault()

      // 更新数学计算菜单的禁用状态
      const selectedText = getSelectedText()
      const mathMenuItem = contextMenuItems.find(item => item.label === '计算')
      if (mathMenuItem) {
        mathMenuItem.disabled = !isValidMathExpression(selectedText)
      }

      // 显示右键菜单
      contextMenuPosition.value = { x: event.clientX, y: event.clientY }
      showContextMenu.value = true
    }
  })
}

// 监听 noteId 变化，加载笔记的语言设置
watch(() => props.noteId, async (newNoteId) => {
  if (newNoteId) {
    const note = await window.vaultAPI.notes.get(newNoteId)
    // 笔记有语言设置时，更新 selectedLanguage 并重新初始化编辑器
    if (note && note.language) {
      selectedLanguage.value = note.language
    }
  }
}, { immediate: true })

// 切换行号显示
function toggleLineNumbers() {
  showLineNumbers.value = !showLineNumbers.value
  saveSettings()
  if (cmView && editorRef.value) {
    const content = cmContent
    cmView.destroy()
    cmView = null
    initEditor(content)
  }
}

// 改变语言（保存到笔记）
watch(selectedLanguage, (newLang, oldLang) => {
  // 只在语言真正改变时才重新初始化
  if (newLang !== oldLang) {
    saveLanguage(newLang)
    if (cmView && editorRef.value) {
      const content = cmContent
      cmView.destroy()
      cmView = null
      initEditor(content)
    }
  }
})

// 定义清理函数（在 setup 顶层）
const cleanupFns: (() => void)[] = []

onMounted(async () => {
  await loadSettings()
  initEditor(props.content || '')

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
        break
      }
    }
  })
  observer.observe(document.documentElement, { attributes: true })

  // 监听字体变化事件
  const handleFontChange = () => {
    if (cmView) {
      cmView.dispatch({
        effects: fontCompartment.reconfigure(getFontStyle())
      })
    }
  }
  window.addEventListener('editor-font-changed', handleFontChange)
  cleanupFns.push(() => {
    window.removeEventListener('editor-font-changed', handleFontChange)
  })
})

onBeforeUnmount(() => {
  cleanupFns.forEach(fn => fn())
  observer?.disconnect()
  cmView?.destroy()
})

watch(() => props.content, (newContent) => {
  if (cmView && newContent !== cmContent) {
    cmView.dispatch({
      changes: { from: 0, to: cmContent.length, insert: newContent || '' }
    })
  }
})
</script>

<style scoped>
.plain-editor {
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

.toolbar-select {
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  outline: none;
}

.toolbar-select:hover {
  background: var(--hover-bg);
}

.toolbar-select:focus {
  border-color: var(--accent-color);
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  margin: 0 8px;
  background: var(--border-color);
}

.toolbar-label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.toolbar-spacer {
  flex: 1;
}

.editor-wrapper {
  flex: 1;
  overflow: auto;
}

.editor-wrapper :deep(.cm-editor) {
  height: 100%;
}

.editor-wrapper :deep(.cm-scroller) {
  line-height: 1.6;
  padding: 12px;
}

.editor-wrapper :deep(.cm-content) {
  caret-color: var(--editor-cursor);
}

.editor-wrapper :deep(.cm-activeLine) {
  background: var(--editor-active-line);
}

.editor-wrapper :deep(.cm-gutters) {
  background: var(--editor-gutter-bg);
  border-right: 1px solid var(--border-color);
}

/* 搜索面板样式 */
.editor-wrapper :deep(.cm-searchPanel) {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 8px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.editor-wrapper :deep(.cm-searchPanel input[type="text"]) {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  width: 200px;
}

.editor-wrapper :deep(.cm-searchPanel input[type="text"]:focus) {
  outline: none;
  border-color: var(--accent-color);
}

/* 暗色主题下使用更柔和的聚焦边框 */
:root[data-theme='dark'] .editor-wrapper :deep(.cm-searchPanel input[type="text"]:focus) {
  border-color: var(--bg-selected);
}

.editor-wrapper :deep(.cm-searchPanel button) {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
}

.editor-wrapper :deep(.cm-searchPanel button:hover) {
  background: var(--hover-bg);
}

.editor-wrapper :deep(.cm-searchPanel label) {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 空白字符样式 - 暗色模式下降低亮度 */
/* 空格 */
.editor-wrapper :deep(.cm-highlightSpace) {
  opacity: 0.4;
}

/* Tab */
.editor-wrapper :deep(.cm-highlightTab) {
  opacity: 0.4;
}

[data-theme="dark"] .editor-wrapper :deep(.cm-highlightSpace) {
  opacity: 0.3;
}

[data-theme="dark"] .editor-wrapper :deep(.cm-highlightTab) {
  opacity: 0.4;
}
</style>
