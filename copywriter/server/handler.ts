import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * LLM 多渠道安全转发与测试代理层。
 *
 * 核心特性：
 * 1. 自动适配 Anthropic Messages API (含 anthropic-version: 2023-06-01)、
 *    OpenAI Responses API、Google Gemini (Interactions / OpenAI 兼容)、
 *    以及 Moonshot (Kimi)、阿里云 DashScope / Token Plan、智谱 GLM / Coding Plan、DeepSeek、OpenAI 等标准兼容接口。
 * 2. 本地大模型（Ollama / LM Studio）免密直连。
 * 3. 前端可自由输入任何 URL 与模型型号，也可选填临时 Key 或安全使用服务端 Key。
 * 4. 内置精准探针（test-connection），毫秒级检验网络与模型可达性。
 */

export interface LlmEnv {
  DEFAULT_PROVIDER?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  ANTHROPIC_BASE_URL?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  RESPONSES_BASE_URL?: string;
  RESPONSES_MODEL?: string;
  LOCAL_BASE_URL?: string;
  LOCAL_MODEL?: string;
  [key: string]: string | undefined;
}

interface ChatRequest {
  action?: 'test-connection';
  messages?: { role: string; content: string }[];
  temperature?: number;
  stream?: boolean;
  model?: string;
  base?: string;
  provider?: string;
  apiKey?: string;
  thinkingMode?: '即兴' | '构思' | '深思';
  longThinking?: boolean;
  testOnly?: boolean;
}

function readBody(req: IncomingMessage): Promise<ChatRequest> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => {
      raw += c;
      if (raw.length > 2_000_000) reject(new Error('请求体过大'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch { reject(new Error('请求体不是合法 JSON')); }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, code: number, obj: unknown) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(obj));
}

/**
 * 服务端 .env 里的 Key 只允许随请求发给对应官方域名。
 * 前端可自由输入任意 URL，若不加这道白名单，任何能访问本机服务的人都能让
 * 服务端把 OPENAI_API_KEY 等凭证转发到自己控制的地址（SSRF 凭证外泄）。
 * 用户自己填的 bodyKey 不受限——那是他自己的 Key，发给谁他说了算。
 * 自建中转网关（one-api 等）想用服务端 Key 的，请在前端填入网关自己的 Key。
 */
const OFFICIAL_HOSTS: Record<string, string[]> = {
  anthropic: ['api.anthropic.com'],
  moonshot: ['api.moonshot.ai', 'api.moonshot.cn'],
  aliyun: ['dashscope.aliyuncs.com', 'maas.aliyuncs.com'],
  gemini: ['generativelanguage.googleapis.com'],
  zhipu: ['open.bigmodel.cn'],
  deepseek: ['api.deepseek.com'],
  openai: ['api.openai.com']
};

function isOfficialHost(family: string, base: string): boolean {
  if (!base || !base.trim()) return true; // 空 base = 用服务端默认端点，安全
  let host = '';
  try { host = new URL(base).hostname.toLowerCase(); } catch { return false; }
  return (OFFICIAL_HOSTS[family] || []).some(h => host === h || host.endsWith('.' + h));
}

