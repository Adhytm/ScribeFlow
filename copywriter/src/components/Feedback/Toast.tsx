import { useState, useEffect } from 'react';

export interface ToastItem {
  id: string;
  type: 'success' | 'info' | 'error' | 'warn';
  message: string;
  detail?: string;
  duration?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;
let listeners: ToastListener[] = [];
let currentToasts: ToastItem[] = [];

function notifyListeners() {
  for (const listener of listeners) {
    listener([...currentToasts]);
  }
}

export const toast = {
  show(item: Omit<ToastItem, 'id'>) {
    const id = 't_' + Date.now() + Math.random().toString(36).slice(2, 6);
    const newToast: ToastItem = { ...item, id };
    currentToasts = [newToast, ...currentToasts].slice(0, 5); // 最多堆叠 5 条
    notifyListeners();

    const duration = item.duration ?? (item.type === 'error' ? 8000 : 4000);
    if (duration > 0) {
      setTimeout(() => {
        toast.dismiss(id);
      }, duration);
    }
    return id;
  },
  success(message: string, detail?: string) {
    return toast.show({ type: 'success', message, detail });
  },
  info(message: string, detail?: string) {
    return toast.show({ type: 'info', message, detail });
  },
  warn(message: string, detail?: string) {
    return toast.show({ type: 'warn', message, detail });
  },
  error(message: string, detail?: string) {
    return toast.show({ type: 'error', message, detail });
  },
  dismiss(id: string) {
    currentToasts = currentToasts.filter(t => t.id !== id);
    notifyListeners();
  }
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>(currentToasts);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    listeners.push(setToasts);
    return () => {
      listeners = listeners.filter(l => l !== setToasts);
    };
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="toast-viewport" role="region" aria-label="系统通知">
      {toasts.map(t => (
        <div key={t.id} className={`toast-card toast-${t.type}`}>
          <div className="toast-header">
            <span className="toast-badge">{t.type === 'error' ? '失败' : t.type === 'success' ? '成功' : t.type === 'warn' ? '提醒' : '通知'}</span>
            <span className="toast-msg">{t.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => toast.dismiss(t.id)}
              aria-label="关闭通知"
            >
              ✕
            </button>
          </div>
          {t.detail && (
            <div className="toast-detail-wrap">
              <pre className="toast-detail-text">{t.detail}</pre>
              <button
                type="button"
                className="sm ghost toast-copy-btn"
                onClick={() => {
                  navigator.clipboard.writeText(t.detail || '');
                  setCopiedId(t.id);
                  setTimeout(() => setCopiedId(null), 2000);
                }}
              >
                {copiedId === t.id ? '已复制 ✓' : '复制详情'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
