import { useState, useEffect } from 'react';

export interface ConfirmOptions {
  title: string;
  body: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface DialogState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

let openConfirmFn: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (openConfirmFn) {
    return openConfirmFn(options);
  }
  return Promise.resolve(window.confirm(`${options.title}\n\n${options.body}`));
}

export function ConfirmDialogContainer() {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  useEffect(() => {
    openConfirmFn = (opts: ConfirmOptions) => {
      return new Promise<boolean>(resolve => {
        setDialog({ ...opts, resolve });
      });
    };
    return () => {
      openConfirmFn = null;
    };
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dialog.resolve(false);
        setDialog(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog]);

  if (!dialog) return null;

  const handleCancel = () => {
    dialog.resolve(false);
    setDialog(null);
  };

  const handleConfirm = () => {
    dialog.resolve(true);
    setDialog(null);
  };

  return (
    <div className="dialog-overlay" onClick={handleCancel}>
      <div className="dialog-card" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3 className="dialog-title">{dialog.title}</h3>
        <div className="dialog-body">{dialog.body}</div>
        <div className="dialog-actions">
          <button type="button" className="sm ghost" onClick={handleCancel}>
            {dialog.cancelText || '取消'}
          </button>
          <button
            type="button"
            className={`sm ${dialog.danger ? 'hot' : 'primary'}`}
            onClick={handleConfirm}
            autoFocus
          >
            {dialog.confirmText || '确定'}
          </button>
        </div>
      </div>
    </div>
  );
}