function resolveApiKey(provider: string, base: string, bodyKey?: string, env: LlmEnv = {}): string | undefined {
  if (bodyKey && bodyKey.trim()) return bodyKey.trim();
  const lowerBase = (base || '').toLowerCase();
  if (lowerBase.includes('anthropic') || provider === 'anthropic') {
    if (!isOfficialHost('anthropic', base)) return undefined;
    return env.ANTHROPIC_API_KEY;
  }
  if (lowerBase.includes('moonshot') || provider === 'moonshot') {
    if (!isOfficialHost('moonshot', base)) return undefined;
    return env.MOONSHOT_API_KEY;
  }
  if (lowerBase.includes('dashscope') || lowerBase.includes('maas.aliyuncs.com') || provider === 'dashscope' || provider === 'aliyun-token-plan') {
    if (!isOfficialHost('aliyun', base)) return undefined;
    return env.TOKEN_PLAN_API_KEY || env.DASHSCOPE_API_KEY || env.ALIYUN_API_KEY;
  }
  if (lowerBase.includes('googleapis.com') || provider === 'gemini') {
    if (!isOfficialHost('gemini', base)) return undefined;
    return env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
  }
  if (lowerBase.includes('bigmodel.cn') || provider === 'zhipu' || provider === 'zhipu-coding') {
    if (!isOfficialHost('zhipu', base)) return undefined;
    return env.ZHIPU_API_KEY;
  }
  if (lowerBase.includes('deepseek') || provider === 'deepseek') {
    if (!isOfficialHost('deepseek', base)) return undefined;
    return env.DEEPSEEK_API_KEY;
  }
  // 未识别渠道（含 local）：服务端 Key 只发给 OpenAI 官方域名
  if (!isOfficialHost('openai', base)) return undefined;
  return env.OPENAI_API_KEY;
}

function resolveProtocol(body: ChatRequest): 'anthropic' | 'gemini-interactions' | 'openai-responses' | 'local' | 'openai' {
  const base = (body.base || '').toLowerCase();
  const model = (body.model || '').toLowerCase();
  const provider = body.provider || '';

  if (base.includes('anthropic') || base.endsWith('/messages') || model.startsWith('claude') || provider === 'anthropic') {
    return 'anthropic';
  }
  if (base.endsWith('/interactions')) {
    return 'gemini-interactions';
  }
  if (base.endsWith('/responses') || provider === 'openai-responses') {
    return 'openai-responses';
  }
  if (base.includes(':11434') || base.includes(':1234') || base.includes('/local/') || provider === 'local') {
    return 'local';
  }
  return 'openai';
}

function buildAnthropicUrl(base: string): string {
  const clean = (base || 'https://api.anthropic.com').replace(/\/+$/, '');
  if (clean.endsWith('/messages')) return clean;
  if (clean.endsWith('/v1')) return `${clean}/messages`;
  return `${clean}/v1/messages`;
}

function buildOpenAiUrl(base: string): string {
  const clean = (base || 'https://api.openai.com/v1').replace(/\/+$/, '');
  if (clean.endsWith('/chat/completions')) return clean;
  if (clean === 'https://generativelanguage.googleapis.com') {
    return 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  }
  return `${clean}/chat/completions`;
}

function extractAnthropic(line: string): string | null {
  const t = line.trim();
  if (!t.startsWith('data:')) return null;
  const payload = t.slice(5).trim();
  if (!payload || payload === '[DONE]') return null;
  try {
    const j = JSON.parse(payload);
    if (j.type === 'content_block_delta' && j.delta?.text) {
      return j.delta.text;
    }
  } catch {}
  return null;
}

function extractOpenAiResponses(line: string): string | null {
  const t = line.trim();
  if (!t.startsWith('data:')) return null;
  const payload = t.slice(5).trim();
  if (!payload || payload === '[DONE]') return null;
  try {
    const j = JSON.parse(payload);
    if (j.type === 'response.output_text.delta' && typeof j.delta === 'string') {
      return j.delta;
    }
    if (typeof j.delta?.content === 'string') {
      return j.delta.content;
    }
  } catch {}
  return null;
}

function extractOpenAiChat(line: string): string | null {
  const t = line.trim();
  if (!t.startsWith('data:')) return null;
  const payload = t.slice(5).trim();
  if (!payload || payload === '[DONE]') return null;
  try {
    const j = JSON.parse(payload);
    const content = j.choices?.[0]?.delta?.content;
    if (typeof content === 'string') return content;
  } catch {}
  return null;
}

