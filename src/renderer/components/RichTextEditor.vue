<template>
  <div class="richtext-editor">
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
    <!-- 搜索替换对话框 -->
    <SearchReplaceDialog
      v-model="showSearchDialog"
      :editor="editor"
      :initial-search-text="selectedText"
      @close="handleSearchClose"
    />
    <!-- 右键菜单 -->
    <ContextMenu
      v-model="showContextMenu"
      :position="contextMenuPosition"
      :items="contextMenuItems"
    />
    <div class="toolbar" v-if="editor">
      <!-- 格式刷 -->
      <div class="toolbar-group">
        <button
          @click="toggleFormatBrush"
          :class="{ active: isFormatBrushActive }"
          title="格式刷"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 2h8v8H6l2-8z"/>
            <path d="M5 14l-3 6"/>
            <path d="M9 14l-3 6"/>
            <path d="M13 14l-3 6"/>
            <path d="M17 14l-3 6"/>
            <path d="M21 14l-3 6"/>
          </svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <!-- 字体选择器 -->
      <div class="toolbar-group">
        <div class="dropdown" v-if="editor">
          <button
            @click="showFontFamilyMenu = !showFontFamilyMenu"
            class="dropdown-btn"
            title="字体"
          >
            <span class="dropdown-label">{{ getFontFamilyLabel }}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <div v-if="showFontFamilyMenu" class="dropdown-menu font-menu" @click.stop>
            <div
              v-for="font in fontOptions"
              :key="font.value"
              @click="setFontFamily(font.value)"
              class="dropdown-item"
              :class="{ active: editor.isActive('textStyle', { fontFamily: font.value || null }) }"
              :style="{ fontFamily: font.value || undefined }"
            >
              {{ font.label }}
            </div>
          </div>
        </div>
      </div>

      <!-- 字号选择器 -->
      <div class="toolbar-group">
        <div class="dropdown" v-if="editor">
          <button
            @click="showFontSizeMenu = !showFontSizeMenu"
            class="dropdown-btn"
            title="字号"
          >
            <span class="dropdown-label">{{ getFontSizeLabel }}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <div v-if="showFontSizeMenu" class="dropdown-menu font-size-menu" @click.stop>
            <div
              v-for="size in fontSizeOptions"
              :key="size.value"
              @click="setFontSize(size.value)"
              class="dropdown-item"
              :class="{ active: editor.isActive('textStyle', { fontSize: size.value || null }) }"
            >
              {{ size.label }}
            </div>
          </div>
        </div>
      </div>

      <!-- 字体颜色选择器 -->
      <div class="toolbar-group">
        <div class="dropdown" v-if="editor">
          <button
            @click="showColorMenu = !showColorMenu"
            class="dropdown-btn color-btn"
            title="字体颜色"
          >
            <span class="color-indicator" :style="{ backgroundColor: currentColor }"></span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <div v-if="showColorMenu" class="dropdown-menu color-menu" @click.stop>
            <div class="color-grid">
              <div
                v-for="color in colorOptions"
                :key="color"
                @click="setFontColor(color)"
                class="color-swatch"
                :style="{ backgroundColor: color }"
                :title="color"
              ></div>
            </div>
            <button @click="clearFontColor" class="clear-color-btn">清除颜色</button>
          </div>
        </div>
      </div>

      <!-- 文字高亮选择器 -->
      <div class="toolbar-group">
        <div class="dropdown" v-if="editor">
          <button
            @click="showHighlightMenu = !showHighlightMenu"
            class="dropdown-btn color-btn"
            title="文字高亮"
          >
            <span class="color-indicator" :style="{ backgroundColor: currentHighlight }"></span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <div v-if="showHighlightMenu" class="dropdown-menu color-menu" @click.stop>
            <div class="color-grid">
              <div
                v-for="color in colorOptions"
                :key="color"
                @click="setHighlightColor(color)"
                class="color-swatch"
                :style="{ backgroundColor: color }"
                :title="color"
              ></div>
            </div>
            <button @click="clearHighlight" class="clear-color-btn">清除高亮</button>
          </div>
        </div>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button
          @click="editor.chain().focus().toggleBold().run()"
          :class="{ active: editor.isActive('bold') }"
          title="粗体 (Ctrl+B)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
            <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
          </svg>
        </button>
        <button
          @click="editor.chain().focus().toggleItalic().run()"
          :class="{ active: editor.isActive('italic') }"
          title="斜体 (Ctrl+I)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="4" x2="10" y2="4"/>
            <line x1="14" y1="20" x2="5" y2="20"/>
            <line x1="15" y1="4" x2="9" y2="20"/>
          </svg>
        </button>
        <button
          @click="editor.chain().focus().toggleUnderline().run()"
          :class="{ active: editor.isActive('underline') }"
          title="下划线 (Ctrl+U)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 4v6a6 6 0 0 0 12 0V4"/>
            <line x1="4" y1="20" x2="20" y2="20"/>
          </svg>
        </button>
        <button
          @click="editor.chain().focus().toggleStrike().run()"
          :class="{ active: editor.isActive('strike') }"
          title="删除线"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <path d="M16 6C16 6 14.5 4 12 4C9.5 4 7 5.5 7 8C7 10.5 9 11.5 12 12"/>
            <path d="M8 18C8 18 9.5 20 12 20C14.5 20 17 18.5 17 16C17 14 15.5 13 12 12"/>
          </svg>
        </button>
        <button
          @click="editor.chain().focus().toggleCode().run()"
          :class="{ active: editor.isActive('code') }"
          title="行内代码"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16 18 22 12 16 6"/>
            <polyline points="8 6 2 12 8 18"/>
          </svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button
          @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
          :class="{ active: editor.isActive('heading', { level: 1 }) }"
          title="标题1"
        >
          H1
        </button>
        <button
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
          :class="{ active: editor.isActive('heading', { level: 2 }) }"
          title="标题2"
        >
          H2
        </button>
        <button
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
          :class="{ active: editor.isActive('heading', { level: 3 }) }"
          title="标题3"
        >
          H3
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button
          @click="editor.chain().focus().setTextAlign('left').run()"
          :class="{ active: editor.isActive({ textAlign: 'left' }) }"
          title="左对齐"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="21" y1="6" x2="3" y2="6"/>
            <line x1="15" y1="12" x2="3" y2="12"/>
            <line x1="17" y1="18" x2="3" y2="18"/>
          </svg>
        </button>
        <button
          @click="editor.chain().focus().setTextAlign('center').run()"
          :class="{ active: editor.isActive({ textAlign: 'center' }) }"
          title="居中对齐"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="21" y1="6" x2="3" y2="6"/>
            <line x1="17" y1="12" x2="7" y2="12"/>
            <line x1="19" y1="18" x2="5" y2="18"/>
          </svg>
        </button>
        <button
          @click="editor.chain().focus().setTextAlign('right').run()"
          :class="{ active: editor.isActive({ textAlign: 'right' }) }"
          title="右对齐"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="21" y1="6" x2="3" y2="6"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
            <line x1="21" y1="18" x2="7" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button
          @click="editor.chain().focus().toggleBulletList().run()"
          :class="{ active: editor.isActive('bulletList') }"
          title="无序列表"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="9" y1="6" x2="20" y2="6"/>
            <line x1="9" y1="12" x2="20" y2="12"/>
            <line x1="9" y1="18" x2="20" y2="18"/>
            <circle cx="4" cy="6" r="1.5" fill="currentColor"/>
            <circle cx="4" cy="12" r="1.5" fill="currentColor"/>
            <circle cx="4" cy="18" r="1.5" fill="currentColor"/>
          </svg>
        </button>
        <button
          @click="editor.chain().focus().toggleOrderedList().run()"
          :class="{ active: editor.isActive('orderedList') }"
          title="有序列表"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="10" y1="6" x2="21" y2="6"/>
            <line x1="10" y1="12" x2="21" y2="12"/>
            <line x1="10" y1="18" x2="21" y2="18"/>
            <path d="M4 6h1v4"/>
            <path d="M4 10h2"/>
            <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>
          </svg>
        </button>
        <button
          @click="editor.chain().focus().toggleBlockquote().run()"
          :class="{ active: editor.isActive('blockquote') }"
          title="引用"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z"/>
          </svg>
        </button>
        <button
          @click="editor.chain().focus().toggleCodeBlock().run()"
          :class="{ active: editor.isActive('codeBlock') }"
          title="代码块"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <polyline points="9 9 5 12 9 15"/>
            <polyline points="15 9 19 12 15 15"/>
          </svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button
          @click="setLink"
          :class="{ active: editor.isActive('link') }"
          title="添加链接"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </button>
        <button
          @click="editor.chain().focus().unsetLink().run()"
          :disabled="!editor.isActive('link')"
          title="移除链接"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18.84 12.25l1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"/>
            <path d="M5.17 11.75l-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"/>
            <line x1="8" y1="2" x2="8" y2="5"/>
            <line x1="2" y1="8" x2="5" y2="8"/>
            <line x1="16" y1="19" x2="16" y2="22"/>
            <line x1="19" y1="16" x2="22" y2="16"/>
          </svg>
        </button>
        <button
          @click="showImageDialog = true"
          title="插入图片"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button
          @click="insertTable"
          title="插入表格"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="3" y1="15" x2="21" y2="15"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
            <line x1="15" y1="3" x2="15" y2="21"/>
          </svg>
        </button>
        <!-- 单元格背景色选择器 -->
        <div class="dropdown" v-if="editor">
          <button
            @click="showCellBgColorMenu = !showCellBgColorMenu"
            class="dropdown-btn color-btn"
            :disabled="!editor.isActive('tableCell') && !editor.isActive('tableHeader')"
            title="单元格背景色"
          >
            <span class="color-indicator" :style="{ backgroundColor: currentCellBgColor }"></span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <div v-if="showCellBgColorMenu" class="dropdown-menu color-menu" @click.stop>
            <div class="color-grid">
              <div
                v-for="item in cellBgColorOptions"
                :key="item.value"
                @click="setCellBgColor(item.value)"
                class="color-swatch"
                :style="{ backgroundColor: item.value || 'transparent' }"
                :title="item.label"
              >
                <span v-if="!item.value" class="default-label">{{ item.label }}</span>
              </div>
            </div>
          </div>
        </div>
        <button
          @click="addColumnBefore"
          :disabled="!editor?.isActive('tableCell') && !editor?.isActive('tableHeader')"
          title="向左插入列"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
            <path d="M3 9L9 12L3 15"/>
          </svg>
        </button>
        <button
          @click="addColumnAfter"
          :disabled="!editor?.isActive('tableCell') && !editor?.isActive('tableHeader')"
          title="向右插入列"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="15" y1="3" x2="15" y2="21"/>
            <path d="M21 9L15 12L21 15"/>
          </svg>
        </button>
        <button
          @click="addRowBefore"
          :disabled="!editor?.isActive('tableCell') && !editor?.isActive('tableHeader')"
          title="向上插入行"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <path d="M9 3L12 9L15 3"/>
          </svg>
        </button>
        <button
          @click="addRowAfter"
          :disabled="!editor?.isActive('tableCell') && !editor?.isActive('tableHeader')"
          title="向下插入行"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="15" x2="21" y2="15"/>
            <path d="M9 21L12 15L15 21"/>
          </svg>
        </button>
        <button
          @click="deleteColumn"
          :disabled="!editor?.isActive('tableCell') && !editor?.isActive('tableHeader')"
          title="删除列"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="12" y1="3" x2="12" y2="21"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="3" y1="15" x2="21" y2="15"/>
          </svg>
        </button>
        <button
          @click="deleteRow"
          :disabled="!editor?.isActive('tableCell') && !editor?.isActive('tableHeader')"
          title="删除行"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="9" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="9" x2="9" y2="9"/>
            <line x1="3" y1="15" x2="9" y2="15"/>
          </svg>
        </button>
        <button
          @click="deleteTable"
          :disabled="!editor?.isActive('tableCell') && !editor?.isActive('tableHeader')"
          title="删除表格"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="3" y1="15" x2="21" y2="15"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
            <line x1="15" y1="3" x2="15" y2="21"/>
            <line x1="3" y1="3" x2="21" y2="21"/>
            <line x1="21" y1="3" x2="3" y2="21"/>
          </svg>
        </button>
        <button
          @click="mergeCells"
          :disabled="!editor?.can().mergeCells()"
          title="合并单元格"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="12" y1="3" x2="12" y2="21"/>
            <path d="M8 8L12 12L8 16"/>
            <path d="M16 8L12 12L16 16"/>
          </svg>
        </button>
        <button
          @click="splitCell"
          :disabled="!editor?.can().splitCell()"
          title="拆分单元格"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="12" y1="3" x2="12" y2="21"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
          </svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button
          @click="editor.chain().focus().undo().run()"
          :disabled="!editor.can().undo()"
          title="撤销 (Ctrl+Z)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 7v6h6"/>
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
          </svg>
        </button>
        <button
          @click="editor.chain().focus().redo().run()"
          :disabled="!editor.can().redo()"
          title="重做 (Ctrl+Shift+Z)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 7v6h-6"/>
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>
          </svg>
        </button>
      </div>

      <div class="toolbar-spacer"></div>

      <div class="toolbar-group">
        <button
          @click="editor.chain().focus().setHorizontalRule().run()"
          title="水平线"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="12" x2="21" y2="12"/>
          </svg>
        </button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button
          @click="toggleSourceMode"
          :class="{ active: isSourceMode }"
          title="切换源码模式"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="8 6 4 12 8 18"/>
            <line x1="10" y1="7" x2="14" y2="17"/>
            <polyline points="16 6 20 12 16 18"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 富文本编辑模式 -->
    <editor-content
      v-if="!isSourceMode"
      :editor="editor"
      class="editor-content"
      @click.prevent="handleEditorClick"
      @paste="handleEditorPaste"
      @contextmenu="handleContextMenu"
    />

    <!-- 源码编辑模式 -->
    <div v-else class="source-editor">
      <textarea
        v-model="sourceCode"
        class="source-textarea"
        placeholder="HTML 源码..."
        @blur="applySourceCode"
      ></textarea>
    </div>

    <div class="editor-footer" v-if="editor">
      <span class="word-count">{{ editor.storage.characterCount?.words() || 0 }} 字</span>
      <span class="separator">|</span>
      <span class="char-count">{{ editor.storage.characterCount?.characters() || 0 }} 字符</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount, onMounted, computed } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import ResizeImage from 'tiptap-extension-resize-image'
