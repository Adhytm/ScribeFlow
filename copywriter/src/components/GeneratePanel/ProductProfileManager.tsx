import { useState, useEffect } from 'react';
import type { Brief, ProductProfile } from '../../types/document';
import { storage } from '../../services/storage';
import { toast } from '../Feedback/Toast';

interface Props {
  brief: Brief;
  onApplyProfile: (profile: ProductProfile) => void;
}

/**
 * 商品档案资产管理（Jasper 风格）：
 * 允许用户保存并快速载入已有的产品参数、真实背书与人群定义，告别重复输入
 */
export function ProductProfileManager({ brief, onApplyProfile }: Props) {
  const [profiles, setProfiles] = useState<ProductProfile[]>(() => storage.loadProducts());
  const [selectedId, setSelectedId] = useState<string>('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newProdName, setNewProdName] = useState(brief.name || '');
  const [newProdCategory, setNewProdCategory] = useState('服饰穿搭');

  // 当外部 brief.name 变动时同步默认存储名
  useEffect(() => {
    if (brief.name) setNewProdName(brief.name);
  }, [brief.name]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    if (!id) return;
    const found = profiles.find(p => p.id === id);
    if (found) {
      onApplyProfile(found);
      toast.success('已载入商品档案', `已自动填充「${found.name}」的全部规格、卖点与痛点数据。`);
    }
  };

  const handleSaveCurrent = () => {
    const name = newProdName.trim() || brief.name.trim() || '未命名商品';
    const profile: ProductProfile = {
      id: `prod-${Date.now()}`,
      name,
      category: newProdCategory,
      crowd: brief.crowd,
      sell: brief.sell,
      pain: brief.pain,
      scene: brief.scene,
      proof: brief.proof,
      diff: brief.diff,
      createdAt: Date.now()
    };

    const next = storage.saveProduct(profile);
    setProfiles(next);
    setSelectedId(profile.id);
    setShowSaveDialog(false);
    toast.success('商品档案已保存', `「${name}」已存入本地资产库，后续可随时一键载入。`);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = profiles.find(p => p.id === id);
    const next = storage.deleteProduct(id);
    setProfiles(next);
    if (selectedId === id) setSelectedId('');
    toast.info('已移除商品档案', `已从资产库删除「${target?.name || '指定商品'}」。`);
  };

  return (
    <div className="product-manager-box">
      <div className="pm-header-row">
        <div className="pm-select-wrap">
          <select
            className="pm-select"
            value={selectedId}
            onChange={e => handleSelect(e.target.value)}
            title="选择已保存的商品档案快速回填"
          >
            <option value="">📂 载入商品档案库 ({profiles.length}) ▾</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>
                [{p.category}] {p.name}
              </option>
            ))}
          </select>
        </div>

        {selectedId && (
          <button
            type="button"
            className="pm-del-btn"
            onClick={e => handleDelete(selectedId, e)}
            title="从资产库删除当前选中的商品档案"
          >
            ✕
          </button>
        )}

        <button
          type="button"
          className="pm-save-btn"
          onClick={() => {
            setNewProdName(brief.name || '我的新产品');
            setShowSaveDialog(true);
          }}
          title="将当前表单已填写的参数与背书存为永久商品档案"
        >
          <span className="pm-icon">+</span>
          <span>存为档案</span>
        </button>
      </div>

      {/* 存为商品档案的微弹层 */}
      {showSaveDialog && (
        <div className="pm-modal-overlay" onClick={() => setShowSaveDialog(false)}>
          <div className="pm-modal-card" onClick={e => e.stopPropagation()}>
            <div className="pm-modal-title">
              <span>💾 保存为商品档案</span>
              <button
                type="button"
                className="pm-modal-close"
                onClick={() => setShowSaveDialog(false)}
              >
                ✕
              </button>
            </div>

            <div className="pm-modal-body">
              <label className="field">
                <span>商品档案名称 <i>*</i></span>
                <input
                  value={newProdName}
                  onChange={e => setNewProdName(e.target.value)}
                  placeholder="如：轻氧净澈洁面乳"
                  autoFocus
                />
              </label>

              <label className="field">
                <span>所属行业类目</span>
                <select
                  value={newProdCategory}
                  onChange={e => setNewProdCategory(e.target.value)}
                >
                  <option value="美妆个护">💄 美妆个护</option>
                  <option value="3C数码">⚡ 3C数码</option>
                  <option value="服饰穿搭">👗 服饰穿搭</option>
                  <option value="食品生鲜">☕ 食品生鲜</option>
                  <option value="家居日用">🏡 家居日用</option>
                  <option value="母婴亲子">🍼 母婴亲子</option>
                  <option value="其他品类">📦 其他品类</option>
                </select>
              </label>

              <div className="pm-modal-hint">
                将同时保存当前表单中的<b>核心卖点、真实痛点、使用场景、资质背书与竞品差异</b>。
              </div>
            </div>

            <div className="pm-modal-actions">
              <button
                type="button"
                className="sm ghost"
                onClick={() => setShowSaveDialog(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="sm hot"
                onClick={handleSaveCurrent}
              >
                确认存入资产库
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
