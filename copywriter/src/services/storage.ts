import type { Brief, Snapshot, ProviderType, ClientProviderConfig, ThemeMode } from '../types/document';

const KEY = {
  snapshots: 'cw.snapshots',
  snapSeq: 'cw.snapSeq',
  doc: 'cw.doc',
  brief: 'cw.brief',
  settings: 'cw.settings',
  theme: 'cw.theme',
  titles: 'cw.titles'
};

export const DEFAULT_PROVIDER_CONFIGS: Record<string, ClientProviderConfig> = {
  local: {
    base: 'http://127.0.0.1:11434/v1',
    model: 'qwen2.5:7b',
    apiKey: ''
  },
  moonshot: {
    base: 'https://api.moonshot.ai/v1/chat/completions',
    model: 'moonshot-v1-8k',
    apiKey: ''
  },
  dashscope: {
    base: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    apiKey: ''
  },
  'aliyun-token-plan': {
    base: 'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    apiKey: ''
  },
  gemini: {
    base: 'https://generativelanguage.googleapis.com',
    model: 'gemini-2.0-flash',
    apiKey: ''
  },
  zhipu: {
    base: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    apiKey: ''
  },
  'zhipu-coding': {
    base: 'https://open.bigmodel.cn/api/coding/paas/v4',
    model: 'glm-4-flash',
    apiKey: ''
  },
  deepseek: {
    base: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    apiKey: ''
  },
  openai: {
    base: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    apiKey: ''
  },
  anthropic: {
    base: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-sonnet-20241022',
    apiKey: ''
  }
};

export interface Settings {
  provider: ProviderType;
  providers: Record<string, ClientProviderConfig>;
  temperature: number;
  model?: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const storage = {
  loadSnapshots(): Snapshot[] {
    const list = read<Snapshot[]>(KEY.snapshots, []);
    let maxSeq = read<number>(KEY.snapSeq, 0);
    for (const s of list) {
      if (typeof s.seq === 'number' && s.seq > maxSeq) {
        maxSeq = s.seq;
      }
    }

    let mutated = false;
    const hasMissing = list.some(s => typeof s.seq !== 'number');
    if (hasMissing && list.length > 0) {
      // 存量老数据迁移：按时间升序补号 1..N
      const sorted = [...list].sort((a, b) => a.ts - b.ts);
      let cur = maxSeq;
      for (const item of sorted) {
        if (typeof item.seq !== 'number') {
          cur += 1;
          item.seq = cur;
        }
      }
      maxSeq = cur;
      write(KEY.snapSeq, maxSeq);
      mutated = true;
    }

    if (mutated) {
      write(KEY.snapshots, list);
    }
    return list;
  },

  /** 返回版本号（seq 自增号），写入失败返回 0 */
  pushSnapshot(s: Omit<Snapshot, 'id' | 'ts' | 'seq'>): number {
    const list = storage.loadSnapshots();

    // 内容去重（TASK-001）：若新内容与最新快照 html 及 titles 相同，直接返回当前最新 seq，不产生重复快照
    if (list.length > 0 && list[0].html === s.html && (list[0].titles || '') === (s.titles || '')) {
      return list[0].seq ?? 0;
    }

    let maxSeq = read<number>(KEY.snapSeq, 0);
    for (const item of list) {
      if (typeof item.seq === 'number' && item.seq > maxSeq) {
        maxSeq = item.seq;
      }
    }
    const newSeq = maxSeq + 1;

    list.unshift({
      ...s,
      id: 's' + Date.now() + Math.random().toString(36).slice(2, 6),
      seq: newSeq,
      ts: Date.now()
    });

    // 每产品最多保留 60 版（TASK-006）
    const targetProduct = s.product || '未命名';
    let productCount = 0;
    const filteredList: Snapshot[] = [];
    for (const item of list) {
      const itemProduct = item.product || '未命名';
      if (itemProduct === targetProduct) {
        productCount++;
        if (productCount <= 60) {
          filteredList.push(item);
        }
      } else {
        filteredList.push(item);
      }
    }
    list.length = 0;
    list.push(...filteredList);

    // 全局软上限 200 版，防止 localStorage 溢出
    if (list.length > 200) {
      list.length = 200;
    }

    if (write(KEY.snapshots, list)) {
      write(KEY.snapSeq, newSeq);
      return newSeq;
    }

    // 空间不足静默降级尝试：截断保留最近 15 版（P2-8）
    list.length = Math.min(list.length, 15);
    if (write(KEY.snapshots, list)) {
      write(KEY.snapSeq, newSeq);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cw:storage-degraded', { detail: { count: list.length } }));
      }
      return newSeq;
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cw:storage-degraded', { detail: { count: 0, failed: true } }));
    }
    return 0;
  },