import { Table, TableRow } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { FontSize, TextStyle, FontFamily, Color } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import LinkDialog from './LinkDialog.vue'
import ImageDialog from './ImageDialog.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import SearchReplaceDialog from './SearchReplaceDialog.vue'
import ContextMenu from './ContextMenu.vue'
import { getAvailableFonts } from '../utils/fontDetector'

// 扩展 TableCell 以支持背景色属性
const TableCellWithBg = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      background: {
        default: null,
        parseHTML: element => element.getAttribute('data-background'),
        renderHTML: attributes => {
          if (!attributes.background) {
            return {}
          }
          return {
            'data-background': attributes.background,
            style: `background-color: ${attributes.background} !important`,
          }
        },
      },
    }
  },
})

// 扩展 TableHeader 以支持背景色属性
const TableHeaderWithBg = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      background: {
        default: null,
        parseHTML: element => element.getAttribute('data-background'),
        renderHTML: attributes => {
          if (!attributes.background) {
            return {}
          }
          return {
            'data-background': attributes.background,
            style: `background-color: ${attributes.background} !important`,
          }
        },
      },
    }
  },
})

const props = defineProps<{ content: string; noteId?: string | null }>()
const emit = defineEmits<{ update: [content: string] }>()

const showLinkDialog = ref(false)
const showUrlDialog = ref(false)
const showImageDialog = ref(false)
const showConfirmDialog = ref(false)
const showSearchDialog = ref(false)
const showContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const selectedText = ref('')
const showFontFamilyMenu = ref(false)
const showFontSizeMenu = ref(false)
const showColorMenu = ref(false)
const showHighlightMenu = ref(false)
const showCellBgColorMenu = ref(false)
const downloadFilename = ref('')
const pendingDownloadId = ref<string | null>(null)
const attachments = ref<any[]>([])
const isSourceMode = ref(false)
const sourceCode = ref('')
const pendingLinkText = ref('')
const editorFontFamily = ref('Consolas, "Courier New", monospace')
const editorFontSize = ref(14)

