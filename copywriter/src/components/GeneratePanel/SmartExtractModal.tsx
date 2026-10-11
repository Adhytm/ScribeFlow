import { useState } from 'react';
import type { Brief } from '../../types/document';
import { toast } from '../Feedback/Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApply: (extracted: Partial<Brief>) => void;
}

const SAMPLE_RAW_COPY = `
【暴走小红帽】防晒降温双拼冰丝阔腿裤！
姐妹们懂不懂夏天出汗裤子死死贴在大腿上的绝望？尤其是在38度的太阳底下等红绿灯，又闷又热还显假胯宽！
这条阔腿裤采用的是黑科技接触凉感天丝面料，上身瞬间降温3度，风一吹凉飕飕的超级舒服。
高腰A字微阔版型，视觉上直接遮住假胯宽和大腿赘肉，视觉显高8厘米！
通过国家婴幼儿A类无荧光亲肤标准，50次机洗不起球不变形，UPF50+紫外线阻隔率高达99%！
不管是早八挤地铁通勤，还是周末和闺蜜去海边露营，随便搭个T恤就能出片！
`;

/**
 * 启发式离线拆解提取器：即使未配置云端大模型，也能本地智能提取出结构
 */
function heuristicExtract(raw: string): Partial<Brief> {
  const lines = raw.split(/[\n。！？]/).map(l => l.trim()).filter(Boolean);
  
  let name = '';
  let crowd = '';
  const sells: string[] = [];
  const pains: string[] = [];
  const scenes: string[] = [];
  const proofs: string[] = [];

  // 尝试提取品名
  const titleMatch = raw.match(/【(.*?)】/) || raw.match(/《(.*?)》/);
  if (titleMatch) {
    name = titleMatch[1].slice(0, 30);
  } else if (lines[0]) {
    name = lines[0].slice(0, 30);
  }

  for (const line of lines) {
    // 痛点探测
    if (/绝望|痛点|闷|热|贴|黏|显胖|假胯|尴尬|难受|刺痛|卡粉|暗沉|焦虑|累/.test(line)) {
      pains.push(line);
    }
    // 卖点探测
    else if (/黑科技|天丝|降温|凉感|微阔|显高|修身|免熨|弹力|高腰|透气|吸收|萃取/.test(line)) {
      sells.push(line);
    }
    // 证据探测
    else if (/A类|标准|通过|认证|SGS|测试|报告|质检|专利|不含|0添加|UPF/.test(line)) {
      proofs.push(line);
    }
    // 场景探测
    else if (/通勤|早八|周末|约会|差旅|工位|露营|海边|日常|办公|熬夜|换季/.test(line)) {
      scenes.push(line);
    }
  }

  // 提取人群
  if (/姐妹|女性|宝妈|学生|上班族|大厂|程序员|打工人|混油皮|敏感肌/.test(raw)) {
    const crowdMatch = raw.match(/(姐妹们?|女性|上班族|学生|打工人|混油皮|敏感肌[^\n，。]*)/);
    crowd = crowdMatch ? crowdMatch[0] : '注重品质与性价比的年轻消费群体';
  } else {
    crowd = '关注舒适度与实用性的目标用户群体';
  }

  return {
    name: name || '提炼商品',
    crowd: crowd.trim(),
    sell: sells.slice(0, 4).join('\n') || raw.slice(0, 80),
    pain: pains.slice(0, 4).join('\n') || '夏季闷热贴腿、显身材缺陷',
    scene: scenes.slice(0, 3).join('、') || '日常通勤、周末出游',
    proof: proofs.slice(0, 3).join('\n') || '权威检测认证'
  };
}

export function SmartExtractModal({ isOpen, onClose, onApply }: Props) {
  const [rawText, setRawText] = useState('');
  const [extracted, setExtracted] = useState<Partial<Brief> | null>(null);

  if (!isOpen) return null;

  const handleStartExtract = () => {
    const input = rawText.trim();
    if (!input) {
      toast.warn('请先粘贴材料', '请输入或粘贴竞品文案、博文或产品参数。');
      return;
    }

    const res = heuristicExtract(input);
    setExtracted(res);
    toast.success('拆解完成', '已自动识别出商品名称、卖点、痛点与背书数据，请确认。');
  };

  const handleApplyToForm = () => {
    if (!extracted) return;
    onApply(extracted);
    toast.success('已灌入表单', '已成功将逆向提取的数据填充至左侧素材面板！');
    onClose();
    setExtracted(null);
    setRawText('');
  };

  return (
    <div className="extract-modal-overlay" onClick={onClose}>
      <div className="extract-modal-card" onClick={e => e.stopPropagation()}>
        <div className="extract-modal-header">
          <div className="extract-modal-title">
            <span className="em-sparkle">✦</span>
            <span>粘贴竞品/材料一键逆向拆解</span>
          </div>
          <button type="button" className="extract-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="extract-modal-body">
          <p className="em-intro">
            把在淘宝、小红书、抖音复制的同行爆款文案，或说明书产品参数直接粘贴在此处，系统将自动拆解为结构化素材。
          </p>

          <div className="em-input-area">
            <textarea
              className="em-textarea"
              rows={6}
              placeholder="在此粘贴竞品文案、小红书博文或说明书参数..."
              value={rawText}
              onChange={e => setRawText(e.target.value)}
            />
            <div className="em-textarea-actions">
              <button
                type="button"
                className="em-sample-btn"
                onClick={() => setRawText(SAMPLE_RAW_COPY.trim())}
              >
                📋 填入示例材料
              </button>
              <button
                type="button"
                className="em-action-btn hot"
                onClick={handleStartExtract}
              >
                ⚡ 开始逆向拆解
              </button>
            </div>
          </div>

          {/* 拆解结果预览 */}
          {extracted && (
            <div className="em-preview-box">
              <div className="em-preview-header">
                <b>✦ 拆解数据预览（可一键注入）：</b>
              </div>
              <div className="em-preview-grid">
                <div className="em-item">
                  <span>产品名称：</span>
                  <b>{extracted.name}</b>
                </div>
                <div className="em-item">
                  <span>目标人群：</span>
                  <b>{extracted.crowd}</b>
                </div>
                <div className="em-item">
                  <span>核心卖点：</span>
                  <pre>{extracted.sell}</pre>
                </div>
                <div className="em-item">
                  <span>解决痛点：</span>
                  <pre>{extracted.pain}</pre>
                </div>
                <div className="em-item">
                  <span>信任证据：</span>
                  <pre>{extracted.proof}</pre>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="extract-modal-footer">
          <button type="button" className="sm ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="sm hot"
            disabled={!extracted}
            onClick={handleApplyToForm}
          >
            ✓ 确认填充至左侧表单
          </button>
        </div>
      </div>
    </div>
  );
}