function extractGeminiInteractions(line: string): string | null {
  const t = line.trim();
  if (!t.startsWith('data:')) return null;
  const payload = t.slice(5).trim();
  if (!payload || payload === '[DONE]') return null;
  try {
    const j = JSON.parse(payload);
    // 标准 Gemini Interactions 事件格式: { type: "step.delta", delta: { type: "text", text: "..." } }
    if (j.type === 'step.delta' && j.delta) {
      if (j.delta.type === 'text' && typeof j.delta.text === 'string') {
        return j.delta.text;
      }
    }
    if (typeof j.delta?.text === 'string') {
      return j.delta.text;
    }
    if (typeof j.delta?.content === 'string') {
      return j.delta.content;
    }
  } catch {}
  return null;
}

async function streamAndNormalize(
  upstream: Response,
  res: ServerResponse,
  extractor: (line: string) => string | null,
  abortController?: AbortController,
  customIdleTimeoutMs?: number
) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';

  // 空闲超时：防止上游流式传输建立后长时间无新输出卡死（默认 45 秒，深思模式放宽）
  const IDLE_TIMEOUT_MS = customIdleTimeoutMs || 45_000;
  let idleTimer: NodeJS.Timeout | undefined;

  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      abortController?.abort(new Error('上游流式传输空闲超时'));
      try {
        reader.cancel().catch(() => {});
        if (!res.writableEnded) {
          res.write('data: ' + JSON.stringify({
            error: {
              message: `上游响应超时中断（超过 ${Math.round(IDLE_TIMEOUT_MS / 1000)} 秒无新内容）`,
              code: 'IDLE_TIMEOUT'
            }
          }) + '\n\n');
          res.write('data: [DONE]\n\n');
        }
      } catch {}
    }, IDLE_TIMEOUT_MS);
  };

  resetIdleTimer();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      resetIdleTimer();
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        const text = extractor(line);
        if (text !== null) {
          res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: text } }] }) + '\n\n');
        }
      }
    }
    if (buf.trim()) {
      const text = extractor(buf);
      if (text !== null) {
        res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: text } }] }) + '\n\n');
      }
    }
    res.write('data: [DONE]\n\n');
  } catch (e) {
    // 客户端主动断开或上游因超时被 abort
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
    try { await reader.cancel().catch(() => {}); } catch {}
    res.end();
  }
}

