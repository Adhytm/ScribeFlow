import type { Brief, Framework } from '../types/document';

export const EC_DETAIL: Framework = {
  id: 'ec-detail',
  name: '电商详情长文案',
  tag: '经典电商',
  desc: '开头钩子 → 痛点放大 → 卖点登场 → 卖点拆解 → 场景代入 → 信任背书 → 促单收口',
  scenes: '天猫/京东/淘宝/拼多多/独立站标准详情页长图文，层层递进消除购买顾虑',
  sections: [
    { key: 'hook', name: '开头钩子', goal: '第一句就抓住正在滑屏的人', len: '15-30 字',
      must: '一个具体的人或一个具体的瞬间', ban: '寒暄、品牌自夸、"今天给大家推荐"' },
    { key: 'pain', name: '痛点放大', goal: '写出她日常里真实发生的困扰，让她觉得"说的就是我"', len: '60-90 字',
      must: '至少 2 个具体到画面的细节', ban: '空泛形容词、夸大其词' },
    { key: 'enter', name: '卖点登场', goal: '把产品自然接进来，只讲一个最核心的卖点', len: '50-80 字',
      must: '产品名 + 一个核心卖点，讲清"为什么能做到"', ban: '一次堆砌全部卖点' },
    { key: 'points', name: '卖点拆解', goal: '用 3 条支撑点把核心卖点坐实', len: '120-180 字',
      must: '每条都是"是什么 + 对你有什么用"', ban: '只报参数不翻译成人话' },
    { key: 'scene', name: '场景代入', goal: '让她在脑子里看见自己用它的样子', len: '70-110 字',
      must: '2-3 个具体场景，带时间点或动作', ban: '"适用于各种场景"这种废话' },
    { key: 'proof', name: '信任背书', goal: '消除最后一点犹豫', len: '50-90 字',
      must: '具体数字、测试、资质或真实反馈', ban: '编造数据、虚假承诺' },
    { key: 'cta', name: '促单收口', goal: '给一个现在就下手的理由', len: '30-50 字',
      must: '明确的行动指令 + 一个合理的紧迫理由', ban: '空洞的"快来购买"、虚假倒计时' }
  ]
};

export const REDBOOK_SEED: Framework = {
  id: 'redbook-seed',
  name: '小红书爆款种草笔记',
  tag: '口碑种草',
  desc: '反常识钩子 → 真实踩坑前情 → 惊艳发现与转折 → 核心体感暴击 → 人群与避坑建议 → 评论区抛梗',
  scenes: '小红书图文笔记、好物清单、闺蜜/兄弟真人真实安利，去官方味，重生活颗粒感',
  sections: [
    { key: 'hook', name: '反常识钩子', goal: '打破常规认知或抛出惊人反差，秒停下滑大拇指', len: '20-40 字',
      must: '第一人称真实语气，带强烈反差感或反常识判断', ban: '官方腔、"今天给大家分享一个好物"' },
    { key: 'regret', name: '踩坑前情', goal: '交代自己之前交学费或遭罪的具体经历，唤起共鸣', len: '60-90 字',
      must: '具体花冤枉钱或踩雷的真实尴尬/狼狈细节', ban: '无病呻吟、虚假的剧情编造' },
    { key: 'turn', name: '惊艳转折', goal: '交代偶然入手的契机与初次上身体验', len: '50-80 字',
      must: '第一次用时超出预期的微小体感反差', ban: '全网吹爆类假大空吹嘘' },
    { key: 'sensory', name: '细节暴击', goal: '用 2-3 个长期用过才懂的微小细节坐实好用', len: '100-150 字',
      must: '质地、触感、声音或持久度等五感细节', ban: '说明书式抄写成分表或硬件参数' },
    { key: 'who', name: '人群避坑', goal: '坦白客观边界，讲清适合谁、不适合谁', len: '50-80 字',
      must: '明确说出哪类人别买，哪类人闭眼入', ban: '神化产品、宣称所有人适用' },
    { key: 'interact', name: '互动收尾', goal: '在文末抛出一个容易引发评论区共鸣讨论的话题', len: '25-45 字',
      must: '自然接地气的反问句或求助交流句', ban: '强行引流、生硬催单' }
  ]
};

