import type { Brief, Snapshot, ProviderType, ClientProviderConfig, ThemeMode, ProductProfile } from '../types/document';

const KEY = {
  snapshots: 'cw.snapshots',
  snapSeq: 'cw.snapSeq',
  doc: 'cw.doc',
  brief: 'cw.brief',
  settings: 'cw.settings',
  theme: 'cw.theme',
  titles: 'cw.titles',
  products: 'cw.products'
};

export const DEFAULT_PRODUCT_PROFILES: ProductProfile[] = [
  {
    id: 'prod-ice-pants',
    name: '轻奢垂坠冰丝阔腿裤',
    category: '服饰穿搭',
    crowd: '22-38 岁职场女性，夏日通勤怕热、久坐怕裤子贴腿显假胯宽',
    sell: '接触凉感天丝混纺，上身立减3℃\n高腰立体A字微阔版型，视觉拉长腿部线条8cm\n免熨抗皱垂坠悬垂性，机洗50次不起球不缩水',
    pain: '普通裤子夏季闷汗粘大腿，坐下后膝盖和臀部鼓包\n假胯宽、梨形身材穿修身裤暴露腿型缺陷\n洗两次就发硬起皱，每次出门都要费时熨烫',
    scene: '盛夏38℃户外通勤挤车、办公室久坐办公、周末约会拍照出游',
    proof: '符合国家婴幼儿A类亲肤标准认证\n第三方权威实验室50次机洗耐磨抗起球实测\n专业防晒UPF50+紫外线阻隔报告',
    diff: '普通冰丝透光易走光，本款采用三层密织防透工艺；腰部隐形弹力设计，吃饱不勒腹',
    createdAt: 1730000000000
  },
  {
    id: 'prod-coffee-maker',
    name: '15秒极速鲜萃便携胶囊咖啡机',
    category: '3C数码',
    crowd: '一线城市上班族、考研备考学生、出差商务人士，对咖啡品质有要求但没时间手冲',
    sell: '20Bar高压黄金萃取，油脂醇厚媲美专业咖啡馆\n仅重380g保温杯大小，车载/差旅随手塞进双肩包\n冷热水通用+一键自清洗，15秒完成一杯美式',
    pain: '便利店咖啡口感水味重且单杯动辄15-20元\n传统半自动咖啡机体积笨重、清洗复杂难打理\n早八打卡赶时间，根本腾不出10分钟慢吞吞手冲',
    scene: '早晨工位醒脑第一杯、高铁飞机差旅途中、露营野餐现萃新鲜咖啡',
    proof: '德国红点工业设计大奖获奖设计\n食品级Tritan母婴材质认证+国家3C安全认证\n10000次压力泵循环耐用寿命测试',
    diff: '市面便携咖啡机多数压力仅12Bar且需专用底座，本款支持Type-C手机充电器通用闪充',
    createdAt: 1730000001000
  },
  {
    id: 'prod-barrier-cream',
    name: '3重神经酰胺屏障修护水光霜',
    category: '美妆个护',
    crowd: '混油敏肌、频繁刷酸/医美后受损屏障人群，一换季就泛红干痒卡粉',
    sell: '独家仿生皮脂配方，3重高纯度神经酰胺精准渗透角质层\n微分子玻尿酸深层补水，清爽冰沙凝霜质地一秒化水不粘腻\n72小时长效锁水保湿，上妆底妆服帖不搓泥',
    pain: '换季冷热交替时脸颊刺痛泛红，连涂爽肤水都觉得辣\n面霜质地过于厚重容易闷痘闭口，质地太轻薄又不够保湿\n底妆卡粉斑驳浮粉，起皮脱妆极其尴尬',
    scene: '晚间熬夜修护厚敷、晨间妆前打底维稳、刷酸/清洁面膜后褪红修护',
    proof: '通过三甲医院皮肤科人体斑贴安全性测试\nSGS权威实验室28天测试：泛红度下降38.6%，经皮水分流失降低42%\n承诺0酒精、0人工香精、0重金属、0矿物油添加',
    diff: '突破传统修护霜的油润厚重感，采用冰沙促渗科技，油皮夏天用也毫无负担',
    createdAt: 1730000002000
  }
];

export const DEFAULT_PROVIDER_CONFIGS: Record<string, ClientProviderConfig> = {
  local: {
    base: 'http://127.0.0.1:11434/v1',
    model: 'qwen3.8-27b',
    apiKey: ''
  },
  moonshot: {
    base: 'https://api.moonshot.ai/v1/chat/completions',
    model: 'kimi-k3',
    apiKey: ''
  },
  dashscope: {
    base: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3.8-max',
    apiKey: ''
  },
  'aliyun-token-plan': {
    base: 'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3.8-max',
    apiKey: ''
  },
  gemini: {
    base: 'https://generativelanguage.googleapis.com',
    model: 'gemini-3.8-flash',
    apiKey: ''
  },
  zhipu: {
    base: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-5.3',
    apiKey: ''
  },
  'zhipu-coding': {
    base: 'https://open.bigmodel.cn/api/coding/paas/v4',
    model: 'glm-5.3',
    apiKey: ''
  },
  deepseek: {
    base: 'https://api.deepseek.com',
    model: 'deepseek-flash',
    apiKey: ''
  },
  openai: {
    base: 'https://api.openai.com/v1',
    model: 'gpt-6.1-sol',
    apiKey: ''
  },
  anthropic: {
    base: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-5-5',
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

    // 存储空间已满防护 (P0-1)：严禁在未经用户许可的情况下静默截断抹除老旧快照！
    // 派发存储已满告警事件，阻断写入并保持现有已存快照完整不被破坏，引导用户先导出备份。
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cw:storage-degraded', { detail: { count: list.length - 1, failed: true } }));
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
  },

  loadProducts(): ProductProfile[] {
    const list = read<ProductProfile[]>(KEY.products, []);
    if (!list || list.length === 0) {
      write(KEY.products, DEFAULT_PRODUCT_PROFILES);
      return [...DEFAULT_PRODUCT_PROFILES];
    }
    return list;
  },
  saveProducts(list: ProductProfile[]): void {
    write(KEY.products, list);
  },
  saveProduct(p: ProductProfile): ProductProfile[] {
    const current = this.loadProducts();
    const idx = current.findIndex(it => it.id === p.id);
    let next: ProductProfile[];
    if (idx >= 0) {
      next = [...current];
      next[idx] = p;
    } else {
      next = [p, ...current];
    }
    this.saveProducts(next);
    return next;
  },
  deleteProduct(id: string): ProductProfile[] {
    const current = this.loadProducts();
    const next = current.filter(it => it.id !== id);
    this.saveProducts(next);
    return next;
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
