import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EditorContent, type Editor } from '@tiptap/react';
import { SelectionToolbar } from './SelectionToolbar';
import { TableOfContents, extractHeadings } from './TableOfContents';
import { SmartCapsules } from './SmartCapsules';

import type { PostEditAdvice } from '../../types/document';

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
  advice?: PostEditAdvice | null;
  isAdvising?: boolean;
  onRequestAdvice?: () => void;
  onRewrite: (from: number, to: number, text: string, instruction: string) => void;
  placeholder?: ReactNode;
  onCopyFullText?: () => void;
  onExportMarkdown?: () => void;
  zenMode?: boolean;
  onToggleZenMode?: () => void;
}

export function EditorPane({
  editor,
  busy,
  advice = null,
  isAdvising = false,
  onRequestAdvice,
  onRewrite,
  placeholder,
  onCopyFullText,
  onExportMarkdown,
  zenMode = false,
  onToggleZenMode
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<Selection | null>(null);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [headingCount, setHeadingCount] = useState(0);

  // 监听大纲数量更新，便于在顶栏显示标题计数徽标
  useEffect(() => {
    if (!editor) return;
    const updateCount = () => {
      setHeadingCount(extractHeadings(editor).length);
    };
    editor.on('update', updateCount);
    editor.on('transaction', updateCount);
    updateCount();
    return () => {
      editor.off('update', updateCount);
      editor.off('transaction', updateCount);
    };
  }, [editor]);

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
      // 复合工具条宽约 370px（半宽 185px），限制在容器内避免横向戳出
      const left = Math.max(195, Math.min(box.width - 195, rawLeft));

      // 视口感知判定：顶栏高约 60px，工具条高约 110px。
      // 若选区距离视口顶端小于 180px，上方空间不足以容纳工具条，改放选区下方
      const minClientTop = Math.min(start.top, end.top);
      const below = minClientTop < 180;

      setSel({
        from,
        to,
        text,
        top: minClientTop - box.top - 12,
        topEnd: Math.max(start.bottom, end.bottom) - box.top + 10,
        left,
        below
      });
    };

    editor.on('selectionUpdate', update);
    editor.on('transaction', update);

    // 视口滚动与缩放时同步重算工具条位置，防止脱节漂移 (P2-3)
    const handleScrollOrResize = () => {
      if (editor.state.selection && !editor.state.selection.empty) {
        update();
      }
    };
    window.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
      window.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
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
    <div className={`editor-container-shell ${isTocOpen ? 'with-toc' : ''}`}>
      {/* 1, 2, 3 级标题目录大纲导航树 */}
      <TableOfContents
        editor={editor}
        isOpen={isTocOpen}
        onClose={() => setIsTocOpen(false)}
      />

      <div className={`editor-wrap ${zenMode ? 'zen-editor' : ''}`} ref={wrapRef}>
        {/* 编辑器顶栏：大纲开关、专注全屏模式、快捷操作 */}
        <div className="editor-top-bar">
          <div className="editor-top-left">
            <button
              type="button"
              className={`top-bar-btn ${isTocOpen ? 'active' : ''}`}
              onClick={() => setIsTocOpen(o => !o)}
              title={isTocOpen ? '收起目录大纲' : '展开 1/2/3 级标题大纲树'}
            >
              <span className="tb-icon">📑</span>
              <span>大纲目录</span>
              {headingCount > 0 && <span className="tb-count">{headingCount}</span>}
            </button>
          </div>

          <div className="editor-top-right">
            {onToggleZenMode && (
              <button
                type="button"
                className={`top-bar-btn ${zenMode ? 'active' : ''}`}
                onClick={onToggleZenMode}
                title={zenMode ? '退出专注模式 (Esc)' : '进入宽屏专注模式'}
              >
                <span className="tb-icon">{zenMode ? '🗗' : '⛶'}</span>
                <span>{zenMode ? '退出专注' : '专注模式'}</span>
              </button>
            )}
            {onCopyFullText && (
              <button
                type="button"
                className="top-bar-btn ghost"
                onClick={onCopyFullText}
                title="复制纯文本全文到剪贴板"
              >
                复制全文
              </button>
            )}
            {onExportMarkdown && (
              <button
                type="button"
                className="top-bar-btn ghost"
                onClick={onExportMarkdown}
                title="导出当前正文与标题为 Markdown 文件"
              >
                导出 .md
              </button>
            )}
          </div>
        </div>

        {/* 正文输入与占位提示区域 */}
        <div className="editor-body-area">
          {isEmpty && placeholder ? <div className="editor-placeholder">{placeholder}</div> : null}
          <EditorContent editor={editor} className="editor-content" />
        </div>

        {/* AI 智能副驾驶：修改后进一步建议与动态下一步动作卡片 */}
        {!isEmpty && (
          <SmartCapsules
            editor={editor}
            busy={busy}
            advice={advice}
            isAdvising={isAdvising}
            onRequestAdvice={onRequestAdvice}
            onRewrite={onRewrite}
          />
        )}

        {/* 底部统计栏 */}
        {!isEmpty && (
          <div className="editor-stat-bar">
            <div className="editor-stat-actions">
              <span className="editor-mode-badge">{zenMode ? '✦ 专注全屏' : '标准编辑'}</span>
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

        {/* 选中文本后的复合悬浮工具条（ChatGPT Canvas 样式） */}
        {sel && (
          <SelectionToolbar
            editor={editor}
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
    </div>
  );
}
