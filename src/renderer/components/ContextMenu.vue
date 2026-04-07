<template>
  <div
    v-if="visible"
    ref="menuRef"
    class="context-menu"
    :style="menuStyle"
    @click.stop
  >
    <ul class="menu-items">
      <li
        v-for="(item, index) in localItems"
        :key="index"
        class="menu-item"
        :class="{ disabled: item.disabled, separator: item.separator }"
        @click.stop="handleClick(item)"
      >
        <template v-if="item.separator">
          <hr class="separator-line" />
        </template>
        <template v-else>
          <span class="item-icon" :class="item.icon"></span>
          <span class="item-label">{{ item.label }}</span>
        </template>
      </li>
    </ul>
  </div>
  <div v-if="visible" class="context-menu-overlay" @click="close"></div>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'

interface MenuItem {
  label: string
  icon: string
  action: () => void
  disabled?: boolean
  separator?: boolean
}

const props = defineProps<{
  modelValue: boolean
  position?: { x: number; y: number }
  anchor?: HTMLElement | null
  items: MenuItem[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const menuRef = ref<HTMLElement | null>(null)
const visible = ref(props.modelValue)
const localItems = ref([...props.items])

// 存储实际计算后的位置
const positionedX = ref(0)
const positionedY = ref(0)

// 计算菜单位置，考虑窗口边界
function calculatePosition(x: number, y: number, menuWidth: number, menuHeight: number) {
  const padding = 10
  let adjustedX = x
  let adjustedY = y

  // 检测是否超出右边界，超出则向左显示
  if (x + menuWidth > window.innerWidth - padding) {
    adjustedX = window.innerWidth - menuWidth - padding
  }

  // 检测是否超出底部边界，超出则向上显示
  if (y + menuHeight > window.innerHeight - padding) {
    adjustedY = y - menuHeight
  }

  // 确保不超出左边界
  if (adjustedX < padding) {
    adjustedX = padding
  }

  // 确保不超出上边界
  if (adjustedY < padding) {
    adjustedY = padding
  }

  return { x: adjustedX, y: adjustedY }
}

// 在菜单渲染后调整位置
async function adjustPosition() {
  if (!menuRef.value || !props.position) return

  await nextTick()

  const rect = menuRef.value.getBoundingClientRect()
  const { x, y } = calculatePosition(props.position.x, props.position.y, rect.width, rect.height)

  positionedX.value = x
  positionedY.value = y
}

const menuStyle = computed(() => {
  if (props.anchor) {
    const rect = props.anchor.getBoundingClientRect()
    return {
      top: `${rect.bottom + window.scrollY}px`,
      left: `${rect.left + window.scrollX}px`
    }
  }
  if (props.position) {
    return {
      top: `${positionedY.value || props.position.y}px`,
      left: `${positionedX.value || props.position.x}px`
    }
  }
  return {}
})

watch(() => props.modelValue, (val) => {
  visible.value = val
  // 当菜单打开时，更新本地副本并调整位置
  if (val) {
    localItems.value = [...props.items]
    if (props.position) {
      nextTick(() => adjustPosition())
    }
  }
})

watch(() => props.items, (newItems) => {
  localItems.value = [...newItems]
  // 菜单内容变化时，重新调整位置（因为高度可能变化）
  if (visible.value && props.position) {
    nextTick(() => adjustPosition())
  }
}, { deep: true })

watch(() => props.position, () => {
  // 位置变化时，重新调整位置
  if (visible.value && props.position) {
    nextTick(() => adjustPosition())
  }
}, { deep: true })

watch(visible, (val) => {
  emit('update:modelValue', val)
})

function close() {
  visible.value = false
}

function handleClick(item: MenuItem) {
  if (item.disabled) return
  item.action()
  close()
}
</script>

<style scoped>
.context-menu {
  position: fixed;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10000;
  min-width: 140px;
}

.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
}

.menu-items {
  list-style: none;
  margin: 0;
  padding: 4px 0;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
}

.menu-item:hover {
  background: var(--bg-secondary);
}

.menu-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.menu-item.disabled:hover {
  background: transparent;
}

.menu-item.separator {
  padding: 4px 0;
}

.menu-item.separator:hover {
  background: transparent;
}

.separator-line {
  display: block;
  width: 100%;
  height: 1px;
  margin: 0;
  padding: 0;
  border: none;
  border-top: 1px solid var(--border-color);
}

.item-icon {
  font-size: 14px;
  width: 16px;
  text-align: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* SVG 图标样式 */
.item-icon.svg-restore,
.item-icon.svg-delete,
.item-icon.svg-rename,
.item-icon.svg-folder,
.item-icon.svg-folder-open,
.item-icon.svg-folder-empty,
.item-icon.svg-note-plain,
.item-icon.svg-note-markdown,
.item-icon.svg-note-richtext,
.item-icon.svg-empty,
.item-icon.svg-search,
.item-icon.svg-undo,
.item-icon.svg-redo,
.item-icon.svg-uppercase,
.item-icon.svg-lowercase,
.item-icon.svg-capitalize,
.item-icon.svg-target,
.item-icon.svg-line,
.item-icon.svg-calculate,
.item-icon.svg-trim,
.item-icon.svg-trim-start,
.item-icon.svg-trim-end,
.item-icon.svg-sort-asc,
.item-icon.svg-sort-desc,
.item-icon.svg-unique {
  background-color: var(--text-primary) !important;
  -webkit-mask-size: contain !important;
  mask-size: contain !important;
  -webkit-mask-repeat: no-repeat !important;
  mask-repeat: no-repeat !important;
  -webkit-mask-position: center !important;
  mask-position: center !important;
  width: 16px !important;
  height: 16px !important;
  display: inline-block !important;
}

.item-icon.svg-restore {
  -webkit-mask-image: url('../assets/icons/restore.svg') !important;
  mask-image: url('../assets/icons/restore.svg') !important;
}

.item-icon.svg-delete {
  -webkit-mask-image: url('../assets/icons/delete.svg') !important;
  mask-image: url('../assets/icons/delete.svg') !important;
}

.item-icon.svg-rename {
  -webkit-mask-image: url('../assets/icons/rename.svg') !important;
  mask-image: url('../assets/icons/rename.svg') !important;
}

.item-icon.svg-folder {
  -webkit-mask-image: url('../assets/icons/folder.svg') !important;
  mask-image: url('../assets/icons/folder.svg') !important;
}

.item-icon.svg-folder-open {
  -webkit-mask-image: url('../assets/icons/folder-open.svg') !important;
  mask-image: url('../assets/icons/folder-open.svg') !important;
}

.item-icon.svg-folder-empty {
  -webkit-mask-image: url('../assets/icons/folder-empty.svg') !important;
  mask-image: url('../assets/icons/folder-empty.svg') !important;
}

.item-icon.svg-note-plain {
  -webkit-mask-image: url('../assets/icons/note-plain.svg') !important;
  mask-image: url('../assets/icons/note-plain.svg') !important;
}

.item-icon.svg-note-markdown {
  -webkit-mask-image: url('../assets/icons/note-markdown.svg') !important;
  mask-image: url('../assets/icons/note-markdown.svg') !important;
}

.item-icon.svg-note-richtext {
  -webkit-mask-image: url('../assets/icons/note-richtext.svg') !important;
  mask-image: url('../assets/icons/note-richtext.svg') !important;
}

.item-icon.svg-empty {
  -webkit-mask-image: url('../assets/icons/empty.svg') !important;
  mask-image: url('../assets/icons/empty.svg') !important;
}

.item-icon.svg-search {
  -webkit-mask-image: url('../assets/icons/search.svg') !important;
  mask-image: url('../assets/icons/search.svg') !important;
}

.item-icon.svg-undo {
  -webkit-mask-image: url('../assets/icons/undo.svg') !important;
  mask-image: url('../assets/icons/undo.svg') !important;
}

.item-icon.svg-redo {
  -webkit-mask-image: url('../assets/icons/redo.svg') !important;
  mask-image: url('../assets/icons/redo.svg') !important;
}

.item-icon.svg-uppercase {
  -webkit-mask-image: url('../assets/icons/uppercase.svg') !important;
  mask-image: url('../assets/icons/uppercase.svg') !important;
}

.item-icon.svg-lowercase {
  -webkit-mask-image: url('../assets/icons/lowercase.svg') !important;
  mask-image: url('../assets/icons/lowercase.svg') !important;
}

.item-icon.svg-capitalize {
  -webkit-mask-image: url('../assets/icons/capitalize.svg') !important;
  mask-image: url('../assets/icons/capitalize.svg') !important;
}

.item-icon.svg-target {
  -webkit-mask-image: url('../assets/icons/target.svg') !important;
  mask-image: url('../assets/icons/target.svg') !important;
}

.item-icon.svg-line {
  -webkit-mask-image: url('../assets/icons/line.svg') !important;
  mask-image: url('../assets/icons/line.svg') !important;
}

.item-icon.svg-calculate {
  -webkit-mask-image: url('../assets/icons/calculate.svg') !important;
  mask-image: url('../assets/icons/calculate.svg') !important;
}

.item-icon.svg-trim {
  -webkit-mask-image: url('../assets/icons/trim.svg') !important;
  mask-image: url('../assets/icons/trim.svg') !important;
}

.item-icon.svg-trim-start {
  -webkit-mask-image: url('../assets/icons/trim-start.svg') !important;
  mask-image: url('../assets/icons/trim-start.svg') !important;
}

.item-icon.svg-trim-end {
  -webkit-mask-image: url('../assets/icons/trim-end.svg') !important;
  mask-image: url('../assets/icons/trim-end.svg') !important;
}

.item-icon.svg-sort-asc {
  -webkit-mask-image: url('../assets/icons/sort-asc.svg') !important;
  mask-image: url('../assets/icons/sort-asc.svg') !important;
}

.item-icon.svg-sort-desc {
  -webkit-mask-image: url('../assets/icons/sort-desc.svg') !important;
  mask-image: url('../assets/icons/sort-desc.svg') !important;
}

.item-icon.svg-unique {
  -webkit-mask-image: url('../assets/icons/unique.svg') !important;
  mask-image: url('../assets/icons/unique.svg') !important;
}

.item-label {
  flex: 1;
}
</style>
