import { useState } from 'react';
import type { Suggestion } from '../../types/document';

interface Props {
  items: Suggestion[];
  onAccept: (item: Suggestion) => void;
  onReject: (item: Suggestion) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onFocus: (item: Suggestion) => void;
}

export function SuggestionPanel({ items, onAccept, onReject, onAcceptAll, onRejectAll, onFocus }: Props) {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  if (!items.length) {
    return (
      <div className="panel-empty">
        还没有修改建议。
        <br />
        在正文里<b>选中一段字</b>，上方会浮出工具条，输入要求就能改。
      </div>
    );
  }

  const pending = items.filter(i => i.status === 'pending').length;

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="sg-panel">
      <div className="sg-bar">
        <span className="sg-count">{items.length} 条建议{pending ? `（${pending} 条待确认）` : ''}</span>
        <span className="sp" />
        <button className="sm" disabled={!pending} onClick={onAcceptAll}>全部接受</button>
        <button className="sm" disabled={!items.length} onClick={onRejectAll}>全部拒绝</button>
      </div>
      {items.map(it => {
        const isExpanded = !!expandedIds[it.id];
        const isLong = it.original.length > 70;
        return (
          <div
            key={it.id}
            className={'sg-card' + (it.status === 'streaming' ? ' streaming' : '')}
            onClick={() => onFocus(it)}
          >
            <div className="sg-head">
              <span className="sg-tag">{it.instruction}</span>
              {it.status === 'streaming' ? <span className="sg-dot" /> : null}
            </div>
            <div className={'sg-orig' + (isExpanded ? ' expanded' : '')}>{it.original}</div>
            {isLong && (
              <button
                type="button"
                className="sg-expand-btn"
                onClick={e => toggleExpand(it.id, e)}
              >
                {isExpanded ? '收起原文 ▴' : '展开全文 ▾'}
              </button>
            )}
            <div className="sg-arrow">↓</div>
            <div className="sg-new">{it.replacement || (it.status === 'streaming' ? '生成中…' : '（无内容）')}</div>
            {it.status === 'pending' && (
              <div className="sg-ops">
                <button className="sm hot" onClick={e => { e.stopPropagation(); onAccept(it); }}>接受</button>
                <button className="sm" onClick={e => { e.stopPropagation(); onReject(it); }}>拒绝</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