// 格式刷相关状态
const isFormatBrushActive = ref(false)
const copiedFormat = ref<Partial<{
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  code: boolean
  fontFamily: string
  fontSize: string
  color: string
  highlight: string
}> | null>(null)

// 字体选项 - 动态加载已安装的字体
const fontOptions = ref<Array<{ label: string; value: string }>>([])

// 加载已安装的字体
async function loadFonts() {
  const fonts = await getAvailableFonts()
  fontOptions.value = [
    { label: '默认字体', value: '' },
    ...fonts.map(f => ({ label: f.label, value: f.value.split(',')[0].replace(/["']/g, '') }))
  ]
}

// 字号选项
const fontSizeOptions = [
  { label: '默认', value: '' },
  { label: '8px', value: '8px' },
  { label: '10px', value: '10px' },
  { label: '12px', value: '12px' },
  { label: '14px', value: '14px' },
  { label: '16px', value: '16px' },
  { label: '18px', value: '18px' },
  { label: '20px', value: '20px' },
  { label: '24px', value: '24px' },
  { label: '28px', value: '28px' },
  { label: '32px', value: '32px' },
  { label: '36px', value: '36px' },
]

// 颜色选项
const colorOptions = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
  '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#b4a7d6', '#a4c2f4', '#b796d9', '#dfa8cd',
  '#bf9000', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#76a5af', '#674ea7', '#3d85c6', '#8e7cc3', '#a64d79',
  '#85200c', '#741b47', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#351c75', '#0b5394', '#20124d', '#4c1130',
]

// 预设单元格背景色
const cellBgColorOptions = [
  { label: '默认', value: '' },
  ...colorOptions.map(c => ({ label: c, value: c }))
]

onMounted(async () => {
  const font = await window.vaultAPI.settings.getEditorFont()
  if (font?.fontFamily) {
    editorFontFamily.value = font.fontFamily
  }
  if (font?.fontSize) {
    editorFontSize.value = font.fontSize
  }

  // 加载已安装的字体列表
  await loadFonts()

  // 添加全局点击事件监听，关闭下拉菜单
  document.addEventListener('click', handleGlobalClick)
  // 添加键盘快捷键监听
  document.addEventListener('keydown', handleKeyDown)
})

function handleKeyDown(event: KeyboardEvent) {
  // Ctrl+F 打开搜索对话框
  if (event.ctrlKey && event.key === 'f') {
    event.preventDefault()
    // 获取当前选中的文本
    if (editor.value && !isSourceMode.value) {
      const { from, to } = editor.value.state.selection
      if (from !== to) {
        selectedText.value = editor.value.state.doc.textBetween(from, to)
      } else {
        selectedText.value = ''
      }
    }
    showSearchDialog.value = true
  }

  // Esc 关闭搜索对话框
  if (event.key === 'Escape' && showSearchDialog.value) {
    event.preventDefault()
    showSearchDialog.value = false
  }
}

function handleGlobalClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  // 如果点击的不是 dropdown 按钮或其子元素，关闭所有菜单
  if (!target.closest('.dropdown')) {
    showFontFamilyMenu.value = false
    showFontSizeMenu.value = false
    showColorMenu.value = false
    showHighlightMenu.value = false
    showCellBgColorMenu.value = false
  }
}

async function loadAttachments() {
  if (props.noteId) {
    attachments.value = await window.vaultAPI.attachments.list(props.noteId)
  }
}

watch(() => props.noteId, loadAttachments, { immediate: true })

// 表格操作函数
function insertTable() {
  if (!editor.value) return
  editor.value.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}

function addColumnBefore() {
  if (!editor.value) return
  editor.value.chain().focus().addColumnBefore().run()
}

function addColumnAfter() {
  if (!editor.value) return
  editor.value.chain().focus().addColumnAfter().run()
}

function addRowBefore() {
  if (!editor.value) return
  editor.value.chain().focus().addRowBefore().run()
}

function addRowAfter() {
  if (!editor.value) return
  editor.value.chain().focus().addRowAfter().run()
}

function deleteColumn() {
  if (!editor.value) return
  editor.value.chain().focus().deleteColumn().run()
}

function deleteRow() {
  if (!editor.value) return
  editor.value.chain().focus().deleteRow().run()
}

function deleteTable() {
  if (!editor.value) return
  editor.value.chain().focus().deleteTable().run()
}

function mergeCells() {
  if (!editor.value) return
  editor.value.chain().focus().mergeCells().run()
}

function splitCell() {
  if (!editor.value) return
  editor.value.chain().focus().splitCell().run()
}

// 格式化函数
function setFontFamily(font: string) {
  if (!editor.value) return
  if (!font) {
    editor.value.chain().focus().setFontFamily('').run()
  } else {
    editor.value.chain().focus().setFontFamily(font).run()
  }
  showFontFamilyMenu.value = false
}

function setFontSize(size: string) {
  if (!editor.value) return
  if (!size) {
    editor.value.chain().focus().unsetFontSize().run()
  } else {
    editor.value.chain().focus().setFontSize(size).run()
  }
  showFontSizeMenu.value = false
}

function setFontColor(color: string) {
  if (!editor.value) return
  editor.value.chain().focus().setColor(color).run()
  showColorMenu.value = false
}

function clearFontColor() {
  if (!editor.value) return
  editor.value.chain().focus().unsetColor().run()
  showColorMenu.value = false
}

function setHighlightColor(color: string) {
  if (!editor.value) return
  editor.value.chain().focus().setHighlight({ color }).run()
  showHighlightMenu.value = false
}

function clearHighlight() {
  if (!editor.value) return
  editor.value.chain().focus().unsetHighlight().run()
  showHighlightMenu.value = false
}

function setCellBgColor(color: string) {
  if (!editor.value) return
  // 使用 setCellAttribute 设置背景色
  if (color) {
    editor.value.chain().focus().setCellAttribute('background', color).run()
  } else {
    editor.value.chain().focus().setCellAttribute('background', null).run()
  }
  showCellBgColorMenu.value = false
}

// 计算属性 - 获取当前选中的字体标签
const getFontFamilyLabel = computed(() => {
  if (!editor.value) return '默认字体'
  const currentFont = editor.value.getAttributes('textStyle').fontFamily
  if (!currentFont) return '默认字体'
  const font = fontOptions.value.find(f => f.value === currentFont)
  return font?.label || currentFont
})

// 计算属性 - 获取当前选中的字号标签
const getFontSizeLabel = computed(() => {
  if (!editor.value) return '默认'
  const currentSize = editor.value.getAttributes('textStyle').fontSize
  if (!currentSize) return '默认'
  const size = fontSizeOptions.find(s => s.value === currentSize)
  return size?.label || '默认'
})

// 计算属性 - 获取当前字体颜色
const currentColor = computed(() => {
  if (!editor.value) return '#000000'
  return editor.value.getAttributes('textStyle').color || '#000000'
})

// 计算属性 - 获取当前高亮颜色
const currentHighlight = computed(() => {
  if (!editor.value) return 'transparent'
  return editor.value.getAttributes('highlight').color || 'transparent'
})

// 计算属性 - 获取当前单元格背景色
const currentCellBgColor = computed(() => {
  if (!editor.value) return 'transparent'
  // 获取当前选中单元格的背景色（可能是 th 或 td）
  const cellAttrs = editor.value.getAttributes('tableCell')
  const headerAttrs = editor.value.getAttributes('tableHeader')
  return cellAttrs?.background || headerAttrs?.background || 'transparent'
})

let debounceTimer: ReturnType<typeof setTimeout> | null = null

// 搜索高亮扩展
const SearchHighlight = Extension.create({
  name: 'searchHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('searchHighlight'),
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const highlights = tr.getMeta('searchHighlights')
            if (highlights !== undefined) {
              if (highlights === null || highlights.length === 0) {
                return DecorationSet.empty
              }
              return DecorationSet.create(tr.doc, highlights)
            }
            return set.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations(state) {
            return this.getState(state) as DecorationSet
          },
        },
      }),
    ]
  },
})

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      link: false, // 必须关掉自带的，用你自己配置的
      underline: false, // 使用单独的 Underline 扩展
    }),
    Placeholder.configure({
      placeholder: '开始输入内容...'
    }),
    CharacterCount,
    Underline,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        target: '_blank',
        rel: 'noopener noreferrer'
      }
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph']
    }),
    ResizeImage.configure({
      inline: true,
      allowBase64: true,
      HTMLAttributes: {
        class: 'rich-image'
      }
    }),
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeaderWithBg,
    TableCellWithBg,
    TextStyle,
    FontFamily.configure({
      types: ['textStyle']
    }),
    FontSize,
    Color.configure({
      types: ['textStyle']
    }),
    Highlight.configure({
      multicolor: true
    }),
    SearchHighlight
  ],
  content: props.content || '',
  editorProps: {
    attributes: {
      class: 'rich-text-editor'
    }
  },
  onUpdate: ({ editor }) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      emit('update', editor.getHTML())
    }, 500)
  }
})