export const SHORT_VIDEO_SCRIPT: Framework = {
  id: 'short-video-script',
  name: '短视频带货口播脚本',
  tag: '短视频口播',
  desc: '黄金3秒动作钩子 → 扎心现场唤醒 → 暴力对比实测 → 帮用户算账破防 → 绝杀促单指令',
  scenes: '抖音/快手/视频号带货短视频、信息流投流广告、直播切片高转化口播脚本',
  sections: [
    { key: 'hook3s', name: '黄金3秒动作钩子', goal: '动作+爆言瞬间留住滑屏用户，完播率生死线', len: '15-30 字',
      must: '带[镜头/动作]画面提示 + 一句扎心爆言或反问', ban: '"大家好我是xx"、缓慢铺垫' },
    { key: 'pain_live', name: '扎心现场唤醒', goal: '近景特写直击受众痛处，唤醒日常受罪记忆', len: '50-80 字',
      must: '高频日常尴尬/受罪动作特写，句式短促有力', ban: '长难句、抽象讲大道理' },
    { key: 'brutal_test', name: '暴力对比实测', goal: '用极度残酷的实测或夸张反差颠覆认知', len: '80-120 字',
      must: '[展示动作]提示 + 直观视觉对比（比如前后/左右两面对照）', ban: '仅凭嘴说、无事实画面' },
    { key: 'price_math', name: '算账破防', goal: '把价格拆解为日均微小成本与巨大回报', len: '40-70 字',
      must: '去实体店/传统方案的昂贵代价 vs 拥有它每天只要几毛钱', ban: '直接干瘪报原价' },
    { key: 'urgency_call', name: '绝杀喊单指令', goal: '给出当前视频不可错过的唯一限时理由', len: '30-50 字',
      must: '明确的屏幕点击指令 + 限时/库存紧迫理由', ban: '犹犹豫豫、"有需要可以看看"' }
  ]
};

export const PRIVATE_STORY: Framework = {
  id: 'private-story',
  name: '朋友圈/私域故事种草',
  tag: '私域朋友圈',
  desc: '生活碎念引入 → 选品幕后死磕 → 用户真实救急案例 → 克制推荐与私聊邀约',
  scenes: '微信朋友圈折叠长文、主理人随笔、社群好物推荐，重真诚人设与温度',
  sections: [
    { key: 'chat_intro', name: '生活碎念引入', goal: '像老朋友深夜私信一样开篇，毫无戒备心', len: '40-70 字',
      must: '时间线或日常真实情境，温和低语的对话感', ban: '营销腔调、"惊天好消息"' },
    { key: 'behind_story', name: '幕后死磕故事', goal: '讲讲为什么非要做这件东西，中间推翻了多少版', len: '80-130 字',
      must: '讲真实的执拗、跟工厂打架或自己死磕的取舍', ban: '神化自己、虚假的完美主义' },
    { key: 'real_case', name: '真实救急案例', goal: '一个具体老朋友用它解决棘手难题的片段', len: '60-100 字',
      must: '带真实人物称呼与真实对话痕迹的救急现场', ban: '泛泛的"大家都反馈很好"' },
    { key: 'warm_invite', name: '克制私聊邀约', goal: '不强推，只留给同频人，提供私人兜底承诺', len: '30-60 字',
      must: '主理人亲自把关的诚意 + 随时微信找我聊的私聊入口', ban: '电视购物式大叫卖' }
  ]
};

