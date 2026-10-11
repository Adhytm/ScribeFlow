import { useEffect, useRef, useState } from 'react';
import type { ClientProviderConfig, ProviderType, ServerConfig } from '../../types/document';
import { fetchServerConfig, testConnection, type TestConnectionResult } from '../../services/llm';

interface Props {
  provider: ProviderType;
  onProviderChange: (p: ProviderType, nextConfig?: Partial<ClientProviderConfig>) => void;
  config: ClientProviderConfig;
  onConfigChange: (cfg: ClientProviderConfig) => void;
}

export interface PresetInfo {
  id: string;
  name: string;
  shortName: string;
  urls: { label: string; url: string }[];
  models: { label: string; name: string }[];
  note?: string;
}

export const SERVICE_PRESETS: PresetInfo[] = [
  {
    id: 'local',
    name: '本地大模型 (Ollama / LM Studio 免密直连)',
    shortName: '本地',
    urls: [
      { label: 'Ollama 默认 (11434)', url: 'http://127.0.0.1:11434/v1' },
      { label: 'LM Studio 默认 (1234)', url: 'http://127.0.0.1:1234/v1' }
    ],
    models: [
      { label: 'qwen3.8-27b', name: 'qwen3.8-27b' }
    ],
    note: '本地离线模型免密直连。在终端运行 ollama run qwen3.8-27b 即可。'
  },
  {
    id: 'moonshot',
    name: 'Moonshot AI (Kimi)',
    shortName: 'Kimi',
    urls: [
      { label: '完整端点 (官方推荐)', url: 'https://api.moonshot.ai/v1/chat/completions' },
      { label: 'Base URL', url: 'https://api.moonshot.ai/v1' }
    ],
    models: [
      { label: 'kimi-k3', name: 'kimi-k3' },
      { label: 'kimi-k2.6', name: 'kimi-k2.6' }
    ]
  },
  {
    id: 'dashscope',
    name: '阿里云 DashScope (通义千问)',
    shortName: 'DashScope',
    urls: [
      { label: 'OpenAI 兼容端点（推荐）', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
      { label: '原生 API 前缀', url: 'https://dashscope.aliyuncs.com/api/v1' }
    ],
    models: [
      { label: 'qwen3.8-max', name: 'qwen3.8-max' },
      { label: 'qwen-3.8-flash', name: 'qwen-3.8-flash' }
    ]
  },
  {
    id: 'aliyun-token-plan',
    name: '阿里云 Token Plan (东南亚兼容端点)',
    shortName: 'Token Plan',
    urls: [
      { label: '东南亚 Token Plan 端点', url: 'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1' }
    ],
    models: [
      { label: 'qwen3.8-max', name: 'qwen3.8-max' },
      { label: 'qwen-3.8-flash', name: 'qwen-3.8-flash' }
    ]
  },
  {
    id: 'gemini',
    name: 'Google Gemini (Google AI)',
    shortName: 'Gemini',
    urls: [
      { label: 'Gemini 官方端点', url: 'https://generativelanguage.googleapis.com' },
      { label: 'Interactions API 端点', url: 'https://generativelanguage.googleapis.com/v1beta/interactions' }
    ],
    models: [
      { label: 'gemini-3.8-flash', name: 'gemini-3.8-flash' },
      { label: 'gemini-3.1-pro', name: 'gemini-3.1-pro' }
    ]
  },
  {
    id: 'zhipu',
    name: '智谱 AI (GLM PaaS v4)',
    shortName: '智谱 GLM',
    urls: [
      { label: 'GLM 官方端点', url: 'https://open.bigmodel.cn/api/paas/v4' }
    ],
    models: [
      { label: 'glm-5.3', name: 'glm-5.3' },
      { label: 'glm-5.3-flash', name: 'glm-5.3-flash' }
    ]
  },
  {
    id: 'zhipu-coding',
    name: '智谱 AI Coding Plan',
    shortName: '智谱 Coding',
    urls: [
      { label: 'Coding Plan 专属端点', url: 'https://open.bigmodel.cn/api/coding/paas/v4' }
    ],
    models: [
      { label: 'glm-5.3', name: 'glm-5.3' },
      { label: 'glm-5.3-flash', name: 'glm-5.3-flash' }
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek 官方',
    shortName: 'DeepSeek',
    urls: [
      { label: 'DeepSeek 官方根端点', url: 'https://api.deepseek.com' },
      { label: 'v1 兼容端点', url: 'https://api.deepseek.com/v1' }
    ],
    models: [
      { label: 'deepseek-flash', name: 'deepseek-flash' },
      { label: 'deepseek-pro', name: 'deepseek-pro' }
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI 官方',
    shortName: 'OpenAI',
    urls: [
      { label: 'OpenAI 官方端点', url: 'https://api.openai.com/v1' }
    ],
    models: [
      { label: 'gpt-6.1-sol', name: 'gpt-6.1-sol' },
      { label: 'gpt-6-astra', name: 'gpt-6-astra' },
      { label: 'gpt-6-luna', name: 'gpt-6-luna' }
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude (Messages API)',
    shortName: 'Claude',
    urls: [
      { label: '官方 Messages 端点', url: 'https://api.anthropic.com/v1/messages' },
      { label: 'Anthropic 根端点', url: 'https://api.anthropic.com' }
    ],
    models: [
      { label: 'claude-sonnet-5-5', name: 'claude-sonnet-5-5' },
      { label: 'claude-opus-5-5', name: 'claude-opus-5-5' },
      { label: 'claude-fable-5-1', name: 'claude-fable-5-1' },
      { label: 'fable-5-1', name: 'fable-5-1' }
    ],
    note: '已自动附带版本头 anthropic-version: 2023-06-01'
  }
];

export function ApiSettings({ provider, onProviderChange, config, onConfigChange }: Props) {
  const [serverCfg, setServerCfg] = useState<ServerConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchServerConfig()
      .then(setServerCfg)
      .catch(() => setServerCfg(null));
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleMousedown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMousedown);
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('mousedown', handleMousedown);
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [open]);

  const activePreset = SERVICE_PRESETS.find(p => p.id === provider) || SERVICE_PRESETS[0];
  const serverProviderInfo = serverCfg?.providers?.[provider];
  const hasServerKey = serverProviderInfo?.hasKey ?? false;

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testConnection({
        provider,
        base: config.base,
        model: config.model,
        apiKey: config.apiKey
      });
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ ok: false, error: e.message });
    } finally {
      setTesting(false);
    }
  }

  function handlePresetSelect(presetId: string) {
    const target = SERVICE_PRESETS.find(p => p.id === presetId);
    if (!target) return;
    const defaultUrl = target.urls[0]?.url || '';
    const defaultModel = target.models[0]?.name || '';
    // 只带预设的 base/model 过去，apiKey 由 App 合并该服务商自己存的那份——
    // 否则当前服务商的 Key 会被发到新服务商的服务器（跨厂商凭证泄露）
    onProviderChange(target.id, {
      base: defaultUrl,
      model: defaultModel
    });
    setTestResult(null);
  }

  return (
    <div className="api-box" ref={boxRef}>
      <button className="ghost sm" onClick={() => setOpen(o => !o)} title="点击展开模型与接口设置">
        服务: {activePreset.shortName} · {config.model || '未选模型'} ▾
      </button>

      {open && (
        <div className="api-detail">
          <label className="field">
            <span>服务商快捷预设 (2026 最新)</span>
            <select
              value={provider}
              onChange={e => handlePresetSelect(e.target.value)}
            >
              {SERVICE_PRESETS.map(preset => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>

          {/* 接口端点 (URL) */}
          <label className="field">
            <span>接口端点 (URL)</span>
            <input
              value={config.base}
              placeholder="输入接口端点 URL"
              onChange={e => {
                onConfigChange({ ...config, base: e.target.value });
                setTestResult(null);
              }}
            />
            <div className="api-chips">
              {activePreset.urls.map(u => (
                <button
                  key={u.url}
                  type="button"
                  className="api-chip"
                  onClick={() => {
                    onConfigChange({ ...config, base: u.url });
                    setTestResult(null);
                  }}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </label>

          {/* 模型名称 */}
          <label className="field">
            <span>模型名称</span>
            <input
              value={config.model}
              placeholder="输入模型名称"
              onChange={e => {
                onConfigChange({ ...config, model: e.target.value });
                setTestResult(null);
              }}
            />
            <div className="api-chips">
              {activePreset.models.map(m => (
                <button
                  key={m.name}
                  type="button"
                  className="api-chip"
                  onClick={() => {
                    onConfigChange({ ...config, model: m.name });
                    setTestResult(null);
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </label>

          {/* 认证状态 / API Key */}
          {provider === 'local' ? (
            <div className="api-row" style={{ marginTop: 4 }}>
              <span>认证状态</span>
              <b className="ok">本地免密直连（无需 Key）</b>
            </div>
          ) : (
            <>
              <div className="api-row" style={{ marginTop: 4 }}>
                <span>服务端 Key 状态</span>
                <b className={hasServerKey ? 'ok' : 'bad'}>
                  {hasServerKey ? '✓ 服务端已有配置，前端可留空' : '未配置 (可在下方填入)'}
                </b>
              </div>
              <label className="field" style={{ marginTop: 6 }}>
                <span>API Key（选填，优先使用您在此填入的 Key）</span>
                <input
                  type="password"
                  value={config.apiKey || ''}
                  placeholder={hasServerKey ? '已读取服务端 Key，可直接留空' : '填入对应平台的 API Key'}
                  onChange={e => {
                    onConfigChange({ ...config, apiKey: e.target.value });
                    setTestResult(null);
                  }}
                />
              </label>
            </>
          )}

          {activePreset.note && (
            <p className="api-note" style={{ margin: '4px 0 8px', color: 'var(--tx2)' }}>
              💡 {activePreset.note}
            </p>
          )}

          {/* 测试连接按钮与反馈 */}
          <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="sm hot"
              disabled={testing || !config.base.trim() || !config.model.trim()}
              onClick={handleTest}
              style={{ width: '100%', padding: '7px 10px', fontSize: '13px' }}
            >
              {testing ? '正在测试连接…' : '⚡ 测试连接 (确保 URL 可达)'}
            </button>
          </div>

          {testResult && (
            <div className={`api-test-res ${testResult.ok ? 'ok' : 'bad'}`}>
              {testResult.ok ? (
                <div>✓ {testResult.message || `连接成功！(耗时 ${testResult.latencyMs}ms)`}</div>
              ) : (
                <div>✗ {testResult.error || '连接失败，请检查端点是否可达'}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