function setLink() {
  if (!editor.value) return

  if (editor.value.isActive('link')) {
    editor.value.chain().focus().unsetLink().run()
    return
  }

  // 检查是否有选中文本，如果有则弹出 URL 输入框，否则弹出附件选择
  const { from, to } = editor.value.state.selection
  if (from === to) {
    // 没有选中文本，弹出附件选择
    showLinkDialog.value = true
  } else {
    // 有选中文本，弹出 URL 输入
    pendingLinkText.value = editor.value.state.doc.textBetween(from, to)
    showUrlDialog.value = true
  }
}

function handleUrlConfirm(url: string) {
  if (!editor.value) return

  const editorInstance = editor.value
  const { from, to } = editorInstance.state.selection

  // 确保有选中文本
  if (from === to) {
    // 如果没有选中文本，使用 URL 作为文本
    editorInstance.chain().focus()
      .insertContent(url)
      .run()
    const newPos = editorInstance.state.selection.from
    editorInstance.chain().focus()
      .setTextSelection({ from: newPos - url.length, to: newPos })
      .setLink({ href: url })
      .run()
  } else {
    // 选中文本，直接设置为链接
    editorInstance.chain().focus()
      .setLink({ href: url })
      .run()
  }
}

function handleLinkSelect(data: { id: string; filename: string; href?: string }) {
  if (!editor.value) return

  const editorInstance = editor.value
  const href = data.href || `http://attachment/${data.id}`

  // 使用命令方式插入文本并应用链接
  editorInstance.chain().focus()
    .insertContent(data.filename)
    .run()

  // 获取插入后的位置
  const pos = editorInstance.state.selection.from

  // 从文本开头到结尾应用链接
  editorInstance.chain().focus()
    .setTextSelection({ from: pos - data.filename.length, to: pos })
    .setLink({ href })
    .run()
}

