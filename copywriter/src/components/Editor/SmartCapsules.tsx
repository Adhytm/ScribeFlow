import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { PostEditAdvice, DynamicActionPill } from '../../types/document';

export interface ActionPill {
  id: string;
  label: string;
  instruction: string;
  desc: string;
}

/**
 * 经典通用高频进阶动作备用集合：
 */
export const SMART_ACTION_PILLS: ActionPill[] = [
  {
    id: 'pain-point',
    label: '强化痛点共鸣',
    instruction: '增强目标人群在实际使用场景中的痛点共鸣与生活代入感，让问题更加真实扎心',
    desc: '突出真实生活困扰与痛点'
  },
  {
    id: 'golden-quotes',
    label: '提炼3条吸睛卖点金句',
    instruction: '将核心特色与功效提炼浓缩为3句朗朗上口、适合发小红书或海报的高光金句',
    desc: '提炼短平快的高光文案'
  },
  {
    id: 'social-tone',
    label: '转为闺蜜口语种草腔',
    instruction: '将语调调整为亲切、自然、口语化的朋友分享种草语气，拒绝生硬广告八股',
    desc: '更亲和真实的社交分享口吻'
  },
  {
    id: 'authority-proof',
    label: '补充质检与数据背书',
    instruction: '补充权威质检资质、关键成分实验数据或研发实力背书，提升客观信任感',
    desc: '强化专业背书与信任基础'
  },
  {
    id: 'simplify-crisp',
    label: '精炼压缩20%篇幅',
    instruction: '精简压缩约20%篇幅，删除空洞形容词与假大空的客套修饰，字字有力',
    desc: '去除多余废话，更加精炼干脆'
  },
  {
    id: 'urgent-cta',
    label: '强化限时促单召唤(CTA)',
    instruction: '在文末强化限时特惠、限量尝鲜与迫切的行动召唤指令(Call to Action)',
    desc: '强化结尾行动力与紧迫感'
  }
];

interface Props {
  editor: Editor | null;
  busy: boolean;
  advice: PostEditAdvice | null;
  isAdvising?: boolean;
  onRequestAdvice?: () => void;
  onRewrite: (from: number, to: number, text: string, instruction: string) => void;
}

/**
 * AI 智能副驾驶（Copilot）· 修改后进一步建议与动态下一步动作卡片：
 * 在用户完成初稿生成或每次划词改写后，主动审阅文案，给出针对性的专业建议和专属下一步胶囊。
 */
export function SmartCapsules({
  editor,
  busy,
  advice,
  isAdvising = false,
  onRequestAdvice,
  onRewrite
}: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  if (!editor || editor.isEmpty) return null;

  const currentActions: DynamicActionPill[] =
    advice && advice.actions && advice.actions.length > 0
      ? advice.actions
      : SMART_ACTION_PILLS;

  const handleActionClick = (pill: DynamicActionPill | ActionPill) => {
    if (busy) return;
    const { from, to, empty } = editor.state.selection;

    if (!empty) {
      // 用户有划词选区：直接对当前选区执行改写
      const selText = editor.state.doc.textBetween(from, to, '\n');
      if (selText.trim()) {
        onRewrite(from, to, selText, pill.instruction);
        return;
      }
    }

    // 用户未手动划词选区：默认对整篇正文进行定向升阶
    const fullText = editor.getText();
    if (!fullText.trim()) return;
    const docSize = editor.state.doc.content.size;
    onRewrite(0, docSize, fullText, pill.instruction);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = customPrompt.trim();
    if (!query || busy) return;

    handleActionClick({
      id: 'custom-' + Date.now(),
      label: query.slice(0, 8),
      instruction: query
    });
    setCustomPrompt('');
    setShowCustomInput(false);
  };

  return (
    <aside
      className={`smart-capsules-wrap ${advice ? 'has-advice' : ''} ${isAdvising ? 'is-analyzing' : ''}`}
      aria-label="AI 副驾驶修改后进一步建议"
    >
      <div className="smart-capsules-header">
        <div className="smart-capsules-title-box">
          <span className="smart-capsules-sparkle">✦</span>
          <span className="smart-capsules-title">AI 副驾 · 进一步建议</span>
          {advice?.lastAction && (
            <span className="copilot-action-badge" title="最近一次修改完成的操作">
              已完成：{advice.lastAction}
            </span>
          )}
          {isAdvising && (
            <span className="copilot-analyzing-badge">
              <span className="copilot-dot-pulse" />
              副驾审阅中…
            </span>
          )}
        </div>

        <div className="smart-capsules-header-ops">
          {onRequestAdvice && (
            <button
              type="button"
              className="copilot-tool-btn"
              onClick={onRequestAdvice}
              disabled={busy || isAdvising}
              title="重新审视当前最新全文，更新下一步打磨建议"
            >
              🔄 重新审阅
            </button>
          )}
          <button
            type="button"
            className="copilot-tool-btn ghost"
            onClick={() => setIsCollapsed(c => !c)}
            title={isCollapsed ? '展开副驾建议卡片' : '收起副驾建议卡片'}
          >
            {isCollapsed ? '展开 ▾' : '收起 ▴'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* AI 针对刚修改完内容的进一步诊断建议 */}
          <div className="copilot-advice-bubble">
            <span className="copilot-advice-icon">💡</span>
            <div className="copilot-advice-text">
              {advice?.summary || (
                '文案已就位。副驾驶已为你备好进阶方向：你可以选中局部段落，或点击下方胶囊继续深化痛点、补充背书或强化促单。'
              )}
            </div>
          </div>

          {/* 针对本次诊断动态生成的下一步动作胶囊 */}
          <div className="smart-capsules-row-wrap">
            <div className="smart-capsules-subheader">
              <span className="sub-title">猜你下一步想做：</span>
              <span className="smart-capsules-hint">划词改局部 · 未划词润通篇</span>
            </div>

            <div className="smart-capsules-row">
              {currentActions.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className="smart-capsule-btn dynamic-pill"
                  disabled={busy}
                  title={p.desc || p.instruction}
                  onClick={() => handleActionClick(p)}
                >
                  <span className="capsule-arrow">↳</span>
                  <span className="capsule-label">{p.label}</span>
                </button>
              ))}

              <button
                type="button"
                className="smart-capsule-btn custom-toggle"
                disabled={busy}
                onClick={() => setShowCustomInput(v => !v)}
                title="输入你自己指定的下一步打磨要求"
              >
                <span>＋ 自定义要求</span>
              </button>
            </div>

            {showCustomInput && (
              <form className="copilot-custom-form" onSubmit={handleCustomSubmit}>
                <input
                  type="text"
                  className="copilot-custom-input"
                  placeholder="输入给副驾的下一步修改要求（如：把第2句换成网络热梗、结尾加拼团优惠…）"
                  value={customPrompt}
                  onChange={e => setCustomPrompt(e.target.value)}
                  autoFocus
                  disabled={busy}
                />
                <button
                  type="submit"
                  className="copilot-custom-submit"
                  disabled={!customPrompt.trim() || busy}
                >
                  执行
                </button>
                <button
                  type="button"
                  className="copilot-custom-cancel"
                  onClick={() => setShowCustomInput(false)}
                >
                  取消
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
