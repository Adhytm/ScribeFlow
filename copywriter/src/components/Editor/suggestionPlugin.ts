import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Suggestion } from '../../types/document';

/**
 * Canvas 式交互的地基。
 *
 * 选中一段 → AI 改写 → 原文保持在文档里不动，只是被标记成 pending，
 * 新文案在侧栏预览，由用户决定接受还是拒绝。
 *
 * 关键点是 from/to 每次 transaction 都要过一遍 mapping 重映射，
 * 否则上面插入内容后，下面的建议位置就全漂了。
 */

export interface SuggestionState {
  items: Suggestion[];
}

export type SuggestionMeta =
  | { type: 'add'; item: Suggestion }
  | { type: 'update'; id: string; patch: Partial<Suggestion> }
  | { type: 'remove'; id: string }
  | { type: 'clear' };

export const suggestionKey = new PluginKey<SuggestionState>('suggestions');

export const SuggestionExtension = Extension.create({
  name: 'suggestions',

  addProseMirrorPlugins() {
    return [
      new Plugin<SuggestionState>({
        key: suggestionKey,

        state: {
          init: (): SuggestionState => ({ items: [] }),

          apply(tr, value) {
            // 起点向右偏(1)、终点向左偏(-1)，确保在选区边界处键入文字时不会把新字符包裹进比对区间，防止误杀失效
            let items = value.items
              .map(it => ({
                ...it,
                from: tr.mapping.map(it.from, 1),
                to: tr.mapping.map(it.to, -1)
              })
            )
              .filter(it => it.from >= 0 && it.to > it.from && it.to <= tr.doc.content.size)
              // 光看坐标不够：原文被篡改或删除后，直接跟原文比对，对不上才作废。
              .filter(it => tr.doc.textBetween(it.from, it.to, '\n') === it.original);

            const meta = tr.getMeta(suggestionKey) as SuggestionMeta | undefined;
            if (meta) {
              if (meta.type === 'add') items = [...items, meta.item];
              else if (meta.type === 'update') items = items.map(it => (it.id === meta.id ? { ...it, ...meta.patch } : it));
              else if (meta.type === 'remove') items = items.filter(it => it.id !== meta.id);
              else items = [];
            }
            return { items };
          }
        },

        props: {
          decorations(state) {
            const { items } = suggestionKey.getState(state) ?? { items: [] };
            const live = items.filter(it => it.status === 'streaming' || it.status === 'pending');
            if (!live.length) return DecorationSet.empty;
            return DecorationSet.create(
              state.doc,
              live.map(it =>
                Decoration.inline(it.from, it.to, {
                  class: it.status === 'streaming' ? 'sg-range sg-streaming' : 'sg-range sg-pending',
                  'data-sg': it.id
                })
              )
            );
          }
        }
      })
    ];
  }
});

export function getSuggestions(state: EditorState): Suggestion[] {
  return suggestionKey.getState(state)?.items ?? [];
}

export function dispatchSuggestion(editor: Editor, meta: SuggestionMeta): void {
  editor.view.dispatch(editor.state.tr.setMeta(suggestionKey, meta));
}