function handleImageSelect(data: { id: string; filename: string; data: string }) {
  if (!editor.value) return

  // 获取附件信息
  const att = attachments.value.find(a => a.id === data.id)
  const mimeType = att?.mime_type || 'image/png'
  const dataUrl = `data:${mimeType};base64,${data.data}`

  // 创建图片对象获取原始尺寸
  const img = new Image()
  img.onload = () => {
    const maxSize = 600
    let width = img.naturalWidth
    let height = img.naturalHeight

    // 等比缩放
    if (width > maxSize || height > maxSize) {
      const scale = maxSize / Math.max(width, height)
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }

    editor.value!.chain().focus().setImage({
      src: dataUrl,
      alt: data.filename,
      containerStyle: `width: ${width}px; height: auto;`
    }).run()
  }
  img.src = dataUrl
}

function handleEditorPaste(event: ClipboardEvent) {
  if (!editor.value) return

  const clipboardData = event.clipboardData
  if (!clipboardData) return

  // 检查剪贴板中是否有图片
  const items = clipboardData.items
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.startsWith('image/')) {
      event.preventDefault()

      const file = items[i].getAsFile()
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        if (!dataUrl) return

        // 获取图片尺寸并等比缩放
        const img = new Image()
        img.onload = () => {
          const maxSize = 600
          let width = img.naturalWidth
          let height = img.naturalHeight

          if (width > maxSize || height > maxSize) {
            const scale = maxSize / Math.max(width, height)
            width = Math.round(width * scale)
            height = Math.round(height * scale)
          }

          editor.value!.chain().focus().setImage({
            src: dataUrl,
            containerStyle: `width: ${width}px; height: auto;`
          }).run()
        }
        img.src = dataUrl
      }
      reader.readAsDataURL(file)
      return
    }
  }
}

