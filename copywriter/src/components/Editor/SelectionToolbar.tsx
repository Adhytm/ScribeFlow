import { useState } from 'react';
import { QUICK_INSTRUCTIONS } from '../../prompts/frameworks';

interface Props {
  top: number;
  left: number;
  /** 选区太靠顶部时，工具条改挂在选区下方，否则会被容器裁掉 */
  below?: boolean;
  busy: boolean;
  onRewrite: (instruction: string) => void;
  onClose: () => void;
}

/** 选中文字后浮在选区上方的操作条 —— Canvas 交互的入口 */
export function SelectionToolbar({ top, left, below, busy, onRewrite, onClose }: Props) {
  const [instruction, setInstruction] = useState('');

  const submit = (value: string) => {
    const text = value.trim();
    if (!text || busy) return;
    onRewrite(text);
    setInstruction('');
  };

  return (
    <div
      className={'sel-toolbar' + (below ? ' below' : '')}
      style={{ top, left }}
      onMouseDown={e => e.preventDefault()}
    >
      <div className="st-chips">
        {QUICK_INSTRUCTIONS.map(q => (
          <button key={q} className="st-chip" disabled={busy} onClick={() => submit(q)}>
            {q}
          </button>
        ))}
      </div>
      <div className="st-row">
        <input
          className="st-input"
          placeholder="或者自己说要怎么改…"
          value={instruction}
          disabled={busy}
          // 根容器为了保住编辑器选区对 mousedown 做了 preventDefault，
          // 不拦截冒泡的话 input 永远拿不到焦点（已实锤）
          onMouseDown={e => e.stopPropagation()}
          onChange={e => setInstruction(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit(instruction);
            if (e.key === 'Escape') onClose();
          }}
        />
        <button
          className="st-go"
          disabled={busy || !instruction.trim()}
          onClick={() => submit(instruction)}
        >
          {busy ? '改中…' : '改写'}
        </button>
      </div>
    </div>
  );
}
