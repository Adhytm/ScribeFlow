import { useState, useRef, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import { QUICK_INSTRUCTIONS } from '../../prompts/frameworks';

interface Props {
  editor: Editor | null;
  top: number;
  left: number;
  /** 选区太靠顶部时，工具条改挂在选区下方，否则会被容器裁掉 */
  below?: boolean;
  busy: boolean;
  onRewrite: (instruction: string) => void;
  onClose: () => void;
}

/**
 * 选中文字后浮在选区上方的复合操作条 —— ChatGPT Canvas 风格 (图 4)：
 * 包含：AI 改写入口 (Ctrl+K)、超链接、加粗、斜体、文本/标题1-3/列表层级切换
 */
export function SelectionToolbar({ editor, top, left, below, busy, onRewrite, onClose }: Props) {
  const [showAiPrompt, setShowAiPrompt] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [instruction, setInstruction] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, []);

  const submit = (value: string) => {
    const text = value.trim();
    if (!text || busy) return;
    onRewrite(text);
    setInstruction('');
  };

  const isBold = editor?.isActive('bold') ?? false;
  const isItalic = editor?.isActive('italic') ?? false;
  const isLink = editor?.isActive('link') ?? false;
  const isH1 = editor?.isActive('heading', { level: 1 }) ?? false;
  const isH2 = editor?.isActive('heading', { level: 2 }) ?? false;
  const isH3 = editor?.isActive('heading', { level: 3 }) ?? false;
  const isBulletList = editor?.isActive('bulletList') ?? false;
  const isOrderedList = editor?.isActive('orderedList') ?? false;

  let currentBlockLabel = '文本';
  if (isH1) currentBlockLabel = '标题 1';
  else if (isH2) currentBlockLabel = '标题 2';
  else if (isH3) currentBlockLabel = '标题 3';
  else if (isBulletList) currentBlockLabel = '项目符号列表';
  else if (isOrderedList) currentBlockLabel = '编号列表';

  const handleApplyLink = () => {
    if (!editor) return;
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().unsetLink().run();
    } else {
      const formatted = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href: formatted }).run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  };

  return (
    <div
      className={'sel-toolbar' + (below ? ' below' : '')}
      style={{ top, left }}
      onMouseDown={e => {
        // 防止点击工具栏按钮导致选区丢失
        if ((e.target as HTMLElement).tagName !== 'INPUT') {
          e.preventDefault();
        }
      }}
    >
      {/* 顶部主格式栏（参考图 4） */}
      <div className="st-header-row">
        <button
          type="button"
          className={`st-btn st-btn-ai ${showAiPrompt ? 'active' : ''}`}
          disabled={busy}
          onClick={() => setShowAiPrompt(s => !s)}
          title="展开/折叠 AI 改写输入栏 (Ctrl+K)"
        >
          <span className="st-ai-icon">✦</span>
          <span>要求更改</span>
          <span className="st-shortcut-kbd">Ctrl+K</span>
        </button>

        <span className="st-divider" />

        {/* 超链接按钮 */}
        <button
          type="button"
          className={`st-icon-btn ${isLink ? 'active' : ''}`}
          title={isLink ? '已添加链接（点击修改或移除）' : '添加超链接'}
          onClick={() => {
            if (isLink) {
              editor?.chain().focus().unsetLink().run();
            } else {
              setShowLinkInput(s => !s);
            }
          }}
        >
          🔗
        </button>

        {/* 加粗 (B) */}
        <button
          type="button"
          className={`st-icon-btn ${isBold ? 'active' : ''}`}
          title="加粗 (Ctrl+B)"
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <b>B</b>
        </button>

        {/* 斜体 (I) */}
        <button
          type="button"
          className={`st-icon-btn ${isItalic ? 'active' : ''}`}
          title="斜体 (Ctrl+I)"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <i>I</i>
        </button>

        {/* 文本/标题层级下拉菜单 */}
        <div className="st-dropdown-wrap" ref={dropdownRef}>
          <button
            type="button"
            className={`st-dropdown-trigger ${showDropdown ? 'open' : ''}`}
            onClick={() => setShowDropdown(s => !s)}
            title="选择文本或标题层级"
          >
            <span>{currentBlockLabel}</span>
            <span className="st-chevron">▾</span>
          </button>

          {showDropdown && (
            <div className="st-menu">
              <button
                type="button"
                className={`st-menu-item ${!isH1 && !isH2 && !isH3 && !isBulletList && !isOrderedList ? 'selected' : ''}`}
                onClick={() => {
                  editor?.chain().focus().setParagraph().run();
                  setShowDropdown(false);
                }}
              >
                <span>文本</span>
                <span className="st-menu-kbd">Ctrl + Alt + 0</span>
              </button>

              <button
                type="button"
                className={`st-menu-item ${isH1 ? 'selected' : ''}`}
                onClick={() => {
                  editor?.chain().focus().toggleHeading({ level: 1 }).run();
                  setShowDropdown(false);
                }}
              >
                <span className="h-label h1">标题 1</span>
                <span className="st-menu-kbd">Ctrl + Alt + 1</span>
              </button>

              <button
                type="button"
                className={`st-menu-item ${isH2 ? 'selected' : ''}`}
                onClick={() => {
                  editor?.chain().focus().toggleHeading({ level: 2 }).run();
                  setShowDropdown(false);
                }}
              >
                <span className="h-label h2">标题 2</span>
                <span className="st-menu-kbd">Ctrl + Alt + 2</span>
              </button>

              <button
                type="button"
                className={`st-menu-item ${isH3 ? 'selected' : ''}`}
                onClick={() => {
                  editor?.chain().focus().toggleHeading({ level: 3 }).run();
                  setShowDropdown(false);
                }}
              >
                <span className="h-label h3">标题 3</span>
                <span className="st-menu-kbd">Ctrl + Alt + 3</span>
              </button>

              <div className="st-menu-divider" />

              <button
                type="button"
                className={`st-menu-item ${isOrderedList ? 'selected' : ''}`}
                onClick={() => {
                  editor?.chain().focus().toggleOrderedList().run();
                  setShowDropdown(false);
                }}
              >
                <span>编号列表</span>
                <span className="st-menu-kbd">Ctrl + Alt + 4</span>
              </button>

              <button
                type="button"
                className={`st-menu-item ${isBulletList ? 'selected' : ''}`}
                onClick={() => {
                  editor?.chain().focus().toggleBulletList().run();
                  setShowDropdown(false);
                }}
              >
                <span>项目符号列表</span>
                <span className="st-menu-kbd">Ctrl + Alt + 5</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 链接输入浮层 */}
      {showLinkInput && (
        <div className="st-link-row">
          <input
            className="st-input st-link-input"
            placeholder="输入链接 URL (如 https://...)"
            value={linkUrl}
            autoFocus
            onMouseDown={e => e.stopPropagation()}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleApplyLink();
              if (e.key === 'Escape') setShowLinkInput(false);
            }}
          />
          <button type="button" className="st-go" onClick={handleApplyLink}>
            应用
          </button>
          <button
            type="button"
            className="st-link-cancel"
            onClick={() => setShowLinkInput(false)}
          >
            ✕
          </button>
        </div>
      )}

      {/* AI 改写快捷标签与自定义输入区 */}
      {showAiPrompt && (
        <div className="st-ai-box">
          <div className="st-chips">
            {QUICK_INSTRUCTIONS.map(q => (
              <button
                key={q}
                type="button"
                className="st-chip"
                disabled={busy}
                onClick={() => submit(q)}
              >
                {q}
              </button>
            ))}
          </div>
          <div className="st-row">
            <input
              className="st-input"
              placeholder="输入你的具体修改诉求…"
              value={instruction}
              disabled={busy}
              onMouseDown={e => e.stopPropagation()}
              onChange={e => setInstruction(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submit(instruction);
                if (e.key === 'Escape') onClose();
              }}
            />
            <button
              type="button"
              className="st-go"
              disabled={busy || !instruction.trim()}
              onClick={() => submit(instruction)}
            >
              {busy ? '改中…' : '改写'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