export const TECH_REVIEW: Framework = {
  id: 'tech-review',
  name: '硬核测评党深度拆解',
  tag: '硬核测评',
  desc: '行业伪概念暴击 → 原理级底层拆解 → 极限实验室实测 → 优缺点坦白局 → 选购决策结论',
  scenes: '知乎专栏、数码家电/护肤成分党测评、B站图文专栏，靠理性与客观赢得信任',
  sections: [
    { key: 'myth_busting', name: '行业伪概念暴击', goal: '直击行业常见智商税与宣传噱头，建立懂行形象', len: '50-80 字',
      must: '点名某种被过度吹捧的套路或无效参数', ban: '人云亦云、不敢说实话' },
    { key: 'principle', name: '原理级底层拆解', goal: '把复杂的架构/成分原理翻译成人话和直观效果', len: '90-140 字',
      must: '底层逻辑："为什么这个设计能解决那个老毛病"', ban: '生搬维基百科、不讲人话' },
    { key: 'lab_test', name: '极限实测数据', goal: '模拟极端严苛场景，拿出无可辩驳的实测对比', len: '80-130 字',
      must: '量化数据对比（温度、分贝、留存率、时长等具体数值）', ban: '模糊的"续航很久/风力很大"' },
    { key: 'flaws', name: '优缺点坦白局', goal: '坦白客观缺点与妥协之处，换取 100% 真实信任', len: '50-80 字',
      must: '至少说明 1 个真实的小遗憾以及适合什么人不适合什么人', ban: '避重就轻、全篇吹捧无缺点' },
    { key: 'verdict', name: '选购决策结论', goal: '给读者一张清清楚楚的选购对号入座清单', len: '40-70 字',
      must: '按不同预算或痛点明确给出具体型号选择建议', ban: '模棱两可的"看个人喜好"' }
  ]
};

export const PAIN_SOLUTION: Framework = {
  id: 'pain-solution',
  name: '痛点激进化爆款落地页',
  tag: '爆款单页',
  desc: '灵魂发问连击 → 隐形成本算账 → 颠覆方案亮相 → 三重铁证压舱 → 零风险终极行动',
  scenes: '信息流广告落地页（Landing Page）、爆款直降冲量页，心理攻防严密，直奔成交',
  sections: [
    { key: 'interrogation', name: '灵魂发问连击', goal: '3个直击要害的致命连环问，让受众无法逃避', len: '40-70 字',
      must: '连环排比发问，直指最扎心的现状', ban: '客套礼貌、不痛不痒' },
    { key: 'hidden_cost', name: '隐形成本算账', goal: '算清继续拖延不解决问题的巨大隐性代价', len: '60-100 字',
      must: '健康透支、形象受损或金钱流失的具体隐形成本', ban: '空洞恐吓、不合常理的夸张' },
    { key: 'hero_solution', name: '颠覆方案亮相', goal: '产品作为强效终结者强势登场，阐述破局核心', len: '60-90 字',
      must: '单一切入点讲透革命性突破，为什么以前的办法都不行', ban: '分散讲十几个平庸功能' },
    { key: 'triple_proof', name: '三重铁证压舱', goal: '从实验室、权威机构到真实用户三层锁死信任', len: '80-120 字',
      must: '资质证书/实验室检测/万人盲测数字', ban: '无从考据的野鸡奖项' },
    { key: 'zero_risk_cta', name: '零风险终极行动', goal: '打消所有售后顾虑，给出无法拒绝的今天特权', len: '40-70 字',
      must: '退换无忧/运费险/售后兜底承诺 + 立即锁定福利指令', ban: '无保证、无行动推力' }
  ]
};