function handleEditorClick(event: MouseEvent) {
  // 如果格式刷激活，应用格式
  if (isFormatBrushActive.value && editor.value) {
    event.preventDefault()
    event.stopPropagation()
    applyFormat()
    return
  }

  const target = event.target as HTMLElement
  const link = target.closest('a')

  if (link) {
    const href = link.getAttribute('href')

    if (href?.startsWith('http://attachment/')) {
      // 附件链接：仅在 Alt+左键 时下载
      if (event.altKey) {
        event.preventDefault()
        event.stopPropagation()
        const attachmentId = href.replace('http://attachment/', '')
        const att = attachments.value.find(a => a.id === attachmentId)
        downloadFilename.value = att?.filename || '附件'
        pendingDownloadId.value = attachmentId
        showConfirmDialog.value = true
      }
      // 普通左键点击：不处理
    } else if (href) {
      // 普通链接：仅在 Alt+ 左键 时在浏览器中打开
      if (event.altKey) {
        event.preventDefault()
        event.stopPropagation()
        window.vaultAPI.app.openExternal(href)
      }
      // 否则只是选中链接，让编辑器默认处理
    }
  }
}

async function confirmDownload() {
  if (!pendingDownloadId.value) return
  await downloadAttachment(pendingDownloadId.value)
  pendingDownloadId.value = null
}

async function downloadAttachment(attachmentId: string) {
  const data = await window.vaultAPI.attachments.get(attachmentId)
  if (!data) return

  const att = attachments.value.find(a => a.id === attachmentId)
  const filename = att?.filename || 'attachment'

  // Convert base64 to blob and download
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

watch(() => props.content, (newContent) => {
  if (editor.value && newContent !== undefined) {
    const currentContent = editor.value.getHTML()
    if (currentContent !== newContent) {
      editor.value.commands.setContent(newContent || '', false)
    }
    // 同步源码模式
    if (isSourceMode.value) {
      sourceCode.value = newContent || ''
    }
  }
})

function toggleSourceMode() {
  if (isSourceMode.value) {
    applySourceCode()
    isSourceMode.value = false
  } else {
    sourceCode.value = editor.value?.getHTML() || ''
    isSourceMode.value = true
  }
}

function applySourceCode() {
  if (editor.value) {
    editor.value.commands.setContent(sourceCode.value || '', false)
    emit('update', sourceCode.value || '')
  }
}

// 右键菜单处理
const contextMenuItems = computed(() => [
  {
    label: '查找和替换',
    icon: 'svg-search',
    action: openSearchDialog,
    disabled: false
  },
  {
    label: '分隔线',
    icon: '',
    action: () => {},
    disabled: false,
    separator: true
  },
  {
    label: '撤销',
    icon: 'svg-undo',
    action: () => editor.value?.chain().focus().undo().run(),
    disabled: !editor.value?.can().undo()
  },
  {
    label: '重做',
    icon: 'svg-redo',
    action: () => editor.value?.chain().focus().redo().run(),
    disabled: !editor.value?.can().redo()
  },
])

function handleContextMenu(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()

  contextMenuPosition.value = {
    x: event.clientX,
    y: event.clientY
  }
  showContextMenu.value = true
}

function openSearchDialog() {
  showSearchDialog.value = true
}

function handleSearchClose() {
  // 搜索对话框关闭后，清除高亮
  if (editor.value) {
    try {
      const tr = editor.value.state.tr
      tr.setMeta('searchHighlights', null)
      editor.value.view.dispatch(tr)
    } catch (e) {
      // Ignore errors
    }
  }
}

// 格式刷相关函数
function toggleFormatBrush() {
  if (!editor.value) return

  if (isFormatBrushActive.value) {
    // 取消格式刷
    cancelFormatBrush()
  } else {
    // 激活格式刷，复制当前格式
    copyFormat()
  }
}

function copyFormat() {
  if (!editor.value) return

  // 获取当前选中的格式
  copiedFormat.value = {
    bold: editor.value.isActive('bold'),
    italic: editor.value.isActive('italic'),
    underline: editor.value.isActive('underline'),
    strike: editor.value.isActive('strike'),
    code: editor.value.isActive('code'),
    fontFamily: editor.value.getAttributes('textStyle').fontFamily || '',
    fontSize: editor.value.getAttributes('textStyle').fontSize || '',
    color: editor.value.getAttributes('textStyle').color || '',
    highlight: editor.value.getAttributes('highlight').color || '',
  }

  isFormatBrushActive.value = true
}

function applyFormat() {
  if (!editor.value || !copiedFormat.value) return

  const chain = editor.value.chain().focus()

  // 先清除所有格式
  chain
    .unsetBold()
    .unsetItalic()
    .unsetUnderline()
    .unsetStrike()
    .unsetCode()
    .unsetFontFamily()
    .unsetFontSize()
    .unsetColor()
    .unsetHighlight()

  // 应用复制的格式
  if (copiedFormat.value.bold) chain.setBold()
  if (copiedFormat.value.italic) chain.setItalic()
  if (copiedFormat.value.underline) chain.setUnderline()
  if (copiedFormat.value.strike) chain.setStrike()
  if (copiedFormat.value.code) chain.setCode()
  if (copiedFormat.value.fontFamily) chain.setFontFamily(copiedFormat.value.fontFamily)
  if (copiedFormat.value.fontSize) chain.setFontSize(copiedFormat.value.fontSize)
  if (copiedFormat.value.color) chain.setColor(copiedFormat.value.color)
  if (copiedFormat.value.highlight) chain.setHighlight({ color: copiedFormat.value.highlight })

  chain.run()

  // 应用一次后取消格式刷（如果需要多次应用，可以保持激活状态）
  cancelFormatBrush()
}

function cancelFormatBrush() {
  isFormatBrushActive.value = false
  copiedFormat.value = null
}

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  editor.value?.destroy()
  document.removeEventListener('click', handleGlobalClick)
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.richtext-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  flex-wrap: wrap;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 1px;
}

