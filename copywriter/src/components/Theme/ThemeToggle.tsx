import type { ThemeMode } from '../../types/document';

interface Props {
  mode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  onChange: (mode: ThemeMode) => void;
}

export function ThemeToggle({ mode, resolvedTheme, onChange }: Props) {
  return (
    <div className="theme-toggle" role="radiogroup" aria-label="外观主题切换">
      <button
        type="button"
        className={`theme-btn ${mode === 'system' ? 'on' : ''}`}
        onClick={() => onChange('system')}
        title={`跟随系统（当前检测为：${resolvedTheme === 'dark' ? '深色' : '浅色'}）`}
        aria-checked={mode === 'system'}
        role="radio"
      >
        <svg className="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <span className="theme-text">跟随系统</span>
      </button>

      <button
        type="button"
        className={`theme-btn ${mode === 'light' ? 'on' : ''}`}
        onClick={() => onChange('light')}
        title="固定浅色模式（清爽高亮，白底护眼）"
        aria-checked={mode === 'light'}
        role="radio"
      >
        <svg className="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
        <span className="theme-text">浅色</span>
      </button>

      <button
        type="button"
        className={`theme-btn ${mode === 'dark' ? 'on' : ''}`}
        onClick={() => onChange('dark')}
        title="固定深色模式（沉浸护眼，克制低对比）"
        aria-checked={mode === 'dark'}
        role="radio"
      >
        <svg className="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <span className="theme-text">深色</span>
      </button>
    </div>
  );
}
