import { useState, useMemo, useEffect } from 'react';
import type { Snapshot } from '../../types/document';
import { download, snapshotMarkdown, safeFileName } from '../../services/storage';
import { confirmDialog } from '../Feedback/ConfirmDialog';

interface Props {
  items: Snapshot[];
  currentProduct?: string;
  currentId: string | null;
  isDiverged?: boolean;
  dirName: string | null;
  isDirAuthorized?: boolean;
  onBindDir: () => void;
  onUnbindDir: () => void;
  onLoad: (s: Snapshot) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onExportAll: (subset?: Snapshot[]) => void;
}

export function HistoryPanel({
  items,
  currentProduct,
  currentId,
  isDiverged,
  dirName,
  isDirAuthorized,
  onBindDir,
  onUnbindDir,
  onLoad,
  onDelete,
  onClear,
  onExportAll
}: Props) {
  const normCurrent = currentProduct?.trim();
  const [filter, setFilter] = useState<string>('all');

  // 提取快照中的全部产品名（去重）
  const products = useMemo(() => {
    const list: string[] = [];
    for (const item of items) {
      const p = (item.product || '未命名').trim() || '未命名';
      if (!list.includes(p)) list.push(p);
    }
    return list;
  }, [items]);

  // 若当前筛选的产品已不在快照列表中，自动回退到「全部」
  useEffect(() => {
    if (filter !== 'all' && !products.includes(filter)) {
      setFilter('all');
    }
  }, [filter, products]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter(s => ((s.product || '未命名').trim() || '未命名') === filter);
  }, [filter, items]);

  return (
    <div className="hs-panel">
      <div className="hs-dir-bar">
        {dirName ? (
          <>
            <span className="hs-dir-title" title={`本地文件夹：${dirName}`}>
              📁 <b>{isDirAuthorized ? '已绑定：' : '已选目录：'}</b>
              {dirName}
              {!isDirAuthorized && <span style={{ color: 'var(--warn)', marginLeft: 4 }}>（待授权）</span>}
            </span>
            {!isDirAuthorized && (
              <button className="sm hot" onClick={onBindDir} title="点击授权浏览器写入该文件夹">
                点击授权
              </button>
            )}
            <button className="sm ghost" onClick={onUnbindDir} title="解除文件夹绑定">解绑</button>
          </>
        ) : (
          <>
            <span className="hs-dir-title">📁 自动落盘：未开启</span>
            <button className="sm" onClick={onBindDir}>绑定文件夹</button>
          </>
        )}
      </div>

      {!items.length ? (
        <div className="panel-empty">还没有快照。<br />生成、接受改写、存一版都会自动留下记录。</div>
      ) : (
        <>
          {products.length > 0 && (
            <div className="hs-filter-bar" role="tablist" aria-label="产品历史版本筛选">
              <button
                type="button"
                className={'hs-filter-chip' + (filter === 'all' ? ' active' : '')}
                onClick={() => setFilter('all')}
              >
                全部 ({items.length})
              </button>
              {normCurrent && (
                <button
                  type="button"
                  className={'hs-filter-chip' + (filter === normCurrent ? ' active' : '')}
                  onClick={() => setFilter(normCurrent)}
                >
                  当前: {normCurrent} ({items.filter(s => ((s.product || '未命名').trim() || '未命名') === normCurrent).length})
                </button>
              )}
              {products
                .filter(p => p !== normCurrent)
                .map(p => (
                  <button
                    key={p}
                    type="button"
                    className={'hs-filter-chip' + (filter === p ? ' active' : '')}
                    onClick={() => setFilter(p)}
                  >
                    {p} ({items.filter(s => ((s.product || '未命名').trim() || '未命名') === p).length})
                  </button>
                ))}
            </div>
          )}

          <div className="sg-bar">
            <span className="sg-count">
              {filter === 'all' ? `${items.length} 版` : `${filteredItems.length} / ${items.length} 版`}
            </span>
            <span className="sp" />
            <button className="sm" onClick={() => onExportAll(filteredItems)}>
              导出{filter === 'all' ? '全部' : '本组'}
            </button>
            <button
              className="sm"
              onClick={async () => {
                const ok = await confirmDialog({
                  title: '清空历史版本',
                  body: `确定要清空全部 ${items.length} 个历史版本吗？\n清空后将无法恢复，建议先「导出全部」备份。`,
                  confirmText: '清空',
                  danger: true
                });
                if (ok) {
                  onClear();
                }
              }}
            >
              清空
            </button>
          </div>

          {filteredItems.length === 0 ? (
            <div className="panel-empty" style={{ padding: '24px 12px' }}>
              当前筛选「{filter}」下暂无快照。<br />
              <button className="sm ghost" style={{ marginTop: 8 }} onClick={() => setFilter('all')}>
                查看全部版本
              </button>
            </div>
          ) : (
            filteredItems.map((s, i) => {
              const vNo = s.seq ?? (items.length - i);
              const isCur = s.id === currentId;
              const curText = isCur ? (isDiverged ? ' · 基于此版修改中' : ' · 当前') : '';
              return (
                <div key={s.id} className={'hs-item' + (isCur ? ' cur' : '')}>
                  <div className="hs-top">
                    <span className="vno">v{vNo}{curText}</span>
                    <span className="vlabel">{s.label}</span>
                    <span className="vtime">{new Date(s.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="hs-prev">{s.product || '未命名'} · {s.text.replace(/\n+/g, ' ').slice(0, 80)}…</div>
                  <div className="sg-ops">
                    <button className="sm" onClick={() => onLoad(s)}>载入</button>
                    <button className="sm" onClick={() => download(safeFileName(s), snapshotMarkdown(s))}>导出</button>
                    <button
                      className="sm"
                      onClick={async () => {
                        const ok = await confirmDialog({
                          title: '删除版本',
                          body: `确定删除版本「v${vNo} · ${s.label}」吗？`,
                          confirmText: '删除',
                          danger: true
                        });
                        if (ok) {
                          onDelete(s.id);
                        }
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
}
