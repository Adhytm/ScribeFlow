import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { SuggestionExtension, dispatchSuggestion, getSuggestions } from './components/Editor/suggestionPlugin';
import { EditorPane } from './components/Editor/Editor';
import { SuggestionPanel } from './components/Editor/SuggestionPanel';
import { GeneratePanel } from './components/GeneratePanel/GeneratePanel';
import { ApiSettings } from './components/GeneratePanel/ApiSettings';
import { HistoryPanel } from './components/History/HistoryPanel';
import { ThemeToggle } from './components/Theme/ThemeToggle';
import { DEFAULT_CUSTOM_SECTIONS, buildMainPrompt, buildRewritePrompt, buildTitlePrompt, getFramework, buildPostEditAdvicePrompt, getHeuristicPostEditAdvice } from './prompts/frameworks';
import { escapeHtml, parseSections, sectionsToHtml, streamChat, textToHtml, requestPostEditAdvice } from './services/llm';
import { download, storage, DEFAULT_PROVIDER_CONFIGS, autoSaveSnapshotToFile } from './services/storage';
import { ToastContainer, toast } from './components/Feedback/Toast';
import { ConfirmDialogContainer, confirmDialog } from './components/Feedback/ConfirmDialog';
import type { Brief, Snapshot, Suggestion, ThemeMode, PostEditAdvice } from './types/document';
import type { Editor } from '@tiptap/react';

const EMPTY_BRIEF: Brief = {
  frameworkId: 'ec-detail',
  name: '', crowd: '', sell: '', pain: '', scene: '', proof: '', diff: '',
  view: '品牌官方', tone: '克制专业', length: 600, temperature: 0.85,
  thinkingMode: '构思', ban: '',
  customSections: DEFAULT_CUSTOM_SECTIONS
};