export const DEFAULT_CUSTOM_SECTIONS = [
  {
    key: 'custom-1',
    name: '抓人钩子',
    goal: '一句话打破常规认知或抛出生活反差，秒停滑屏大拇指',
    len: '20-40 字',
    must: '一个具体的生活细节或扎心反差瞬间',
    ban: '寒暄、自嗨自夸、空泛形容词'
  },
  {
    key: 'custom-2',
    name: '痛点唤醒',
    goal: '写出日常真实受罪/尴尬场景，唤起强烈共鸣',
    len: '60-90 字',
    must: '2个高频真实痛点细节，带动作或画面',
    ban: '空泛说教、无病呻吟'
  },
  {
    key: 'custom-3',
    name: '方案亮相',
    goal: '产品作为破局者登场，讲清为什么能解决那个老毛病',
    len: '60-100 字',
    must: '核心卖点 + 背后原理/成分/关键设计支撑',
    ban: '堆砌十几个平庸参数、不说人话'
  },
  {
    key: 'custom-4',
    name: '信任打底',
    goal: '打消最后一点犹豫，证明真实有效且不是营销噱头',
    len: '50-80 字',
    must: '具体数字、检测资质、权威背书或真实测评反馈',
    ban: '虚假承诺、无从考据的野鸡奖项'
  },
  {
    key: 'custom-5',
    name: '促单收口',
    goal: '给一个今天必须下手的临门一脚理由与行动推力',
    len: '30-50 字',
    must: '明确行动指令 + 售后兜底或限时福利承诺',
    ban: '生硬大叫卖、犹豫不决'
  }
];

export const CUSTOM_FRAMEWORK_TEMPLATE: Framework = {
  id: 'custom',
  name: '灵活自定段落',
  tag: '自定义',
  desc: '自由定义段落结构与各段撰写规则',
  scenes: '完全按您自定义的段落名称、目标、字数与重点交代/避坑提醒推进',
  sections: DEFAULT_CUSTOM_SECTIONS
};

export const FRAMEWORKS: Framework[] = [
  EC_DETAIL,
  REDBOOK_SEED,
  SHORT_VIDEO_SCRIPT,
  PRIVATE_STORY,
  TECH_REVIEW,
  PAIN_SOLUTION,
  CUSTOM_FRAMEWORK_TEMPLATE
];

export function getFramework(id?: string, customSections?: Framework['sections']): Framework {
  if (id === 'custom') {
    return {
      ...CUSTOM_FRAMEWORK_TEMPLATE,
      sections: customSections && customSections.length > 0 ? customSections : DEFAULT_CUSTOM_SECTIONS
    };
  }
  return FRAMEWORKS.find(f => f.id === id) || FRAMEWORKS[0];
}

const VIEW_OPTIONS = ['品牌官方', '店主本人', '资深用户种草', '成分党理性测评'];
const TONE_OPTIONS = ['克制专业', '热情口语', '高级冷淡', '亲切闺蜜', '幽默玩梗'];

export { VIEW_OPTIONS, TONE_OPTIONS };

export const THINKING_MODES = [
  {
    id: '即兴' as const,
    label: '即兴',
    sub: '直觉冲锋',
    desc: '抓住第一直觉与网感，零思考等待，快速落笔',
    instruction: '心智姿态【即兴】：抓住第一直觉与网感冲锋，行文爽脆，节奏明快，不作冗长推理，直接输出成稿。'
  },
  {
    id: '构思' as const,
    label: '构思',
    sub: '谋篇布局',
    desc: '推演受众心理与决策阻力，规划节奏，有章有法',
    instruction: '心智姿态【构思】：谋篇布局。先推演目标受众的抵触心理与决策阻力，规划起承转合的节奏，再输出条理严密的文案。'
  },
  {
    id: '深思' as const,
    label: '深思',
    sub: '底层穿透',
    desc: '彻底解构人性与品类本质，拒绝平庸，重塑价值定义',
    instruction: '心智姿态【深思】：极限穿透与底层重构。彻底解构受众深层潜意识防御与品类本质，拒绝平庸套词，重塑产品价值定义。'
  }
];

export const QUICK_INSTRUCTIONS = [
  '更口语一点',
  '更短更利落',
  '更有画面感',
  '购买欲更强',
  '换成第一人称'
];