  deleteSnapshot(id: string): Snapshot[] {
    const list = storage.loadSnapshots().filter(s => s.id !== id);
    write(KEY.snapshots, list);
    return list;
  },

  clearSnapshots(): void {
    write(KEY.snapshots, []);
  },

  loadDoc(): string {
    return read<string>(KEY.doc, '');
  },
  saveDoc(html: string): void {
    write(KEY.doc, html);
  },

  loadBrief(): Brief | null {
    return read<Brief | null>(KEY.brief, null);
  },
  saveBrief(b: Brief): void {
    write(KEY.brief, b);
  },

  loadSettings(): Settings {
    const s = read<Partial<Settings>>(KEY.settings, {});
    const provider = s.provider || 'local';
    const mergedProviders: Record<string, ClientProviderConfig> = { ...DEFAULT_PROVIDER_CONFIGS };
    if (s.providers) {
      for (const [k, v] of Object.entries(s.providers)) {
        mergedProviders[k] = { ...DEFAULT_PROVIDER_CONFIGS[k], ...v };
      }
    }
    return {
      provider,
      providers: mergedProviders,
      temperature: s.temperature ?? 0.85,
      model: mergedProviders[provider]?.model || ''
    };
  },
  saveSettings(s: Settings): void {
    write(KEY.settings, s);
  },

  loadTheme(): ThemeMode {
    return read<ThemeMode>(KEY.theme, 'system');
  },
  saveTheme(t: ThemeMode): void {
    write(KEY.theme, t);
  },

  loadTitles(): string {
    return read<string>(KEY.titles, '');
  },
  saveTitles(t: string): void {
    write(KEY.titles, t);
  }
};

export function snapshotMarkdown(s: Snapshot): string {
  return [
    '# ' + (s.product || '文案'),
    '',
    '> 版本：' + s.label,
    '> 时间：' + new Date(s.ts).toLocaleString('zh-CN'),
    '> 人群：' + s.crowd,
    '',
    s.text || '(空)',
    s.titles ? '\n## 配套标题\n\n' + s.titles : ''
  ].join('\n');
}

export function download(filename: string, text: string, mime = 'text/markdown') {
  const blob = new Blob(['\ufeff' + text], { type: mime + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function safeFileName(s: Snapshot): string {
  const t = new Date(s.ts);
  const p2 = (n: number) => String(n).padStart(2, '0');
  const stamp = `${t.getFullYear()}${p2(t.getMonth() + 1)}${p2(t.getDate())}-${p2(t.getHours())}${p2(t.getMinutes())}${p2(t.getSeconds())}`;
  const vPart = s.seq ? `_v${s.seq}` : '';
  return `${stamp}_${s.product || '文案'}${vPart}_${s.label}`
    .replace(/[\\/:*?"<>|·•\s]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 100) + '.md';
}

export async function autoSaveSnapshotToFile(
  dirHandle: FileSystemDirectoryHandle,
  s: Snapshot
): Promise<boolean> {
  try {
    const name = safeFileName(s);
    const fh = await dirHandle.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(snapshotMarkdown(s));
    await w.close();
    return true;
  } catch (err) {
    console.warn('自动落盘写入失败:', err);
    return false;
  }
}
