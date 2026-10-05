import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EditorContent, type Editor } from '@tiptap/react';
import { SelectionToolbar } from './SelectionToolbar';

interface Selection {
  from: number;
  to: number;
  text: string;
  top: number;
  topEnd: number;
  left: number;
  below: boolean;
}

interface Props {
  editor: Editor | null;
  busy: boolean;
  onRewrite: (from: number, to: number, text: string, instruction: string) => void;
  placeholder?: ReactNode;
  onCopyFullText?: () => void;
  onExportMarkdown?: () => void;
}

export function EditorPane({
  editor,
  busy,
  onRewrite,
  placeholder,
  onCopyFullText,
  onExportMarkdown
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<Selection | null>(null);

  useEffect(() => {
    if (!editor) return;

    const update = () => {
      const { from, to, empty } = editor.state.selection;
      const wrap = wrapRef.current;
      if (!wrap) return;
      if (empty) { setSel(null); return; }

      const text = editor.state.doc.textBetween(from, to, '\n');
      if (!text.trim()) { setSel(null); return; }

      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      const box = wrap.getBoundingClientRect();
      const rawLeft = (Math.min(start.left, end.left) + Math.max(start.left, end.left)) / 2 - box.left;
      // 工具条宽 320px（半宽 160px），限制在容器内避免横向戳出被左栏或右栏遮挡
      const left = Math.max(168, Math.min(box.width - 168, rawLeft));

      // 视口感知判定：顶栏高约 60px，工具条高约 95px。
      // 若选区距离视口顶端小于 160px，上方空间不足以容纳工具条，改放选区下方
      const minClientTop = Math.min(start.top, end.top);
      const below = minClientTop < 160;

      setSel({
        from,
        to,
        text,
        top: minClientTop - box.top - 10,
        topEnd: Math.max(start.bottom, end.bottom) - box.top + 8,
        left,
        below
      });
    };

    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
    };
  }, [editor]);

  // 点击编辑器容器外部时自动关闭悬浮工具条
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setSel(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const isEmpty = editor ? editor.isEmpty : true;
  const rawText = editor ? editor.getText() : '';
  const charCount = rawText.replace(/\s+/g, '').length;
  const paraCount = rawText.split('\n').filter(s => s.trim().length > 0).length;

  return (
    <div className="editor-wrap" ref={wrapRef}>
      {isEmpty && placeholder ? <div className="editor-placeholder">{placeholder}</div> : null}
      <EditorContent editor={editor} className="editor-content" />
      {!isEmpty && (
        <div className="editor-stat-bar">
          <div className="editor-stat-actions">
            {onCopyFullText && (
              <button
                type="button"
                className="sm ghost"
                onClick={onCopyFullText}
                title="复制纯文本全文到剪贴板"
              >
                复制全文
              </button>
            )}
            {onExportMarkdown && (
              <button
                type="button"
                className="sm ghost"
                onClick={onExportMarkdown}
                title="导出当前正文与标题为 Markdown 文件"
              >
                导出 .md
              </button>
            )}
          </div>
          <div className="sp" />
          <div className="editor-stat-info">
            <span>正文共 <b>{charCount}</b> 字</span>
            <span className="stat-dot">·</span>
            <span>{paraCount} 个段落</span>
            <span className="stat-dot">·</span>
            <span>约 {Math.max(1, Math.ceil(charCount / 300))} 分钟阅读</span>
          </div>
        </div>
      )}
      {sel && (
        <SelectionToolbar
          below={sel.below}
          top={sel.below ? sel.topEnd : Math.max(sel.top, 8)}
          left={sel.left}
          busy={busy}
          onClose={() => {
            setSel(null);
            if (editor) {
              // 折叠选区至末尾光标，避免 transaction 监听到非空选区又弹起工具条
              const { to } = editor.state.selection;
              editor.commands.setTextSelection(to);
              editor.commands.focus();
            }
          }}
          onRewrite={instruction => {
            const { from, to, text } = sel;
            setSel(null);
            onRewrite(from, to, text, instruction);
          }}
        />
      )}
    </div>
  );
}
