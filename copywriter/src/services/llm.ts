import type { ProviderType, ServerConfig } from '../types/document';

/**
 * 前端与 /api/llm 通信层。
 * 支持传参 provider、base、model 及可选的 apiKey。
 */

export interface ChatOptions {
  provider?: ProviderType;
  base?: string;
  model?: string;
  apiKey?: string;
  temperature?: number;
  thinkingMode?: '即兴' | '构思' | '深思';
  longThinking?: boolean;
  signal?: AbortSignal;
}

export interface TestConnectionParams {
  provider: ProviderType;
  base?: string;
  model?: string;
  apiKey?: string;
}

export interface TestConnectionResult {
  ok: boolean;
  latencyMs?: number;
  message?: string;
  error?: string;
}

async function post(body: Record<string, unknown>, signal?: AbortSignal) {
  const res = await fetch('/api/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  });
  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try {
      const j = await res.json();
      msg = j.error || msg;
      if (j.detail) msg += '\n' + j.detail;
    } catch {
      /* 非 JSON 响应就用状态码兜底 */
    }
    throw new Error(msg);
  }
  return res;
}

export async function fetchServerConfig(): Promise<ServerConfig> {
  const res = await fetch('/api/llm');
  if (!res.ok) return { hasKey: false, base: '', model: '' };
  return res.json();
}

/** 测试指定的接口端点与模型连通性 */
export async function testConnection(params: TestConnectionParams): Promise<TestConnectionResult> {
  try {
    const res = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'test-connection',
        provider: params.provider,
        base: params.base,
        model: params.model,
        apiKey: params.apiKey
      })
    });
    return await res.json();
  } catch (e: any) {
    return { ok: false, error: '请求未送达本地服务端：' + e.message };
  }
}

/** 流式生成，每收到一段就回调一次累计文本 */
export async function streamChat(
  system: string,
  user: string,
  opts: ChatOptions,
  onDelta: (full: string) => void
): Promise<string> {
  const res = await post(
    {
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: opts.temperature,
      model: opts.model,
      base: opts.base,
      apiKey: opts.apiKey,
      provider: opts.provider,
      thinkingMode: opts.thinkingMode,
      longThinking: opts.longThinking ?? (opts.thinkingMode === '深思'),
      stream: true
    },
    opts.signal
  );

  const reader = res.body!.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      let j: any;
      try {
        j = JSON.parse(payload);
      } catch {
        /* 忽略半包或心跳行 */
        continue;
      }
      if (j.error) {
        const msg = typeof j.error === 'string' ? j.error : (j.error.message || '上游流式传输发生错误');
        throw new Error(msg);
      }
      const delta = j.choices?.[0]?.delta?.content;
      if (delta) { full += delta; onDelta(full); }
    }
  }
  return full;
}

/**
 * 健壮的文案分段解析：
 * 兼容带 ### / ## 标题的标准输出，也兼容不带 Markdown 标题的纯文本输出。
 * 绝不会因为缺少换行或格式偏差而把内容吞掉变空白。
 */
export function parseSections(raw: string): { title: string; body: string }[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // 检查是否包含 Markdown 标题标记（如 ### 或 ##）
  const hasHeaders = /#{2,4}\s+/.test(trimmed);

  if (!hasHeaders) {
    // 纯文本输出：不强行切出假标题，直接保留为单段正文
    return [{ title: '', body: trimmed }];
  }

  // 如果开头有前导引言（在第一个 ### 之前的内容），提取为前置正文
  const firstHeaderMatch = trimmed.match(/#{2,4}\s+/);
  const firstHeaderIndex = firstHeaderMatch ? firstHeaderMatch.index! : 0;
  const leadIn = trimmed.slice(0, firstHeaderIndex).trim();

  const sections: { title: string; body: string }[] = [];
  if (leadIn) {
    sections.push({ title: '', body: leadIn });
  }

  const chunks = trimmed.slice(firstHeaderIndex).split(/\n?#{2,4}\s+/).filter(s => s.trim());
  for (const chunk of chunks) {
    const i = chunk.indexOf('\n');
    if (i < 0) {
      // 正在流式输出标题，或者只有标题行：保留标题，正文为空
      sections.push({ title: chunk.trim(), body: '' });
    } else {
      sections.push({
        title: chunk.slice(0, i).trim(),
        body: chunk.slice(i + 1).trim()
      });
    }
  }

  return sections;
}

/** 把分段文本转成编辑器的 HTML */
export function sectionsToHtml(parts: { title: string; body: string }[]): string {
  if (!parts.length) return '';

  const htmlParts: string[] = [];

  for (const p of parts) {
    if (p.title) {
      htmlParts.push(`<h2>${escapeHtml(p.title)}</h2>`);
    }
    if (p.body) {
      const paras = p.body
        .split(/\n+/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => `<p>${escapeHtml(line)}</p>`)
        .join('');
      if (paras) {
        htmlParts.push(paras);
      }
    }
  }

  return htmlParts.join('');
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** 纯文本 → 段落 HTML，用于把 AI 返回的片段放回编辑器 */
export function textToHtml(text: string): string {
  return text
    .split(/\n+/)
    .filter(p => p.trim())
    .map(p => `<p>${escapeHtml(p)}</p>`)
    .join('');
}