function sameSuggestions(a: Suggestion[], b: Suggestion[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((it, i) => {
    const o = b[i];
    return it.id === o.id && it.from === o.from && it.to === o.to &&
      it.status === o.status && it.replacement === o.replacement;
  });
}

/** 智能格式化替换内容：同段替换保持行内结构，换行转为 <br>，防止段落被炸裂成多个独立块 (P2-4) */
function formatReplacement(editor: Editor, from: number, to: number, text: string): string {
  const trimmed = text.trim();
  const $from = editor.state.doc.resolve(from);
  const $to = editor.state.doc.resolve(to);
  const sameParent = $from.sameParent($to);

  if (sameParent) {
    return trimmed
      .split(/\n+/)
      .map(line => escapeHtml(line.trim()))
      .filter(Boolean)
      .join('<br>');
  }
  return textToHtml(trimmed);
}

export default function App() {
  const [brief, setBrief] = useState<Brief>(() => ({ ...EMPTY_BRIEF, ...storage.loadBrief() }));
  const [snaps, setSnaps] = useState<Snapshot[]>(() => storage.loadSnapshots());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [isDiverged, setIsDiverged] = useState(false);
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [titles, setTitles] = useState(() => storage.loadTitles());
  const [copiedTitle, setCopiedTitle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyKind, setBusyKind] = useState<'generate' | 'rewrite' | 'titles' | null>(null);
  const [streamCharCount, setStreamCharCount] = useState<number>(0);
  const [advice, setAdvice] = useState<PostEditAdvice | null>(null);
  const [isAdvising, setIsAdvising] = useState<boolean>(false);
  const adviceAbortRef = useRef<AbortController | null>(null);
  const [status, setStatus] = useState('');
  const [tab, setTab] = useState<'sg' | 'hs'>('sg');
  const [narrowTab, setNarrowTab] = useState<'left' | 'mid' | 'right'>('mid');
  const [settings, setSettings] = useState(() => storage.loadSettings());
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => storage.loadTheme());
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [dirName, setDirName] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('cw.dirBound') || '';
  });
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  dirHandleRef.current = dirHandle;

  const abortRef = useRef<AbortController | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const currentIdRef = useRef<string | null>(null);
  currentIdRef.current = currentId;
  const snapsRef = useRef<Snapshot[]>([]);
  snapsRef.current = snaps;
  const prevSugsRef = useRef<Suggestion[]>([]);
  const explicitRemovedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      const isDark = media.matches;
      const currentResolved = isDark ? 'dark' : 'light';
      setResolvedTheme(currentResolved);
      const active = themeMode === 'system' ? currentResolved : themeMode;
      document.documentElement.setAttribute('data-theme', active);
      document.documentElement.setAttribute('data-theme-mode', themeMode);
    };

    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [themeMode]);

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    storage.saveTheme(mode);
  };

  const scheduleSave = useCallback((html: string) => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      storage.saveDoc(html);
      // P2-3: 检测当前编辑器内容是否相对当前选中的快照发生偏离
      if (currentIdRef.current) {
        const curSnap = snapsRef.current.find(s => s.id === currentIdRef.current);
        if (curSnap) {
          setIsDiverged(curSnap.html !== html);
        }
      }
    }, 600);
  }, []);

  // brief 以前只在点「生成」时才持久化，改完表单直接关页面会丢草稿；这里防抖自动存
  useEffect(() => {
    const t = window.setTimeout(() => storage.saveBrief(brief), 400);
    return () => window.clearTimeout(t);
  }, [brief]);

  // P0-1: 监听快照存储空间写满事件，保护现有数据不被破坏
  useEffect(() => {
    const handler = (e: any) => {
      const detail = e.detail;
      if (detail?.failed) {
        toast.error('本地存储空间已满', '存储配额达到上限，新快照写入失败。系统已保护现有历史版本不被破坏，请在历史面板中「导出全部」并清理老旧版本。');
      }
    };
    window.addEventListener('cw:storage-degraded', handler);
    return () => window.removeEventListener('cw:storage-degraded', handler);
  }, []);

  // P2-1: 监听多标签页存储变动，同步快照并提醒避免盲写覆盖
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cw.doc' && e.newValue) {
        toast.info(
          '文档在其他窗口被修改',
          '检测到外部标签页更新了正文草稿。如有需要，可在历史面板载入最新版本。'
        );
      }
      if (e.key === 'cw.snapshots') {
        setSnaps(storage.loadSnapshots());
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // P2-2: 页面关闭或刷新防丢保护（AI 处理中或存在待确认建议时进行系统拦截）
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasUnconfirmed = sugs.some(s => s.status === 'pending' || s.status === 'streaming');
      if (busy || hasUnconfirmed) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [busy, sugs]);

  const [zenMode, setZenMode] = useState<boolean>(false);

  // ESC 键随时快速退出专注模式
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && zenMode) {
        setZenMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zenMode]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'editor-link',
          target: '_blank',
          rel: 'noopener noreferrer'
        }
      }),
      SuggestionExtension
    ],
    content: storage.loadDoc(),
    editorProps: { attributes: { class: 'pm-body' } },
    onUpdate: ({ editor }) => scheduleSave(editor.getHTML())
  });

  // P2-1: 同步建议状态并检测因用户手动编辑原文导致的建议失效
  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const next = getSuggestions(editor.state);
      const prev = prevSugsRef.current;
      for (const p of prev) {
        if ((p.status === 'pending' || p.status === 'streaming') && !next.some(n => n.id === p.id)) {
          if (explicitRemovedIdsRef.current.has(p.id)) {
            explicitRemovedIdsRef.current.delete(p.id);
          } else {
            toast.info('修改建议已失效', `原文已被手动修改，建议「${p.instruction}」已自动作废。`);
          }
        }
      }
      prevSugsRef.current = next;
      setSugs(prevList => (sameSuggestions(prevList, next) ? prevList : next));
    };
    editor.on('transaction', sync);
    sync();
    return () => { editor.off('transaction', sync); };
  }, [editor]);

  useEffect(() => () => abortRef.current?.abort(), []);

  /**
   * titlesOverride 是必要的：setTitles 是异步的，紧接着调 pushSnap 会读到上一轮的旧值，
   * 导致刚生成的标题没被存进快照里。
   */
  const pushSnap = useCallback((label: string, titlesOverride?: string): number => {
    if (!editor) return 0;
    const html = editor.getHTML();
    // 生成/接受这类改动走的 setContent(emitUpdate=false)，onUpdate 不会触发，
    // 所以这里必须显式存一次，否则刷新就丢了
    storage.saveDoc(html);
    const v = storage.pushSnapshot({
      label,
      product: brief.name,
      crowd: brief.crowd,
      html,
      text: editor.getText(),
      titles: titlesOverride ?? titles,
      brief: { ...brief }
    });
    const list = storage.loadSnapshots();
    setSnaps(list);
    if (list[0]) {
      setCurrentId(list[0].id);
      setIsDiverged(false);
      if (dirHandleRef.current) {
        autoSaveSnapshotToFile(dirHandleRef.current, list[0]);
      }
    }
    return v;
  }, [editor, brief, titles]);

  const isDirty = useCallback((): boolean => {
    if (!editor) return false;
    const currentText = editor.getText().trim();
    if (!currentText && editor.isEmpty) return false;
    const currentHtml = editor.getHTML();
    const list = storage.loadSnapshots();
    if (!list.length) {
      return !editor.isEmpty && currentText.length > 0;
    }
    if (currentId) {
      const curSnap = list.find(s => s.id === currentId);
      if (curSnap) {
        return curSnap.html !== currentHtml;
      }
    }
    return list[0].html !== currentHtml;
  }, [editor, currentId]);

  const copyFullText = useCallback(() => {
    if (!editor || editor.isEmpty) return;
    const text = editor.getText({ blockSeparator: '\n\n' });
    navigator.clipboard.writeText(text);
    setStatus('已复制全文到剪贴板');
    toast.success('已复制全文到剪贴板');
  }, [editor]);

  const exportCurrentMarkdown = useCallback(() => {
    if (!editor || editor.isEmpty) return;
    const text = editor.getText({ blockSeparator: '\n\n' });
    const safeProduct = (brief.name.trim() || '文案').replace(/[\\/:*?"<>|·•\s]+/g, '_');
    const t = new Date();
    const p2 = (n: number) => String(n).padStart(2, '0');
    const stamp = `${t.getFullYear()}${p2(t.getMonth() + 1)}${p2(t.getDate())}-${p2(t.getHours())}${p2(t.getMinutes())}${p2(t.getSeconds())}`;
    const filename = `${stamp}_${safeProduct}_当前稿.md`;
    const md = [
      '# ' + (brief.name.trim() || '文案'),
      '',
      brief.crowd ? `> 目标人群：${brief.crowd}` : '',
      `> 导出时间：${t.toLocaleString('zh-CN')}`,
      '',
      text,
      titles ? '\n## 配套标题\n\n' + titles : ''
    ].filter(Boolean).join('\n');
    download(filename, md);
  }, [editor, brief.name, brief.crowd, titles]);

  /**
   * 触发 AI 副驾驶（Copilot）在修改或生成后的进一步建议：
   * 1. 0ms 瞬间应用智能启发式建议作为基线；
   * 2. 异步请求真实大模型对当前全文进行深度审阅，输出量身定制的诊断与动态动作胶囊。
   */
  const triggerAdvice = useCallback(async (lastAction: string, snippet?: string) => {
    if (!editor) return;

    // 1. 立即计算启发式建议，保证 0ms 瞬间反馈
    const heuristic = getHeuristicPostEditAdvice(lastAction, snippet);
    setAdvice({
      lastAction,
      summary: heuristic.summary,
      actions: heuristic.actions,
      timestamp: Date.now(),
      isAnalyzing: true
    });

    // 2. 取消可能正在运行的上一次诊断请求
    if (adviceAbortRef.current) {
      adviceAbortRef.current.abort();
    }
    const ctrl = new AbortController();
    adviceAbortRef.current = ctrl;

    setIsAdvising(true);
    try {
      const curCfg = settings.providers[settings.provider];
      const fullText = editor.getText();
      if (!fullText.trim()) {
        setAdvice(prev => prev ? { ...prev, isAnalyzing: false } : null);
        return;
      }

      const { system, user } = buildPostEditAdvicePrompt(
        brief,
        fullText,
        lastAction,
        snippet
      );

      const deepAdvice = await requestPostEditAdvice(system, user, {
        temperature: 0.7,
        thinkingMode: '即兴',
        provider: settings.provider,
        base: curCfg?.base,
        model: curCfg?.model,
        apiKey: curCfg?.apiKey,
        signal: ctrl.signal
      });

      if (deepAdvice && deepAdvice.summary && deepAdvice.actions && deepAdvice.actions.length > 0) {
        setAdvice({
          lastAction,
          summary: deepAdvice.summary,
          actions: deepAdvice.actions.map((a, i) => ({
            id: `dyn-${Date.now()}-${i}`,
            label: a.label,
            instruction: a.instruction
          })),
          timestamp: Date.now(),
          isAnalyzing: false
        });
      } else {
        setAdvice(prev => prev ? { ...prev, isAnalyzing: false } : null);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.warn('获取 AI 副驾深度审阅失败，沿用启发式建议:', e);
      }
      setAdvice(prev => prev ? { ...prev, isAnalyzing: false } : null);
    } finally {
      setIsAdvising(false);
      adviceAbortRef.current = null;
    }
  }, [editor, brief, settings]);

  async function generate() {
    if (!editor || busy) return;
    if (!brief.name.trim() || !brief.crowd.trim()) {
      setStatus('至少填「产品名称」和「目标人群」');
      return;
    }

    // P2-1: 若当前存在待确认的修改建议，提示确认
    if (sugs.length > 0) {
      const proceed = await confirmDialog({
        title: '确认重新生成',
        body: `当前有 ${sugs.length} 条待确认的修改建议，重新生成将清除这些建议。是否继续？`,
        confirmText: '继续生成',
        danger: true
      });
      if (!proceed) return;
    }

    // 覆盖前自动备份护栏 (TASK-001)
    if (isDirty()) {
      const v = pushSnap('覆盖前自动备份');
      if (v === 0) {
        const proceed = await confirmDialog({
          title: '备份失败',
          body: '本地存储备份失败，继续生成将覆盖当前编辑器内容且无法找回。仍要覆盖吗？',
          danger: true
        });
        if (!proceed) return;
      }
    }

    storage.saveBrief(brief);
    setBusy(true);
    setBusyKind('generate');
    setStreamCharCount(0);
    setStatus('生成中…');
    setTitles('');
    storage.saveTitles('');
    // 必须在 setContent 之前判断，否则写完之后 isEmpty 恒为 false，首版会被误标成"重新生成"
    const hadBefore = !editor.isEmpty;
    dispatchSuggestion(editor, { type: 'clear' });

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const selectedFramework = getFramework(brief.frameworkId, brief.customSections);
    const { system, user } = buildMainPrompt(brief, selectedFramework);
    let lastRender = 0;

    try {
      const curCfg = settings.providers[settings.provider];
      const raw = await streamChat(system, user, {
        temperature: brief.temperature,
        thinkingMode: brief.thinkingMode,
        provider: settings.provider,
        base: curCfg?.base,
        model: curCfg?.model,
        apiKey: curCfg?.apiKey,
        signal: ctrl.signal
      }, partial => {
        const count = partial.replace(/\s+/g, '').length;
        setStreamCharCount(count);
        setStatus(`正在生成（已输出 ${count} 字）`);
        const now = Date.now();
        if (now - lastRender < 120) return;
        lastRender = now;
        // 流式中间帧不进入 Undo 历史栈，避免生成后撤销需回退几十次中间状态 (P1-1)
        editor
          .chain()
          .setContent(sectionsToHtml(parseSections(partial)), { emitUpdate: false })
          .command(({ tr }) => {
            tr.setMeta('addToHistory', false);
            return true;
          })
          .run();
      });
      // 最终成稿作为单次完整操作入栈，支持 Ctrl+Z 一次撤销回生成前基线
      editor.commands.setContent(sectionsToHtml(parseSections(raw)), { emitUpdate: false });
      const snapLabel = (hadBefore ? '重新生成·' : '初稿·') + selectedFramework.name;
      const v = pushSnap(snapLabel, '');
      setStatus('完成' + (v ? ' · 已存 v' + v : ''));
      triggerAdvice(snapLabel);
    } catch (e) {
      const err = e as Error;
      if (err.name === 'AbortError') {
        setStatus('已停止');
      } else {
        const summary = err.message.length > 25 ? err.message.slice(0, 25) + '…' : err.message;
        setStatus('失败：' + summary);
        toast.error('生成文案失败', err.message);
      }
    } finally {
      setBusy(false);
      setBusyKind(null);
      setStreamCharCount(0);
      abortRef.current = null;
    }
  }

  async function genTitles() {
    if (!editor || busy) return;
    if (!brief.name.trim() || !brief.crowd.trim()) {
      setStatus('至少填「产品名称」和「目标人群」');
      return;
    }
    setBusy(true);
    setBusyKind('titles');
    setStatus('生成标题…');
    try {
      const curCfg = settings.providers[settings.provider];
      const { system, user } = buildTitlePrompt(brief);
      const txt = await streamChat(system, user, {
        temperature: 1.0,
        provider: settings.provider,
        base: curCfg?.base,
        model: curCfg?.model,
        apiKey: curCfg?.apiKey
      }, () => {});
      const trimmedTitles = txt.trim();
      setTitles(trimmedTitles);
      storage.saveTitles(trimmedTitles);
      const v = pushSnap('加标题', trimmedTitles);
      setStatus('标题已生成' + (v ? ' · 已存 v' + v : ''));
    } catch (e) {
      const err = e as Error;
      if (err.name === 'AbortError') {
        setStatus('已停止');
      } else {
        const summary = err.message.length > 25 ? err.message.slice(0, 25) + '…' : err.message;
        setStatus('失败：' + summary);
        toast.error('生成标题失败', err.message);
      }
    } finally {
      setBusy(false);
      setBusyKind(null);
    }
  }

  async function rewrite(from: number, to: number, text: string, instruction: string) {
    if (!editor || busy) return;

    // P2-1: 检测选区坐标是否与现有待确认的建议重叠
    const liveSuggestions = getSuggestions(editor.state).filter(
      it => it.status === 'streaming' || it.status === 'pending'
    );
    const overlapping = liveSuggestions.filter(it => from < it.to && to > it.from);
    if (overlapping.length > 0) {
      toast.warn(
        '选区与现有建议重叠',
        `请先在右侧面板接受或拒绝重叠的建议「${overlapping[0].instruction}」，再发起新的改写。`
      );
      return;
    }

    setBusy(true);
    setBusyKind('rewrite');
    setStatus('改写中…');
    setTab('sg');

    const id = 'g' + Date.now() + Math.random().toString(36).slice(2, 6);
    dispatchSuggestion(editor, {
      type: 'add',
      item: { id, from, to, instruction, original: text, replacement: '', status: 'streaming', ts: Date.now() }
    });

    const { system, user } = buildRewritePrompt(brief, editor.getText(), text, instruction);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const curCfg = settings.providers[settings.provider];
      const full = await streamChat(system, user, {
        temperature: brief.temperature,
        thinkingMode: brief.thinkingMode,
        provider: settings.provider,
        base: curCfg?.base,
        model: curCfg?.model,
        apiKey: curCfg?.apiKey,
        signal: ctrl.signal
      }, partial => {
        dispatchSuggestion(editor, { type: 'update', id, patch: { replacement: partial.trim() } });
      });
      // 清理两端可能包裹的多余引号或反引号标记，保持文案自然嵌入
      const cleaned = full.trim().replace(/^["“'‘]|["”'’]$/g, '').trim();
      dispatchSuggestion(editor, { type: 'update', id, patch: { replacement: cleaned, status: 'pending' } });
      setStatus('待你确认');
    } catch (e) {
      dispatchSuggestion(editor, { type: 'remove', id });
      const err = e as Error;
      if (err.name === 'AbortError') {
        setStatus('已停止');
      } else {
        const summary = err.message.length > 25 ? err.message.slice(0, 25) + '…' : err.message;
        setStatus('改写失败：' + summary);
        toast.error('划词改写失败', err.message);
      }
    } finally {
      setBusy(false);
      setBusyKind(null);
      abortRef.current = null;
    }
  }

  function accept(item: Suggestion) {
    if (!editor) return;
    const cur = getSuggestions(editor.state).find(x => x.id === item.id);
    if (!cur) return;
    explicitRemovedIdsRef.current.add(cur.id);
    const content = formatReplacement(editor, cur.from, cur.to, cur.replacement);
    editor.chain().focus().insertContentAt({ from: cur.from, to: cur.to }, content).run();
    dispatchSuggestion(editor, { type: 'remove', id: cur.id });
    pushSnap('接受改写 · ' + cur.instruction);
    setStatus('已接受');
    triggerAdvice('接受改写 · ' + cur.instruction, cur.replacement);
  }

  function reject(item: Suggestion) {
    if (!editor) return;
    explicitRemovedIdsRef.current.add(item.id);
    dispatchSuggestion(editor, { type: 'remove', id: item.id });
    setStatus('已拒绝');
  }

  function acceptAll() {
    if (!editor) return;
    const list = getSuggestions(editor.state).filter(i => i.status === 'pending').sort((a, b) => b.from - a.from);
    if (!list.length) return;
    list.forEach(it => explicitRemovedIdsRef.current.add(it.id));
    let chain = editor.chain().focus();
    // 从后往前改，前面的坐标才不会被顶偏
    for (const it of list) {
      const content = formatReplacement(editor, it.from, it.to, it.replacement);
      chain = chain.insertContentAt({ from: it.from, to: it.to }, content);
    }
    chain.run();
    list.forEach(it => dispatchSuggestion(editor, { type: 'remove', id: it.id }));
    pushSnap('接受全部改写');
    setStatus('已接受 ' + list.length + ' 条');
    triggerAdvice('批量接受修改');
  }

  function rejectAll() {
    if (!editor) return;
    getSuggestions(editor.state).forEach(it => explicitRemovedIdsRef.current.add(it.id));
    dispatchSuggestion(editor, { type: 'clear' });
    setStatus('已全部拒绝');
  }

  // P2-2: 定位建议卡片时不弹出划词改写工具条
  function focusSuggestion(item: Suggestion) {
    if (!editor) return;
    const cur = getSuggestions(editor.state).find(x => x.id === item.id);
    if (!cur) return;
    const el = document.querySelector(`[data-sg="${item.id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 折叠光标至建议末尾，保持光标且不触发选区改写浮层
      editor.chain().focus().setTextSelection(cur.to).run();
    } else {
      editor.chain().focus().setTextSelection(cur.to).scrollIntoView().run();
    }
  }

  async function loadSnapshot(s: Snapshot) {
    if (!editor) return;
    // 覆盖前自动备份护栏 (TASK-001)
    if (isDirty()) {
      const v = pushSnap('覆盖前自动备份');
      if (v === 0) {
        const proceed = await confirmDialog({
          title: '备份失败',
          body: '本地存储备份失败，继续载入将覆盖当前编辑器内容且无法找回。仍要覆盖吗？',
          danger: true
        });
        if (!proceed) return;
      }
    }
    dispatchSuggestion(editor, { type: 'clear' });
    editor.commands.setContent(s.html, { emitUpdate: false });
    storage.saveDoc(s.html);
    setTitles(s.titles);
    storage.saveTitles(s.titles);
    setCurrentId(s.id);
    setIsDiverged(false);

    // P2-4: 全量回滚 brief 字段（老版本快照安全降级回写 name/crowd）
    if (s.brief) {
      setBrief(s.brief);
      storage.saveBrief(s.brief);
    } else if (s.product || s.crowd) {
      setBrief(b => {
        const next = {
          ...b,
          name: s.product || b.name,
          crowd: s.crowd || b.crowd
        };
        storage.saveBrief(next);
        return next;
      });
    }
    setStatus('已载入该版');
  }

  function exportAllSnaps(customSnaps?: Snapshot[]) {
    const target = customSnaps || snaps;
    if (!target.length) return;
    const body = target
      .slice()
      .reverse()
      .map((s, i) => `## v${s.seq ?? (i + 1)} · ${s.label} · ${new Date(s.ts).toLocaleString('zh-CN')}\n\n${s.text}` +
        (s.titles ? '\n\n配套标题：\n' + s.titles : ''))
      .join('\n\n---\n\n');
    const safeProduct = (target[0].product || '文案').replace(/[\\/:*?"<>|·•\s]+/g, '_');
    const md = `# 快照合集 · ${target[0].product || '文案'}\n共 ${target.length} 版（从最早到最新）\n\n${body}`;
    download(safeProduct + '_快照合集.md', md);
  }

  async function handleBindDir() {
    if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
      toast.warn(
        '当前浏览器环境不支持直接写入文件夹',
        '推荐使用 Edge 或 Chrome 浏览器。快照依然会自动保存在本地浏览器存储中，可用「导出全部」一键备份。'
      );
      return;
    }
    try {
      const handle = await (window as any).showDirectoryPicker();
      setDirHandle(handle);
      setDirName(handle.name);
      localStorage.setItem('cw.dirBound', handle.name);
      setStatus('已绑定文件夹：' + handle.name);
      toast.success('已绑定文件夹：' + handle.name);
      // 首次绑定时，同步把最近 5 个版本写入该文件夹
      const recent = storage.loadSnapshots().slice(0, 5);
      for (const s of recent) {
        await autoSaveSnapshotToFile(handle, s);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        toast.error('绑定文件夹失败', e?.message || String(e));
      }
    }
  }

  function handleUnbindDir() {
    setDirHandle(null);
    setDirName('');
    localStorage.removeItem('cw.dirBound');
    setStatus('已解除文件夹绑定');
    toast.info('已解除文件夹绑定');
  }

  const scrollToSection = (sec: 'left' | 'mid' | 'right') => {
    setNarrowTab(sec);
    const selector = sec === 'left' ? '.col-left' : sec === 'mid' ? '.col-mid' : '.col-right';
    const target = document.querySelector(selector);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-t">一键文案撰写<small>选中改写 · 接受/拒绝 · 版本可回溯</small></span>
        </div>
        <span className={'pill' + (busy ? ' busy' : '')} title={status || '系统就绪'}>
          {status || '就绪'}
        </span>
        <ThemeToggle
          mode={themeMode}
          resolvedTheme={resolvedTheme}
          onChange={handleThemeChange}
        />
        <ApiSettings
          provider={settings.provider}
          onProviderChange={(p, nextConfig) => {
            setSettings(prev => {
              const stored = prev.providers[p] || DEFAULT_PROVIDER_CONFIGS[p] || { base: '', model: '' };
              const cfg = { ...stored, ...(nextConfig || {}) };
              const next = {
                ...prev,
                provider: p,
                providers: {
                  ...prev.providers,
                  [p]: cfg
                }
              };
              storage.saveSettings(next);
              return next;
            });
          }}
          config={settings.providers[settings.provider] || DEFAULT_PROVIDER_CONFIGS[settings.provider] || { base: '', model: '' }}
          onConfigChange={cfg => {
            setSettings(prev => {
              const next = {
                ...prev,
                providers: {
                  ...prev.providers,
                  [prev.provider]: cfg
                }
              };
              storage.saveSettings(next);
              return next;
            });
          }}
        />
        {busy && <button className="sm danger" onClick={() => abortRef.current?.abort()}>停止</button>}
      </header>

      <main className={`app-main ${zenMode ? 'zen-active' : ''}`}>
        {/* P2-7: 窄屏/移动端吸顶分段导航 */}
        <nav className="narrow-nav" aria-label="移动端与窄屏栏目导航">
          <button
            type="button"
            className={narrowTab === 'left' ? 'active' : ''}
            onClick={() => scrollToSection('left')}
          >
            📝 表单设置
          </button>
          <button
            type="button"
            className={narrowTab === 'mid' ? 'active' : ''}
            onClick={() => scrollToSection('mid')}
          >
            📄 正文编辑
          </button>
          <button
            type="button"
            className={narrowTab === 'right' ? 'active' : ''}
            onClick={() => scrollToSection('right')}
          >
            📋 建议与历史{sugs.length ? ` (${sugs.length})` : ''}
          </button>
        </nav>

        <aside className={`col-left ${zenMode ? 'zen-hidden' : ''}`}>
          <GeneratePanel
            brief={brief}
            busy={busy}
            busyKind={busyKind}
            streamCharCount={streamCharCount}
            onStop={() => abortRef.current?.abort()}
            onChange={patch => setBrief(b => ({ ...b, ...patch }))}
            onGenerate={generate}
            onTitles={genTitles}
            onSaveVersion={() => {
              if (!editor || editor.isEmpty) {
                setStatus('编辑器尚无内容，无需存版');
                return;
              }
              const v = pushSnap('手动存版');
              setStatus(v ? '已存 v' + v : '存储失败');
            }}
          />
        </aside>

        <section className={`col-mid ${zenMode ? 'zen-full' : ''}`}>
          {titles && (
            <div className="titles-strip">
              <b>配套标题</b>
              <div className="ts-items">
                {titles
                  .split('\n')
                  .map(t => t.trim().replace(/^[\d+.)、\s-]+/, ''))
                  .filter(Boolean)
                  .map((t, i) => (
                    <button
                      key={i}
                      type="button"
                      className="ts-item"
                      title="点击复制此条标题"
                      onClick={() => {
                        navigator.clipboard.writeText(t);
                        toast.success('已复制标题', t);
                      }}
                    >
                      {t}
                    </button>
                  ))}
              </div>
              <button
                type="button"
                className="sm ghost"
                title="复制全部标题（去编号）"
                onClick={() => {
                  const cleaned = titles
                    .split('\n')
                    .map(t => t.trim().replace(/^[\d+.)、\s-]+/, ''))
                    .filter(Boolean)
                    .join('\n');
                  navigator.clipboard.writeText(cleaned);
                  setCopiedTitle(true);
                  setStatus('全部标题已复制');
                  setTimeout(() => setCopiedTitle(false), 2000);
                }}
              >
                {copiedTitle ? '已复制 ✓' : '复制全部'}
              </button>
              <button
                type="button"
                className="ts-close"
                title="关闭标题栏"
                onClick={() => {
                  setTitles('');
                  storage.saveTitles('');
                }}
              >
                ✕
              </button>
            </div>
          )}
          <EditorPane
            editor={editor}
            busy={busy}
            advice={advice}
            isAdvising={isAdvising}
            onRequestAdvice={() => triggerAdvice('全文重新审阅')}
            onRewrite={rewrite}
            onCopyFullText={copyFullText}
            onExportMarkdown={exportCurrentMarkdown}
            zenMode={zenMode}
            onToggleZenMode={() => setZenMode(z => !z)}
            placeholder={<>左边填产品名和目标人群，点「生成文案」。<br />生成后选中任意一段，可让它单独改写。</>}
          />
        </section>

        <aside className={`col-right ${zenMode ? 'zen-hidden' : ''}`}>
          <div className="tabs">
            <button className={tab === 'sg' ? 'on' : ''} onClick={() => setTab('sg')}>
              修改建议{sugs.length ? ` (${sugs.length})` : ''}
            </button>
            <button className={tab === 'hs' ? 'on' : ''} onClick={() => setTab('hs')}>
              历史 ({snaps.length})
            </button>
          </div>
          <div className="tab-body">
            {tab === 'sg' ? (
              <SuggestionPanel
                items={sugs}
                onAccept={accept}
                onReject={reject}
                onAcceptAll={acceptAll}
                onRejectAll={rejectAll}
                onFocus={focusSuggestion}
              />
            ) : (
              <HistoryPanel
                items={snaps}
                currentProduct={brief.name}
                currentId={currentId}
                isDiverged={isDiverged}
                dirName={dirName || null}
                isDirAuthorized={!!dirHandle}
                onBindDir={handleBindDir}
                onUnbindDir={handleUnbindDir}
                onLoad={loadSnapshot}
                onDelete={id => {
                  setSnaps(storage.deleteSnapshot(id));
                  if (currentId === id) setCurrentId(null);
                }}
                onClear={() => { storage.clearSnapshots(); setSnaps([]); setCurrentId(null); }}
                onExportAll={exportAllSnaps}
              />
            )}
          </div>
        </aside>
      </main>

      <ToastContainer />
      <ConfirmDialogContainer />
    </div>
  );
}