function briefText(f: Brief): string {
  const lines: string[] = ['产品名称：' + f.name];
  if (f.sell) lines.push('核心卖点：\n' + f.sell.split('\n').filter(Boolean).map(s => '- ' + s.trim()).join('\n'));
  if (f.pain) lines.push('用户痛点：\n' + f.pain.split('\n').filter(Boolean).map(s => '- ' + s.trim()).join('\n'));
  if (f.scene) lines.push('使用场景：' + f.scene);
  if (f.proof) lines.push('信任证据：' + f.proof);
  if (f.diff) lines.push('与竞品差异：' + f.diff);
  lines.push('', '目标人群：' + f.crowd, '', '叙述视角：' + f.view, '语气：' + f.tone);
  if (f.thinkingMode) lines.push('思考心智：' + f.thinkingMode);
  lines.push('全文目标字数：约 ' + f.length + ' 字（按各段提示的比例分配）');
  return lines.join('\n');
}

function styleRules(f: Brief): string {
  const mode = THINKING_MODES.find(m => m.id === f.thinkingMode) || THINKING_MODES[1];
  const rules = [
    '只输出正文，不写任何解释、前言、后记、括号备注。',
    mode.instruction,
    '写具体的人、具体的瞬间、具体的数字；禁止堆砌空泛形容词。',
    '禁止使用"神器""必备""震惊""全网最低"这类空话。'
  ];
  if (f.ban) rules.push('绝对不要出现这些词：' + f.ban.replace(/[，,]/g, '、'));
  return rules.map(s => '- ' + s).join('\n');
}

const SYSTEM_MAIN = '你是资深电商文案操盘手，写过大量转化率稳定的详情页。你写的东西具体、克制、像人话。';
const SYSTEM_REWRITE = '你是资深电商文案操盘手。你只输出被要求改写的那一段文字，不多写别的内容。';

export function buildMainPrompt(f: Brief, framework: Framework) {
  const effectiveFw = framework.id === 'custom' && f.customSections && f.customSections.length > 0
    ? { ...framework, sections: f.customSections }
    : framework;

  const secs = effectiveFw.sections
    .map((s, i) => `${i + 1}. ${s.name}｜目标：${s.goal || '围绕核心主题自然推进'}｜建议字数：${s.len || '常规段落'}｜重点交代：${s.must || '无特殊限定'}｜避坑提醒：${s.ban || '避免空话废话'}`)
    .join('\n');
  return {
    system: SYSTEM_MAIN,
    user: [
      '# 产品与人群资料',
      briefText(f),
      '',
      '# 写作准则',
      styleRules(f),
      '',
      '# 写作结构（必须逐段写出，每段以 ###段落名 开头，段与段之间空一行）',
      secs,
      '',
      '现在开始写。'
    ].join('\n')
  };
}

/** 选中改写：把全文当上下文，只要求输出被选中部分的新版本 */
export function buildRewritePrompt(f: Brief, fullText: string, selected: string, instruction: string) {
  return {
    system: SYSTEM_REWRITE,
    user: [
      '# 产品与人群资料',
      briefText(f),
      '',
      '# 全文（供你理解上下文和语气）',
      fullText.slice(0, 4000),
      '',
      '# 需要改写的片段',
      selected,
      '',
      '# 改写要求',
      instruction,
      '',
      '# 输出',
      '只输出改写后的片段本身，不要引号包裹，不要解释，不要重复要求。保持与全文一致的语气。'
    ].join('\n')
  };
}

export function buildTitlePrompt(f: Brief) {
  return {
    system: '你是电商标题写手，擅长短句抓人。只输出结果，不加解释。',
    user: [
      '# 产品与人群资料',
      briefText(f),
      '',
      '# 任务',
      '写 5 条商品标题 / 主图短句，每条不超过 20 字，5 条风格必须各不相同（痛点型、数字型、场景型、反常识型、指令型）。',
      '禁止：' + (f.ban || '神器、必备、震惊'),
      '',
      '输出格式：每行一条，用「1. 」开头，不要标题、不要解释。'
    ].join('\n')
  };
}
