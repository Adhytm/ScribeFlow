/** 一段文案框架的组成单元。颗粒度是这套工具的核心资产，不是套 AIDA 骨架。 */
export interface FrameworkSection {
  key: string;
  name: string;
  goal: string;
  len: string;
  must: string;
  ban: string;
}

export interface Framework {
  id: string;
  name: string;
  tag: string;
  desc: string;
  scenes: string;
  sections: FrameworkSection[];
}

export type ThinkingMode = '即兴' | '构思' | '深思';

export type ThemeMode = 'system' | 'light' | 'dark';

/** 用户填写的素材。填得越细，模型写得越准。 */
export interface Brief {
  frameworkId?: string;
  name: string;
  crowd: string;
  sell: string;
  pain: string;
  scene: string;
  proof: string;
  diff: string;
  view: string;
  tone: string;
  length: number;
  temperature: number;
  thinkingMode?: ThinkingMode;
  ban: string;
  customSections?: FrameworkSection[];
}

export interface Snapshot {
  id: string;
  seq?: number;
  ts: number;
  label: string;
  product: string;
  crowd: string;
  html: string;
  text: string;
  titles: string;
  brief?: Brief;
}

export type SuggestionStatus = 'streaming' | 'pending' | 'accepted' | 'rejected';

/**
 * 一条 AI 修改建议。from/to 是文档坐标，
 * 每次 transaction 都要经过 mapping 重映射，否则插入内容后位置会漂。
 */
export interface Suggestion {
  id: string;
  from: number;
  to: number;
  instruction: string;
  original: string;
  replacement: string;
  status: SuggestionStatus;
  ts: number;
}

export type ProviderType =
  | 'local'
  | 'moonshot'
  | 'dashscope'
  | 'aliyun-token-plan'
  | 'gemini'
  | 'zhipu'
  | 'zhipu-coding'
  | 'deepseek'
  | 'openai'
  | 'anthropic'
  | string;

export interface ProviderInfo {
  hasKey: boolean;
  base: string;
  model: string;
  name: string;
  recommendedModels?: string[];
  recommendedUrls?: { label: string; url: string }[];
}

export interface ServerConfig {
  hasKey: boolean;
  base: string;
  model: string;
  activeProvider?: ProviderType;
  providers?: Record<string, ProviderInfo>;
}

export interface ClientProviderConfig {
  base: string;
  model: string;
  apiKey?: string;
}
