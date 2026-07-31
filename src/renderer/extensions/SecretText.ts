import { Mark, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Node as PMNode, Schema } from '@tiptap/pm/model'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/**
 * 密文遮罩 Mark：
 * - 文档里存的是原文 <span data-secret="true">原文</span>；
 * - 渲染时由 ProseMirror inline decoration 给每个字符套 <span class="secret-ch" data-mask="*">，
 *   配合 CSS 把字符透明、用 ::after 居中显示等量星号；
 * - 复制走 document slice 序列化（不经过 decoration），自然得到原文；
 * - 临时揭示（reveal）只走 transaction meta，不产生 step，因此不会触发 onUpdate / 落盘。
 */

export interface SecretRange {
  from: number
  to: number
}

interface SecretPluginState {
  revealed: SecretRange | null
  decos: DecorationSet
}

type SecretMeta =
  | { type: 'reveal'; from: number; to: number }
  | { type: 'clear' }

export const secretPluginKey = new PluginKey<SecretPluginState>('secretMask')

// 单段最大生成字符级 decoration 数量；超限后停止生成，浏览器依旧能渲染未遮罩的透明文字
const PER_CHAR_LIMIT = 4000

// 常用 CJK / 全角标点 / 假名字段；用两个星号纯为视觉对齐（不影响布局）
const WIDE_RE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]/

function buildDecos(doc: PMNode, schema: Schema, revealed: SecretRange | null): DecorationSet {
  const markType = schema.marks.secret
  if (!markType) return DecorationSet.empty
  const decos: Decoration[] = []
  let count = 0
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    if (!node.marks.some(m => m.type === markType)) return
    const text = node.text
    let i = 0
    while (i < text.length) {
      const cp = text.codePointAt(i)!
      // 代理对必须整体处理，否则 decoration 边界会把 surrogate pair 切开
      const size = cp > 0xffff ? 2 : 1
      const from = pos + i
      i += size
      if (revealed && from >= revealed.from && from < revealed.to) continue
      if (++count > PER_CHAR_LIMIT) return false
      decos.push(
        Decoration.inline(from, from + size, {
          class: 'secret-ch',
          'data-mask': WIDE_RE.test(String.fromCodePoint(cp)) ? '**' : '*',
        })
      )
    }
  })
  return DecorationSet.create(doc, decos)
}

export const SecretText = Mark.create({
  name: 'secret',

  // 像 Link 一样：在密文末尾继续打字不会被吸进遮罩
  inclusive: false,

  addOptions() {
    return { HTMLAttributes: {} }
  },

  parseHTML() {
    return [{ tag: 'span[data-secret]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-secret': 'true',
        class: 'secret-text',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setSecret:
        () =>
        ({ commands }) =>
          commands.setMark(this.name),
      unsetSecret:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
      toggleSecret:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
      // 仅带 meta，不产生 step → docChanged=false → 不触发 onUpdate
      revealSecret:
        (range: SecretRange) =>
        ({ tr }) => {
          tr.setMeta(secretPluginKey, { type: 'reveal', from: range.from, to: range.to })
          return true
        },
      hideSecret:
        () =>
        ({ tr }) => {
          tr.setMeta(secretPluginKey, { type: 'clear' })
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<SecretPluginState>({
        key: secretPluginKey,
        state: {
          init: (_, state) => ({
            revealed: null,
            decos: buildDecos(state.doc, state.schema, null),
          }),
          apply(tr, prev, _oldState, newState) {
            const meta = tr.getMeta(secretPluginKey) as SecretMeta | undefined
            if (!meta && !tr.docChanged) return prev
            let revealed = prev.revealed
            if (meta) {
              revealed = meta.type === 'reveal' ? { from: meta.from, to: meta.to } : null
            } else if (revealed) {
              const from = tr.mapping.map(revealed.from, 1)
              const to = tr.mapping.map(revealed.to, -1)
              revealed = from < to ? { from, to } : null
            }
            return {
              revealed,
              decos: buildDecos(newState.doc, newState.schema, revealed),
            }
          },
        },
        props: {
          decorations: state => secretPluginKey.getState(state)?.decos ?? DecorationSet.empty,
        },
      }),
    ]
  },
})

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    secret: {
      setSecret: () => ReturnType
      unsetSecret: () => ReturnType
      toggleSecret: () => ReturnType
      revealSecret: (range: SecretRange) => ReturnType
      hideSecret: () => ReturnType
    }
  }
}
