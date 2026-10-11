import { useState } from 'react';
import { INDUSTRY_INSPIRATIONS } from '../../prompts/inspirationLibrary';
import { toast } from '../Feedback/Toast';

interface Props {
  onInject: (field: 'pain' | 'sell' | 'proof' | 'scene', text: string) => void;
}

/**
 * 行业爆款灵感弹药库（知衣模式 · 点选即注入）：
 * 提供多品类真实买家差评痛点、爆款卖点、权威背书词云，点击直接飞入对应输入框
 */
export function IndustryInspirationHub({ onInject }: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeIndustryId, setActiveIndustryId] = useState<string>('beauty');
  const [injectedText, setInjectedText] = useState<string | null>(null);

  const currentIndustry =
    INDUSTRY_INSPIRATIONS.find(i => i.id === activeIndustryId) || INDUSTRY_INSPIRATIONS[0];

  const handleChipClick = (
    field: 'pain' | 'sell' | 'proof' | 'scene',
    text: string,
    fieldName: string
  ) => {
    onInject(field, text);
    setInjectedText(text);
    setTimeout(() => setInjectedText(null), 1000);
    toast.success('已注入素材', `「${text}」已追加至【${fieldName}】。`);
  };

  return (
    <div className={`inspiration-hub ${isOpen ? 'open' : 'closed'}`}>
      <div className="ih-header" onClick={() => setIsOpen(o => !o)}>
        <div className="ih-title">
          <span className="ih-icon">✦</span>
          <span>行业爆款弹药库</span>
          <span className="ih-badge">点词即填</span>
        </div>
        <button
          type="button"
          className="ih-toggle-btn"
          aria-label={isOpen ? '收起灵感库' : '展开灵感库'}
        >
          {isOpen ? '收起 ▴' : '展开灵感 ▾'}
        </button>
      </div>

      {isOpen && (
        <div className="ih-body">
          {/* 行业分类切换药丸栏 */}
          <div className="ih-tabs">
            {INDUSTRY_INSPIRATIONS.map(ind => (
              <button
                key={ind.id}
                type="button"
                className={`ih-tab ${activeIndustryId === ind.id ? 'active' : ''}`}
                onClick={() => setActiveIndustryId(ind.id)}
              >
                <span>{ind.icon}</span>
                <span>{ind.name}</span>
              </button>
            ))}
          </div>

          <div className="ih-content-grid">
            {/* 1. 真实痛点词云 */}
            <div className="ih-section">
              <div className="ih-sec-header">
                <span className="sec-tag tag-pain">💥 买家痛点</span>
                <span className="sec-sub">点击注入【用户痛点】</span>
              </div>
              <div className="ih-chip-cloud">
                {currentIndustry.pains.map(p => (
                  <button
                    key={p}
                    type="button"
                    className={`ih-chip chip-pain ${injectedText === p ? 'injected' : ''}`}
                    onClick={() => handleChipClick('pain', p, '用户痛点')}
                    title="点击追加到用户痛点输入框"
                  >
                    <span>+</span>
                    <span>{p}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. 爆款卖点词云 */}
            <div className="ih-section">
              <div className="ih-sec-header">
                <span className="sec-tag tag-sell">✨ 高光卖点</span>
                <span className="sec-sub">点击注入【核心卖点】</span>
              </div>
              <div className="ih-chip-cloud">
                {currentIndustry.sells.map(s => (
                  <button
                    key={s}
                    type="button"
                    className={`ih-chip chip-sell ${injectedText === s ? 'injected' : ''}`}
                    onClick={() => handleChipClick('sell', s, '核心卖点')}
                    title="点击追加到核心卖点输入框"
                  >
                    <span>+</span>
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. 权威资质与背书 */}
            <div className="ih-section">
              <div className="ih-sec-header">
                <span className="sec-tag tag-proof">🏆 信任背书</span>
                <span className="sec-sub">点击注入【信任证据】</span>
              </div>
              <div className="ih-chip-cloud">
                {currentIndustry.proofs.map(pr => (
                  <button
                    key={pr}
                    type="button"
                    className={`ih-chip chip-proof ${injectedText === pr ? 'injected' : ''}`}
                    onClick={() => handleChipClick('proof', pr, '信任证据')}
                    title="点击追加到信任证据输入框"
                  >
                    <span>+</span>
                    <span>{pr}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. 高频使用场景 */}
            <div className="ih-section">
              <div className="ih-sec-header">
                <span className="sec-tag tag-scene">🎯 典型场景</span>
                <span className="sec-sub">点击注入【使用场景】</span>
              </div>
              <div className="ih-chip-cloud">
                {currentIndustry.scenes.map(sc => (
                  <button
                    key={sc}
                    type="button"
                    className={`ih-chip chip-scene ${injectedText === sc ? 'injected' : ''}`}
                    onClick={() => handleChipClick('scene', sc, '使用场景')}
                    title="点击追加到使用场景输入框"
                  >
                    <span>+</span>
                    <span>{sc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