.toolbar-divider {
  width: 1px;
  height: 18px;
  background: var(--border-color);
  margin: 0 4px;
}

.toolbar-spacer {
  flex: 1;
}

.toolbar button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.15s ease;
}

.toolbar button:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.toolbar button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.toolbar button.active {
  background: var(--toolbar-active-bg);
  color: var(--toolbar-active-color);
  border-color: var(--toolbar-active-bg);
}

.editor-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
}

.editor-content :deep(.ProseMirror) {
  outline: none;
  min-height: 100%;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--editor-font-family, 'Consolas, "Courier New", monospace');
  font-size: var(--editor-font-size, 14px);
}

/* 暗色主题下的 RichTextEditor 样式 */
:root[data-theme='dark'] .editor-content :deep(.ProseMirror) {
  background: var(--bg-primary);
  color: var(--text-primary);
}

:root[data-theme='dark'] .editor-content :deep(.ProseMirror h1),
:root[data-theme='dark'] .editor-content :deep(.ProseMirror h2),
:root[data-theme='dark'] .editor-content :deep(.ProseMirror h3) {
  color: var(--text-primary);
}

:root[data-theme='dark'] .editor-content :deep(.ProseMirror p) {
  color: var(--text-primary);
}

:root[data-theme='dark'] .editor-content :deep(.ProseMirror li) {
  color: var(--text-primary);
}

:root[data-theme='dark'] .editor-content :deep(.ProseMirror strong) {
  color: var(--text-primary);
}

:root[data-theme='dark'] .editor-content :deep(.ProseMirror em) {
  color: var(--text-primary);
}

.editor-content :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: var(--text-secondary);
  pointer-events: none;
  height: 0;
}

.editor-content :deep(.ProseMirror p) {
  margin: 0;
  line-height: 1.7;
  min-height: 1.5em;
}

.editor-content :deep(.ProseMirror h1),
.editor-content :deep(.ProseMirror h2),
.editor-content :deep(.ProseMirror h3) {
  margin: 1.2em 0 0.6em 0;
  font-weight: 600;
  line-height: 1.3;
}

.editor-content :deep(.ProseMirror h1) {
  font-size: 1.75em;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.3em;
}

.editor-content :deep(.ProseMirror h2) {
  font-size: 1.5em;
}

.editor-content :deep(.ProseMirror h3) {
  font-size: 1.25em;
}

.editor-content :deep(.ProseMirror ul),
.editor-content :deep(.ProseMirror ol) {
  padding-left: 1.5em;
  margin: 0 0 0.75em 0;
}

.editor-content :deep(.ProseMirror li) {
  margin: 0.3em 0;
}

.editor-content :deep(.ProseMirror li p) {
  margin: 0;
}

.editor-content :deep(.ProseMirror blockquote) {
  border-left: 3px solid var(--accent-color);
  padding-left: 1em;
  margin: 0.75em 0;
  color: var(--text-secondary);
  font-style: italic;
}

.editor-content :deep(.ProseMirror code) {
  background: var(--bg-hover);
  padding: 0.15em 0.4em;
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 0.9em;
  color: var(--text-primary);
}

.editor-content :deep(.ProseMirror pre) {
  background: var(--bg-hover);
  padding: 0.75em 1em;
  border-radius: 6px;
  overflow-x: auto;
  margin: 0.75em 0;
}

/* 暗色主题下的代码块样式 */
:root[data-theme='dark'] .editor-content :deep(.ProseMirror code) {
  background: var(--code-bg);
}

:root[data-theme='dark'] .editor-content :deep(.ProseMirror pre) {
  background: var(--code-bg);
  border: 1px solid var(--code-border);
}

/* 表格样式 */
.editor-content :deep(.ProseMirror table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.75em 0;
  font-family: var(--editor-font-family, 'Consolas, "Courier New", monospace');
  font-size: var(--editor-font-size, 14px);
}

.editor-content :deep(.ProseMirror table th),
.editor-content :deep(.ProseMirror table td) {
  border: 1px solid var(--border-color);
  padding: 8px 12px;
  text-align: left;
}

.editor-content :deep(.ProseMirror table th) {
  background: var(--bg-secondary);
  font-weight: 600;
}

.editor-content :deep(.ProseMirror table tr.selected) {
  background: var(--editor-selection);
}

