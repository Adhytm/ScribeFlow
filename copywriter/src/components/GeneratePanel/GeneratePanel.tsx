import type { Brief, FrameworkSection } from '../../types/document';
import {
  FRAMEWORKS,
  getFramework,
  VIEW_OPTIONS,
  TONE_OPTIONS,
  THINKING_MODES,
  DEFAULT_CUSTOM_SECTIONS
} from '../../prompts/frameworks';

interface Props {
  brief: Brief;
  busy: boolean;
  busyKind?: 'generate' | 'rewrite' | 'titles' | null;
  streamCharCount?: number;
  onStop?: () => void;
  onChange: (patch: Partial<Brief>) => void;
  onGenerate: () => void;
  onTitles: () => void;
  onSaveVersion: () => void;
}

export function GeneratePanel({
  brief,
  busy,
  busyKind,
  streamCharCount,
  onStop,
  onChange,
  onGenerate,
  onTitles,
  onSaveVersion
}: Props) {
  const currentFw = getFramework(brief.frameworkId, brief.customSections);
  const isCustom = currentFw.id === 'custom';
  const customSections = brief.customSections && brief.customSections.length > 0
    ? brief.customSections
    : DEFAULT_CUSTOM_SECTIONS;

  const currentThinking = brief.thinkingMode || '构思';
  const currentModeInfo = THINKING_MODES.find(m => m.id === currentThinking) || THINKING_MODES[1];

  const updateSection = (index: number, patch: Partial<FrameworkSection>) => {
    const next = [...customSections];
    next[index] = { ...next[index], ...patch };
    onChange({ customSections: next });
  };

  const addSection = () => {
    const next: FrameworkSection[] = [
      ...customSections,
      {
        key: `custom-${Date.now()}`,
        name: `段落 ${customSections.length + 1}`,
        goal: '',
        len: '50-80 字',
        must: '',
        ban: ''
      }
    ];
    onChange({ customSections: next });
  };

  const deleteSection = (index: number) => {
    if (customSections.length <= 1) return;
    const next = customSections.filter((_, i) => i !== index);
    onChange({ customSections: next });
  };

  const loadPresetTemplate = (presetId: string) => {
    const target = FRAMEWORKS.find(f => f.id === presetId);
    if (!target) return;
    onChange({
      customSections: target.sections.map((s, idx) => ({
        ...s,
        key: `custom-${Date.now()}-${idx}`
      }))
    });
  };

  const resetToDefault = () => {
    onChange({ customSections: DEFAULT_CUSTOM_SECTIONS });
  };

  return (
    <div className="gp">
      <div className="grp">
        <h3>文案框架 · 目标形式</h3>
        <label className="field">
          <span>选择预设框架</span>
          <select
            value={currentFw.id}
            onChange={e => onChange({ frameworkId: e.target.value })}
          >
            {FRAMEWORKS.map(f => (
              <option key={f.id} value={f.id}>
                [{f.tag}] {f.name}（{f.id === 'custom' ? customSections.length : f.sections.length} 段）
              </option>
            ))}
          </select>
          <em>{currentFw.scenes}</em>
        </label>
      </div>

      <div className="grp">
        <h3>必填 · 两项就能出稿</h3>
        <label className="field">
          <span>产品名称 <i>*</i></span>
          <input
            value={brief.name}
            onChange={e => onChange({ name: e.target.value })}
            placeholder="如：轻氧净澈氨基酸洁面乳"
          />
        </label>
        <label className="field">
          <span>目标人群 <i>*</i></span>
          <input
            value={brief.crowd}
            onChange={e => onChange({ crowd: e.target.value })}
            placeholder="如：25-35 岁混油皮女生，加班多、怕闷痘"
          />
          <em>写得越具体越好。「所有人」只会换来正确的废话。</em>
        </label>
      </div>

      <div className="grp">
        <h3>素材 · 填得越细写得越准</h3>
        <label className="field">
          <span>核心卖点（每行一条）</span>
          <textarea rows={3} value={brief.sell} onChange={e => onChange({ sell: e.target.value })} />
        </label>
        <label className="field">
          <span>用户痛点（每行一条）</span>
          <textarea rows={3} value={brief.pain} onChange={e => onChange({ pain: e.target.value })} />
        </label>
        <label className="field">
          <span>使用场景</span>
          <textarea rows={2} value={brief.scene} onChange={e => onChange({ scene: e.target.value })} />
        </label>
        <label className="field">
          <span>信任证据</span>
          <textarea rows={2} value={brief.proof} onChange={e => onChange({ proof: e.target.value })} />
        </label>
        <label className="field">
          <span>与竞品的差异</span>
          <input value={brief.diff} onChange={e => onChange({ diff: e.target.value })} />
        </label>
      </div>

      <div className="grp">
        <h3>创作心智 · 思考深度</h3>
        <div className="seg-control" role="radiogroup" aria-label="创作心智模式">
          {THINKING_MODES.map(m => {
            const active = currentThinking === m.id;
            return (
              <button
                key={m.id}
                type="button"
                className={`seg-btn ${active ? 'on' : ''}`}
                onClick={() => onChange({ thinkingMode: m.id })}
                title={m.desc}
                aria-checked={active}
                role="radio"
              >
                <span className="seg-label">{m.label}</span>
                <span className="seg-sub">{m.sub}</span>
              </button>
            );
          })}
        </div>
        <div className="seg-hint">{currentModeInfo.desc}</div>
      </div>

      <div className="grp">
        <h3>风格控制</h3>
        <div className="row2">
          <label className="field">
            <span>叙述视角</span>
            <select value={brief.view} onChange={e => onChange({ view: e.target.value })}>
              {VIEW_OPTIONS.map(v => <option key={v}>{v}</option>)}
            </select>
          </label>
          <label className="field">
            <span>语气</span>
            <select value={brief.tone} onChange={e => onChange({ tone: e.target.value })}>
              {TONE_OPTIONS.map(v => <option key={v}>{v}</option>)}
            </select>
          </label>
        </div>
        <div className="row2">
          <label className="field">
            <span>目标字数</span>
            <select value={brief.length} onChange={e => onChange({ length: Number(e.target.value) })}>
              <option value={300}>约 300 字</option>
              <option value={600}>约 600 字</option>
              <option value={900}>约 900 字</option>
            </select>
          </label>
          <label className="field">
            <span>温度</span>
            <select value={brief.temperature} onChange={e => onChange({ temperature: Number(e.target.value) })}>
              <option value={0.6}>0.6 稳</option>
              <option value={0.85}>0.85 活</option>
              <option value={1.1}>1.1 野</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>禁忌词（逗号分隔）</span>
          <input value={brief.ban} onChange={e => onChange({ ban: e.target.value })} placeholder="如：神器,必备,震惊" />
        </label>
      </div>

      {isCustom ? (
        <div className="grp custom-builder-grp">
          <div className="custom-builder-head">
            <h3>自由分段（{customSections.length} 段）</h3>
            <div className="custom-builder-tools">
              <select
                className="custom-preset-select"
                defaultValue=""
                onChange={e => {
                  if (e.target.value) {
                    loadPresetTemplate(e.target.value);
                    e.target.value = '';
                  }
                }}
                title="载入现有预设为蓝本"
              >
                <option value="" disabled>载入蓝本…</option>
                {FRAMEWORKS.filter(f => f.id !== 'custom').map(f => (
                  <option key={f.id} value={f.id}>导入：[{f.tag}] {f.name}</option>
                ))}
              </select>
              <button
                type="button"
                className="custom-tool-btn"
                onClick={resetToDefault}
                title="恢复初始 5 个通用槽位"
              >
                重置5段
              </button>
            </div>
          </div>

          <div className="custom-sec-list">
            {customSections.map((s, i) => (
              <div className="custom-sec-card" key={s.key || i}>
                <div className="custom-sec-header">
                  <span className="custom-sec-badge">{i + 1}</span>
                  <input
                    className="custom-sec-name-input"
                    value={s.name}
                    onChange={e => updateSection(i, { name: e.target.value })}
                    placeholder="段落名称，如：开头钩子"
                  />
                  {customSections.length > 1 && (
                    <button
                      type="button"
                      className="custom-sec-del"
                      onClick={() => deleteSection(i)}
                      title="删除此段落"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="custom-sec-grid">
                  <label className="custom-field">
                    <span>段落目标</span>
                    <input
                      value={s.goal}
                      onChange={e => updateSection(i, { goal: e.target.value })}
                      placeholder="如：打破常规认知，秒停滑屏"
                    />
                  </label>
                  <label className="custom-field">
                    <span>预估字数</span>
                    <input
                      value={s.len}
                      onChange={e => updateSection(i, { len: e.target.value })}
                      placeholder="如：30-50 字"
                    />
                  </label>
                  <label className="custom-field">
                    <span>重点交代</span>
                    <input
                      value={s.must}
                      onChange={e => updateSection(i, { must: e.target.value })}
                      placeholder="必须讲透的核心卖点/细节"
                    />
                  </label>
                  <label className="custom-field">
                    <span>避坑提醒</span>
                    <input
                      value={s.ban}
                      onChange={e => updateSection(i, { ban: e.target.value })}
                      placeholder="避免出现的自嗨词/套路"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="custom-add-btn"
            onClick={addSection}
          >
            + 添加一段
          </button>
        </div>
      ) : (
        <details className="fw">
          <summary>当前框架：{currentFw.name} · 分段结构（{currentFw.sections.length} 段）</summary>
          <div className="fw-body">
            <div className="fw-flow-bar">
              <span>推进节奏：</span>
              <em>{currentFw.desc}</em>
            </div>
            {currentFw.sections.map((s, i) => (
              <div className="sec-item" key={s.key}>
                <b>{i + 1}. {s.name}</b>
                <p>目标：{s.goal}<br />字数：{s.len}<br />重点交代：{s.must}<br />避坑提醒：{s.ban}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      {busyKind === 'generate' ? (
        <button
          type="button"
          className="primary danger"
          onClick={onStop}
          title="点击中止生成"
        >
          停止生成{streamCharCount ? `（已输出 ${streamCharCount} 字）` : ''}
        </button>
      ) : (
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={onGenerate}
        >
          {busy ? (busyKind === 'rewrite' ? '改写中…' : busyKind === 'titles' ? '出标题中…' : '处理中…') : '生成文案'}
        </button>
      )}
      <div className="row2 tight">
        <button className="sm" disabled={busy} onClick={onTitles}>出 5 条标题</button>
        <button className="sm" disabled={busy} onClick={onSaveVersion}>存一版</button>
      </div>
    </div>
  );
}
