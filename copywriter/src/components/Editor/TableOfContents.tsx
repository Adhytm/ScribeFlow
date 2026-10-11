import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';

export interface TocItem {
  id: string;
  level: number;
  text: string;
  pos: number;
}

export function extractHeadings(editor: Editor | null): TocItem[] {
  if (!editor) return [];
  const items: TocItem[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const level = Number(node.attrs.level) || 2;
      const text = node.textContent.trim();
      items.push({
        id: `h-${pos}-${level}`,
        level,
        text: text || `(未命名 ${level} 级标题)`,
        pos
      });
    }
  });
  return items;
}

interface Props {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 基于 1, 2, 3 级标题自动生成的目录大纲树 (TOC)
 */
export function TableOfContents({ editor, isOpen, onClose }: Props) {
  const [headings, setHeadings] = useState<TocItem[]>(() => extractHeadings(editor));

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      setHeadings(extractHeadings(editor));
    };
    editor.on('update', update);
    editor.on('transaction', update);
    update();
    return () => {
      editor.off('update', update);
      editor.off('transaction', update);
    };
  }, [editor]);

  if (!isOpen) return null;

  const handleJump = (pos: number) => {
    if (!editor) return;
    editor.commands.setTextSelection(pos);
    editor.commands.focus();

    // 尝试平滑滚动到目标节点
    try {
      const dom = editor.view.nodeDOM(pos);
      if (dom instanceof HTMLElement) {
        dom.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // 轻度闪烁高亮反馈
        dom.classList.add('heading-jump-highlight');
        setTimeout(() => dom.classList.remove('heading-jump-highlight'), 1200);
        return;
      }
    } catch {
      // 容错降级
    }

    const coords = editor.view.coordsAtPos(pos);
    window.scrollTo({ top: coords.top + window.scrollY - 100, behavior: 'smooth' });
  };

  return (
    <aside className="toc-drawer" aria-label="文档标题大纲目录">
      <div className="toc-header">
        <div className="toc-title">
          <span className="toc-icon">📑</span>
          <span>标题大纲 ({headings.length})</span>
        </div>
        <button
          type="button"
          className="toc-close-btn"
          onClick={onClose}
          title="收起大纲"
          aria-label="关闭大纲"
        >
          ✕
        </button>
      </div>

      <div className="toc-list">
        {headings.length === 0 ? (
          <div className="toc-empty">
            <p>暂无标题层级</p>
            <span>在正文中选中文本，通过浮动工具栏设为「标题 1 / 2 / 3」，即可自动生成导航树。</span>
          </div>
        ) : (
          headings.map(h => (
            <button
              key={h.id}
              type="button"
              className={`toc-item toc-level-${h.level}`}
              onClick={() => handleJump(h.pos)}
              title={`点击跳转到：${h.text}`}
            >
              <span className={`toc-badge badge-h${h.level}`}>H{h.level}</span>
              <span className="toc-text">{h.text}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