export async function handleLlm(req: IncomingMessage, res: ServerResponse, env: LlmEnv) {
  if (req.method === 'GET') {
    const activeProvider = env.DEFAULT_PROVIDER || 'local';
    return sendJson(res, 200, {
      activeProvider,
      hasKey: !!env.OPENAI_API_KEY,
      providers: {
        local: { hasKey: true, base: env.LOCAL_BASE_URL || 'http://127.0.0.1:11434/v1', model: env.LOCAL_MODEL || 'qwen3.8-27b', name: '本地大模型' },
        moonshot: { hasKey: !!env.MOONSHOT_API_KEY, base: 'https://api.moonshot.ai/v1/chat/completions', model: 'kimi-k3', name: 'Moonshot (Kimi)' },
        dashscope: { hasKey: !!(env.TOKEN_PLAN_API_KEY || env.DASHSCOPE_API_KEY || env.ALIYUN_API_KEY), base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3.8-max', name: '阿里云 DashScope' },
        'aliyun-token-plan': { hasKey: !!(env.TOKEN_PLAN_API_KEY || env.DASHSCOPE_API_KEY || env.ALIYUN_API_KEY), base: 'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1', model: 'qwen3.8-max', name: '阿里云 Token Plan' },
        gemini: { hasKey: !!(env.GEMINI_API_KEY || env.GOOGLE_API_KEY), base: 'https://generativelanguage.googleapis.com', model: 'gemini-3.8-flash', name: 'Google Gemini' },
        zhipu: { hasKey: !!env.ZHIPU_API_KEY, base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5.3', name: '智谱 AI (GLM)' },
        'zhipu-coding': { hasKey: !!env.ZHIPU_API_KEY, base: 'https://open.bigmodel.cn/api/coding/paas/v4', model: 'glm-5.3', name: '智谱 AI Coding Plan' },
        deepseek: { hasKey: !!env.DEEPSEEK_API_KEY, base: 'https://api.deepseek.com', model: 'deepseek-flash', name: 'DeepSeek 官方' },
        openai: { hasKey: !!env.OPENAI_API_KEY, base: 'https://api.openai.com/v1', model: 'gpt-6.1-sol', name: 'OpenAI 官方' },
        anthropic: { hasKey: !!env.ANTHROPIC_API_KEY, base: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-5-5', name: 'Anthropic Claude' }
      }
    });
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  // 安全防护 (P1-4)：校验 Origin 与 Referer，拦截非本机的跨站代理盗刷
  const reqHeaders = req.headers || {};
  const origin = reqHeaders.origin;
  const referer = reqHeaders.referer;
  if (origin) {
    try {
      const originHost = new URL(origin).hostname;
      const isLoopback = originHost === 'localhost' || originHost === '127.0.0.1' || originHost === '::1' || originHost === '[::1]';
      if (!isLoopback) {
        return sendJson(res, 403, { error: '禁止跨站非法调用本地 AI 代理' });
      }
    } catch {
      return sendJson(res, 403, { error: '无效请求源' });
    }
  } else if (referer) {
    try {
      const refHost = new URL(referer).hostname;
      const isLoopback = refHost === 'localhost' || refHost === '127.0.0.1' || refHost === '::1' || refHost === '[::1]';
      if (!isLoopback) {
        return sendJson(res, 403, { error: '禁止跨站非法调用本地 AI 代理' });
      }
    } catch {
      return sendJson(res, 403, { error: '无效请求来源' });
    }
  }

  const secFetchSite = reqHeaders['sec-fetch-site'];
  if (secFetchSite === 'cross-site') {
    return sendJson(res, 403, { error: '禁止跨站访问' });
  }

  let body: ChatRequest;
  try { body = await readBody(req); }
  catch (e) { return sendJson(res, 400, { error: (e as Error).message }); }

  const protocol = resolveProtocol(body);
  const key = resolveApiKey(body.provider || '', body.base || '', body.apiKey, env);

  // -------------------------------------------------------------
  // 测试连接分支 (action === 'test-connection')
  // -------------------------------------------------------------
  if (body.action === 'test-connection') {
    const startTime = Date.now();

    // 1. 本地大模型探针
    if (protocol === 'local') {
      const base = (body.base || env.LOCAL_BASE_URL || 'http://127.0.0.1:11434/v1').replace(/\/+$/, '');
      const authKey = key || 'local';
      const probeUrl = base.endsWith('/models') ? base : `${base}/models`;

      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3500);
        const resp = await fetch(probeUrl, {
          headers: { Authorization: `Bearer ${authKey}` },
          signal: ctrl.signal
        });
        clearTimeout(timer);
        const latency = Date.now() - startTime;
        if (resp.ok) {
          return sendJson(res, 200, {
            ok: true,
            latencyMs: latency,
            message: `连接成功！已检测到本地模型服务 (耗时 ${latency}ms)`
          });
        }
        // 如果 /models 不通，尝试 1-token /chat/completions
        const chatUrl = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
        const chatResp = await fetch(chatUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authKey}` },
          body: JSON.stringify({
            model: body.model || env.LOCAL_MODEL || 'qwen2.5:7b',
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 1
          }),
          signal: ctrl.signal
        });
        if (chatResp.ok) {
          return sendJson(res, 200, {
            ok: true,
            latencyMs: Date.now() - startTime,
            message: `连接成功！本地模型响应正常 (耗时 ${Date.now() - startTime}ms)`
          });
        }
        return sendJson(res, 200, {
          ok: false,
          error: `本地服务返回 HTTP ${chatResp.status}，请检查模型名称是否在本地已拉取`
        });
      } catch {
        return sendJson(res, 200, {
          ok: false,
          error: `无法连通目标端点 ${base}。请确认本地服务已启动（如终端运行 ollama run/serve，或打开 LM Studio 本地服务）`
        });
      }
    }

    // 2. Anthropic 探针
    if (protocol === 'anthropic') {
      if (!key) {
        return sendJson(res, 200, {
          ok: false,
          error: '未配置 API Key。可在上方输入自定义 Key，或在 copywriter/.env 配置 ANTHROPIC_API_KEY'
        });
      }
      const upstreamUrl = buildAnthropicUrl(body.base || env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1/messages');
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 7000);
        const resp = await fetch(upstreamUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: body.model || env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 1
          }),
          signal: ctrl.signal
        });
        clearTimeout(timer);
        const latency = Date.now() - startTime;
        if (resp.ok) {
          return sendJson(res, 200, {
            ok: true,
            latencyMs: latency,
            message: `Anthropic Claude 验证通过！(耗时 ${latency}ms)`
          });
        }
        const errJson = (await resp.json().catch(() => null)) as any;
        const errMsg = errJson?.error?.message || `HTTP ${resp.status}`;
        return sendJson(res, 200, { ok: false, error: `Anthropic 返回错误: ${errMsg}` });
      } catch (e: any) {
        return sendJson(res, 200, { ok: false, error: `无法访问 Anthropic 端点: ${e.message}` });
      }
    }

    // 3. Google Gemini Interactions API 探针
    if (protocol === 'gemini-interactions') {
      if (!key) {
        return sendJson(res, 200, {
          ok: false,
          error: '未配置 Gemini API Key。可在上方输入自定义 Key，或在 copywriter/.env 配置 GEMINI_API_KEY'
        });
      }
      const upstreamUrl = body.base || 'https://generativelanguage.googleapis.com/v1beta/interactions';
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 7000);
        const resp = await fetch(upstreamUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
            Authorization: `Bearer ${key}`
          },
          body: JSON.stringify({
            model: body.model || 'gemini-2.0-flash',
            input: 'hi',
            stream: false
          }),
          signal: ctrl.signal
        });
        clearTimeout(timer);
        const latency = Date.now() - startTime;
        if (resp.ok) {
          return sendJson(res, 200, {
            ok: true,
            latencyMs: latency,
            message: `Gemini Interactions 接口验证通过！(耗时 ${latency}ms)`
          });
        }
        const errJson = (await resp.json().catch(() => null)) as any;
        const errMsg = errJson?.error?.message || `HTTP ${resp.status}`;
        return sendJson(res, 200, { ok: false, error: `Gemini 返回错误: ${errMsg}` });
      } catch (e: any) {
        return sendJson(res, 200, { ok: false, error: `无法访问 Gemini 端点: ${e.message}` });
      }
    }

    // 4. OpenAI Responses API 探针
    if (protocol === 'openai-responses') {
      if (!key) {
        return sendJson(res, 200, {
          ok: false,
          error: '未配置 API Key。可在上方输入自定义 Key，或在 copywriter/.env 配置 OPENAI_API_KEY'
        });
      }
      const base = (body.base || env.RESPONSES_BASE_URL || env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
      const upstreamUrl = base.endsWith('/responses') ? base : `${base}/responses`;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 7000);
        const resp = await fetch(upstreamUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: body.model || env.RESPONSES_MODEL || 'gpt-4o',
            input: [{ role: 'user', content: 'hi' }],
            max_output_tokens: 1
          }),
          signal: ctrl.signal
        });
        clearTimeout(timer);
        const latency = Date.now() - startTime;
        if (resp.ok) {
          return sendJson(res, 200, {
            ok: true,
            latencyMs: latency,
            message: `OpenAI Responses API 验证通过！(耗时 ${latency}ms)`
          });
        }
        const errJson = (await resp.json().catch(() => null)) as any;
        const errMsg = errJson?.error?.message || `HTTP ${resp.status}`;
        return sendJson(res, 200, { ok: false, error: `Responses 接口返回错误: ${errMsg}` });
      } catch (e: any) {
        return sendJson(res, 200, { ok: false, error: `无法访问 Responses 端点: ${e.message}` });
      }
    }

    // 5. 通用 OpenAI 兼容接口探针 (Moonshot / DashScope / Token Plan / Zhipu / DeepSeek / OpenAI / Gemini OpenAI)
    if (!key) {
      return sendJson(res, 200, {
        ok: false,
        error: '未配置 API Key。可在上方输入自定义 Key，或在 copywriter/.env 配置对应 Key'
      });
    }

    const upstreamUrl = buildOpenAiUrl(body.base || env.OPENAI_BASE_URL || 'https://api.openai.com/v1');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`
    };
    if (upstreamUrl.includes('googleapis.com')) {
      headers['x-goog-api-key'] = key;
    }

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 7000);
      const resp = await fetch(upstreamUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: body.model || env.OPENAI_MODEL || 'gpt-6.1-sol',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1
        }),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      const latency = Date.now() - startTime;
      if (resp.ok) {
        return sendJson(res, 200, {
          ok: true,
          latencyMs: latency,
          message: `接口验证通过！响应正常 (耗时 ${latency}ms)`
        });
      }
      const errJson = (await resp.json().catch(() => null)) as any;
      const errMsg = errJson?.error?.message || `HTTP ${resp.status}`;
      return sendJson(res, 200, { ok: false, error: `接口返回错误: ${errMsg}` });
    } catch (e: any) {
      return sendJson(res, 200, { ok: false, error: `无法访问端点 ${upstreamUrl}: ${e.message}` });
    }
  }

  // -------------------------------------------------------------
  // 正常生成/改写分支
  // -------------------------------------------------------------
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return sendJson(res, 400, { error: 'messages 不能为空' });
  }

  // 客户端断开连接时，立即打断向大模型/上游服务的请求，避免无效扣费和算力占用
  const abortController = new AbortController();
  let clientClosed = false;

  // 注意：不能用 req.on('close') —— Node 里 req 的 close 在「请求体读完」时就触发，
  // 而本函数 await readBody 之后才挂监听，永远收不到（已实锤：客户端硬断 socket 时
  // req close 毫无动静，res close 才可靠触发）。正常结束时 res close 也会触发，
  // 但那时 writableEnded=true，可据此区分，不会误杀。
  res.on('close', () => {
    if (!res.writableEnded) {
      clientClosed = true;
      abortController.abort(new Error('客户端已断开连接'));
    }
  });

  // 上游超时控制：普通模式首包 60s/空闲 45s；深思模式放宽至首包 180s/空闲 90s（支持环境变量配置）
  const isLongThinking = Boolean(body.longThinking || body.thinkingMode === '深思');
  const UPSTREAM_TIMEOUT_MS = Number(env.UPSTREAM_TIMEOUT_MS) || (isLongThinking ? 180_000 : 60_000);
  const IDLE_TIMEOUT_MS = isLongThinking ? 90_000 : 45_000;

  async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    let timer: NodeJS.Timeout | undefined;
    try {
      timer = setTimeout(() => {
        abortController.abort(new Error(`上游请求超时（超过 ${Math.round(UPSTREAM_TIMEOUT_MS / 1000)} 秒无响应）`));
      }, UPSTREAM_TIMEOUT_MS);

      const resp = await fetch(url, {
        ...init,
        signal: abortController.signal
      });
      return resp;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function handleFetchError(e: any, url: string) {
    if (clientClosed) return; // 客户端主动断开，无需发送响应
    const msg = (e as Error).message || String(e);
    const isTimeout = msg.includes('超时') || (e?.name === 'AbortError' && abortController.signal.aborted && !clientClosed);
    const statusCode = isTimeout ? 504 : 502;
    const prefix = isTimeout ? '连不上上游服务（请求超时）：' : '连不上上游服务：';
    return sendJson(res, statusCode, { error: prefix + msg, target: url });
  }

  // 1. Anthropic Claude (/v1/messages)
  if (protocol === 'anthropic') {
    if (!key) {
      return sendJson(res, 500, {
        error: '未配置 Anthropic API Key。可在右上角填入自定义 Key 或在 copywriter/.env 写入 ANTHROPIC_API_KEY=... 后重试。'
      });
    }

    const upstreamUrl = buildAnthropicUrl(body.base || env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1/messages');
    const model = body.model || env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

    const system = body.messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n\n');

    const chatMessages = body.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: m.content
      }));

    if (chatMessages.length === 0 && system) {
      chatMessages.push({ role: 'user', content: '开始' });
    }

    const thinkingBlock = body.thinkingMode === '深思'
      ? { type: 'enabled', budget_tokens: 4096 }
      : (body.thinkingMode === '构思' ? { type: 'enabled', budget_tokens: 2048 } : undefined);

    const maxTokens = thinkingBlock ? (thinkingBlock.budget_tokens + 2048) : 4096;
    const anthropicPayload: Record<string, any> = {
      model,
      system: system || undefined,
      messages: chatMessages,
      max_tokens: maxTokens,
      stream: true
    };
    if (thinkingBlock) {
      anthropicPayload.thinking = thinkingBlock;
      anthropicPayload.temperature = 1.0;
    } else {
      anthropicPayload.temperature = Math.max(0, Math.min(1, body.temperature ?? 0.85));
    }

    let upstream: Response;
    try {
      upstream = await fetchWithTimeout(upstreamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(anthropicPayload)
      });
    } catch (e) {
      return handleFetchError(e, upstreamUrl);
    }

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '');
      return sendJson(res, upstream.status || 502, {
        error: 'Anthropic 上游返回 ' + upstream.status,
        detail: text.slice(0, 500)
      });
    }

    return streamAndNormalize(upstream, res, extractAnthropic, abortController, IDLE_TIMEOUT_MS);
  }

  // 2. Google Gemini Interactions API
  if (protocol === 'gemini-interactions') {
    if (!key) {
      return sendJson(res, 500, {
        error: '未配置 Gemini API Key。可在右上角填入自定义 Key 或在 copywriter/.env 写入 GEMINI_API_KEY=... 后重试。'
      });
    }

    const upstreamUrl = body.base || 'https://generativelanguage.googleapis.com/v1beta/interactions';
    const model = body.model || 'gemini-2.0-flash';

    const system = body.messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n\n');

    const userContent = body.messages
      .filter(m => m.role !== 'system')
      .map(m => m.content)
      .join('\n\n');

    const geminiPayload: Record<string, any> = {
      model,
      input: userContent || '开始',
      stream: true
    };
    if (system) {
      geminiPayload.system_instruction = system;
    }
    if (body.temperature !== undefined) {
      geminiPayload.generation_config = {
        temperature: Math.max(0, Math.min(2, body.temperature))
      };
    }

    let upstream: Response;
    try {
      upstream = await fetchWithTimeout(upstreamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
          Authorization: 'Bearer ' + key
        },
        body: JSON.stringify(geminiPayload)
      });
    } catch (e) {
      return handleFetchError(e, upstreamUrl);
    }

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '');
      return sendJson(res, upstream.status || 502, {
        error: 'Gemini 上游返回 ' + upstream.status,
        detail: text.slice(0, 500)
      });
    }

    return streamAndNormalize(upstream, res, extractGeminiInteractions, abortController, IDLE_TIMEOUT_MS);
  }

  // 3. OpenAI Responses API (/v1/responses)
  if (protocol === 'openai-responses') {
    if (!key) {
      return sendJson(res, 500, {
        error: '未配置 API Key。可在右上角填入自定义 Key 或在 copywriter/.env 写入 OPENAI_API_KEY=... 后重试。'
      });
    }

    const base = (body.base || env.RESPONSES_BASE_URL || env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const upstreamUrl = base.endsWith('/responses') ? base : `${base}/responses`;
    const model = body.model || env.RESPONSES_MODEL || 'gpt-4o';

    let upstream: Response;
    try {
      upstream = await fetchWithTimeout(upstreamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + key
        },
        body: JSON.stringify({
          model,
          input: body.messages,
          temperature: body.temperature ?? 0.85,
          stream: true
        })
      });
    } catch (e) {
      return handleFetchError(e, upstreamUrl);
    }

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '');
      return sendJson(res, upstream.status || 502, {
        error: 'OpenAI Responses 上游返回 ' + upstream.status,
        detail: text.slice(0, 500)
      });
    }

    return streamAndNormalize(upstream, res, extractOpenAiResponses, abortController, IDLE_TIMEOUT_MS);
  }

  // 4. 本地大模型渠道 (Ollama / LM Studio)
  if (protocol === 'local') {
    const base = (body.base || env.LOCAL_BASE_URL || 'http://127.0.0.1:11434/v1').replace(/\/+$/, '');
    const model = body.model || env.LOCAL_MODEL || 'qwen2.5:7b';
    const authKey = key || 'local';

    const upstreamUrl = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;

    let upstream: Response;
    try {
      upstream = await fetchWithTimeout(upstreamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + authKey
        },
        body: JSON.stringify({
          model,
          messages: body.messages,
          temperature: body.temperature ?? 0.85,
          stream: body.stream !== false
        })
      });
    } catch (e) {
      return handleFetchError(e, upstreamUrl);
    }

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => '');
      return sendJson(res, upstream.status || 502, {
        error: '本地模型返回 ' + upstream.status,
        detail: text.slice(0, 500)
      });
    }

    return streamAndNormalize(upstream, res, extractOpenAiChat, abortController, IDLE_TIMEOUT_MS);
  }

  // 5. 通用 OpenAI 兼容接口 (Moonshot / DashScope / Token Plan / Zhipu / DeepSeek / OpenAI / Gemini OpenAI 等)
  if (!key) {
    return sendJson(res, 500, {
      error: '未配置 API Key。可在右上角填入自定义 Key，或在 copywriter/.env 写入对应 Key 后重试。'
    });
  }

  const upstreamUrl = buildOpenAiUrl(body.base || env.OPENAI_BASE_URL || 'https://api.openai.com/v1');
  const model = body.model || env.OPENAI_MODEL || 'gpt-4o';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + key
  };
  if (upstreamUrl.includes('googleapis.com')) {
    headers['x-goog-api-key'] = key;
  }

  let upstream: Response;
  try {
    const openAiPayload: Record<string, any> = {
      model,
      messages: body.messages,
      temperature: body.temperature ?? 0.85,
      stream: body.stream !== false
    };
    if (body.thinkingMode && (model.includes('o1') || model.includes('o3') || model.includes('gpt-6'))) {
      openAiPayload.reasoning_effort = body.thinkingMode === '即兴' ? 'low' : (body.thinkingMode === '深思' ? 'high' : 'medium');
    }

    upstream = await fetchWithTimeout(upstreamUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(openAiPayload)
    });
  } catch (e) {
    return handleFetchError(e, upstreamUrl);
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    return sendJson(res, upstream.status || 502, {
      error: '上游返回 ' + upstream.status,
      detail: text.slice(0, 500)
    });
  }

  return streamAndNormalize(upstream, res, extractOpenAiChat, abortController, IDLE_TIMEOUT_MS);
}