/* 表格列宽拖拽手柄 */
.editor-content :deep(.column-resize-handle) {
  position: absolute;
  right: -2px;
  top: 0;
  bottom: 0;
  width: 4px;
  background: var(--accent-color);
  cursor: col-resize;
  z-index: 10;
}

/* 暗色主题下的表格样式 */
:root[data-theme='dark'] .editor-content :deep(.ProseMirror table) {
  border-color: var(--border-color);
}

:root[data-theme='dark'] .editor-content :deep(.ProseMirror table th),
:root[data-theme='dark'] .editor-content :deep(.ProseMirror table td) {
  border-color: var(--border-color);
  color: var(--text-primary);
}

:root[data-theme='dark'] .editor-content :deep(.ProseMirror table th) {
  background: var(--bg-secondary);
}

/* 暗色主题下的引用块样式 */
:root[data-theme='dark'] .editor-content :deep(.ProseMirror blockquote) {
  border-left-color: var(--border-color);
}

/* 暗色主题下的文本选中样式 */
:root[data-theme='dark'] .editor-content :deep(.ProseMirror ::selection) {
  background: var(--editor-selection);
}

.editor-content :deep(.ProseMirror pre code) {
  background: none;
  padding: 0;
  font-size: 0.9em;
}

.editor-content :deep(.ProseMirror hr) {
  border: none;
  border-top: 2px solid var(--border-color);
  margin: 1.5em 0;
}

.editor-content :deep(.ProseMirror a) {
  color: var(--accent-color);
  text-decoration: underline;
  cursor: pointer;
}

.editor-content :deep(.ProseMirror img.rich-image) {
  max-width: 600px;
  max-height: 600px;
  width: auto;
  height: auto;
  display: inline-block;
  vertical-align: bottom;
  margin: 0 4px;
}

.editor-content :deep(.ProseMirror img.rich-image:hover) {
  outline: 2px dashed var(--accent-color);
  outline-offset: 2px;
}

/* ResizeImage 扩展的样式 - 覆盖内联浮动样式 */
.editor-content :deep(.ProseMirror div[contenteditable="false"]) {
  display: inline-block !important;
  float: none !important;
  padding-right: 0 !important;
  vertical-align: bottom !important;
  margin: 0 4px;
}

.editor-content :deep(.ProseMirror .image-resizer) {
  display: inline-block !important;
  position: relative !important;
  border: none !important;
}

/* 隐藏位置控制器（对齐工具栏） */
.editor-content :deep(div[style*="position: absolute"][style*="width: 66px"][style*="z-index: 999"]) {
  display: none !important;
}

.editor-content :deep(.ProseMirror .image-resizer .resizeHandle) {
  position: absolute;
  right: -6px;
  bottom: -6px;
  width: 12px;
  height: 12px;
  background: var(--accent-color);
  border-radius: 2px;
  cursor: nwse-resize;
}

.editor-content :deep(.ProseMirror a:hover) {
  color: var(--accent-hover);
}

.editor-content :deep(.ProseMirror p code) {
  background: var(--bg-hover);
  padding: 0.15em 0.4em;
  border-radius: 3px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 0.9em;
}

.editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 6px 12px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.editor-footer .separator {
  color: var(--border-color);
}

.char-count,
.word-count {
  font-size: 11px;
  color: var(--text-secondary);
}

.source-editor {
  flex: 1;
  overflow: hidden;
}

.source-textarea {
  width: 100%;
  height: 100%;
  padding: 16px 24px;
  border: none;
  outline: none;
  resize: none;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* 下拉菜单样式 */
.dropdown {
  position: relative;
}

.dropdown-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  width: auto;
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s ease;
}

.dropdown-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.dropdown-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.dropdown-btn.color-btn {
  padding: 0 4px;
}

.dropdown-label {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1000;
  margin-top: 4px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 6px;
  min-width: 200px;
}

.dropdown-item {
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  transition: background 0.1s ease;
}

.dropdown-item:hover {
  background: var(--bg-hover);
}

.dropdown-item.active {
  background: var(--toolbar-active-bg);
  color: var(--toolbar-active-color);
}

/* 字体菜单 */
.font-menu {
  min-width: 180px;
  max-height: 300px;
  overflow-y: auto;
}

.font-menu .dropdown-item {
  white-space: nowrap;
}

/* 字号菜单 */
.font-size-menu {
  min-width: 100px;
  max-height: 250px;
  overflow-y: auto;
}

/* 颜色选择器 */
.color-menu {
  min-width: 220px;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}

.color-swatch {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  color: var(--text-primary);
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.color-swatch:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.color-swatch .default-label {
  font-size: 7px;
  text-align: center;
  line-height: 1;
}

.clear-color-btn {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s ease;
}

.clear-color-btn:hover {
  background: var(--bg-hover);
  border-color: var(--accent-color);
}

/* 颜色指示器 */
.color-indicator {
  width: 14px;
  height: 14px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.2);
}

:root[data-theme='dark'] .color-indicator {
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* 单元格背景色菜单 */
.cell-bg-color-menu {
  min-width: 240px;
}

/* 搜索高亮样式 */
.editor-content :deep(.ProseMirror .search-match) {
  background-color: rgba(255, 255, 0, 0.3);
  border-radius: 2px;
}

.editor-content :deep(.ProseMirror .search-match-current) {
  background-color: rgba(255, 165, 0, 0.5);
  border-radius: 2px;
}

:root[data-theme='dark'] .editor-content :deep(.ProseMirror .search-match) {
  background-color: rgba(255, 255, 0, 0.2);
}

:root[data-theme='dark'] .editor-content :deep(.ProseMirror .search-match-current) {
  background-color: rgba(255, 165, 0, 0.4);
}
</style>
