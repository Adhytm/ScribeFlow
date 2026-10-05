# 项目现状与改造分析报告 · 一键文案撰写（v2 全栈版）

> 审查日期：2026-10-05
> 审查范围：`copywriter/` 全部前端源码（App.tsx、Editor/、GeneratePanel/、History/、services/、prompts/、types/、styles.css 1587 行）+ 服务端（server/handler.ts、server/index.ts）+ 根目录 v1 遗留版（index.html）
> 验证方式：TypeScript typecheck（PASS）+ Vite dev server 真机运行 + playwright-core（系统 Edge headless）截图 11 张 + 行为验证脚本 2 个
> 本报告不含任何代码修改，仅供后续执行模型按任务清单实施。

**证据标注约定**：
- 【已确认】= 代码实读 + 运行时验证双重证据
- 【代码确认】= 代码路径实读确认，未做运行时触发
- 【高概率】= 基于代码逻辑推断，需执行时复核
- 【设计建议】= 非缺陷，属方案取舍
- 【待核实】= 无法从现有代码确认，报告中注明核实方法

---

# 一、项目总体现状

## 1.1 项目画像

**解决什么问题**：电商/私域从业者用 LLM 快速产出结构化营销文案（详情页、小红书、短视频口播、朋友圈、测评、落地页），并支持对成稿做「划词局部改写 → Diff 预览 → 接受/拒绝」的精修闭环，以及版本快照回溯与本地文件夹自动落盘。

**核心用户**：单人使用的电商文案写手/店主/私域运营。产品是**单机本地工具**（服务端绑 127.0.0.1，无鉴权、无多用户、无数据库），BYOK 模式（用户自带各家 LLM API Key，或用本地 Ollama/LM Studio 免密模型）。

**主要业务流程**：

```
配置服务商(顶栏 popover，Key 存 localStorage 或服务端 .env)
  → 左栏选文案框架(7 种预设/自定义分段) + 填 brief(产品名/人群/卖点/痛点/场景/证据/风格/心智)
  → 「生成文案」→ 前端 POST /api/llm → 服务端按协议适配(Anthropic/Gemini/OpenAI兼容/本地)转发上游
  → SSE 流式回中栏 Tiptap 编辑器（按 ### 标题切分为 h2+段落）
  → 划词选中 → 浮出工具条(快捷指令/自定义要求) → 建议以 streaming→pending 状态进右栏 Diff 卡片
  → 接受(坐标重映射后精准替换) / 拒绝
  → 每次生成/接受/手动存版自动产生快照(localStorage 上限 60 条)
  → 可选绑定本地文件夹(File System Access API) 每版自动落盘 .md
  → 历史面板载入/导出/删除快照
```

**已成熟的能力**：
- Canvas 式划词改写引擎（`suggestionPlugin.ts`）：ProseMirror transaction mapping 坐标重映射、原文比对防幽灵建议、inline decoration 高亮——这是全项目技术含量最高、最完整的模块。
- 服务端代理层（`server/handler.ts`）：多协议适配、域名白名单防 SSRF 凭证外泄、客户端断连立即中断上游、45s 空闲超时 + 60s 首包超时、连通性探针。安全意识高于同类个人工具平均水平。
- 设计 token 体系（`styles.css` 顶部）：双主题完整变量（色板/线框/阴影/圆角/字体栈/滚动条），按钮体系（primary/sm/ghost/hot）统一。

**半成品状态的能力**：
- 快照系统：能存能载入能导出，但无产品维度、版本号是列表下标、无覆盖保护、无写满告警——语义层全是洞（详见 P0-1、P1-2、P1-6）。
- 错误反馈：只有顶栏一个 status 字符串，长错误被 CSS 截断（P1-5）。
- 服务商预设：DashScope 默认端点必 404（P1-3）；各厂商「预设」默认模型名疑似虚构（P1-4）。

**「能用但明显不成熟」的地方**：
- 当前稿导出：编辑器里的成品没有任何一键复制/导出按钮，必须先存版再去历史里导出（P1-1）。
- 反馈体系：用 `window.confirm`/`alert` 原生弹窗，与整体 Apple 风视觉完全割裂（设计系统缺 Feedback 层）。
- 标题功能：生成 5 条标题 → 顶部胶囊条展示，不能单条复制、不能关闭、复制内容与展示格式不一致（P2-9）。
- v1/v2 双版本并存：根目录 `index.html` 是功能完整的旧版，README 称「永久归档保留」，但双击根目录文件进入的是旧版，入口混淆（P3）。

**当前设计语言**：Apple HIG 取向的深色优先双主题（Space Black / macOS 浅白），磨砂顶栏、纸张画布编辑器、大圆角卡片、细边框、克制的蓝（#2997ff / #0071e3）单强调色。方向正确，执行约 70 分。

**与成熟商业化产品的差距**：视觉与核心交互创意已经不拖后腿，差距集中在**业务可靠性**（丢稿风险）、**反馈系统**（错误/状态/确认三层缺失）和**预设可用性**（开箱即败）三块。补上这三块可视为「成熟的个人商业工具」；要成为多用户 SaaS 则另需账户/数据层，不在本次范围内。

**最大短板**：**数据安全护栏缺失**——核心资产（用户改了一半的稿子）在「重新生成」和「单击历史卡片」两个高频动作下可以被无确认、不可恢复地销毁（P0-1）。

---

# 二、问题总览

## P0 严重问题
| 编号 | 问题 | 证据 |
|---|---|---|
| P0-1 | 「生成文案」与「单击历史快照」均无确认覆盖编辑器正文，覆盖前不自动存版，手动修改可永久丢失 | 【已确认】 |

## P1 重要问题
| 编号 | 问题 | 证据 |
|---|---|---|
| P1-1 | 当前稿无「复制全文/导出」入口，导出不闭环（v1 有，v2 退化） | 【已确认】 |
| P1-2 | 快照无产品/项目维度，60 上限全混放，多产品场景破裂 | 【代码确认】 |
| P1-3 | DashScope 预设默认端点拼出 `/api/v1/chat/completions`，必 404 | 【代码确认，待一次实机探针复核】 |
| P1-4 | 各厂商「预设」默认模型名疑似未在售型号，首用大概率 model_not_found | 【高概率】 |
| P1-5 | 错误只进顶栏 40% 宽胶囊，截断、无 tooltip、无详情，用户无法自助排障 | 【已确认】 |
| P1-6 | 版本号 = 当前列表长度，删除任一版本后全体漂移，不可引用 | 【代码确认】 |

## P2 体验与设计问题
| 编号 | 问题 | 证据 |
|---|---|---|
| P2-1 | pending 建议三条静默销毁路径（重新生成 clear / 编辑原文后 filter 作废 / 重叠建议接受其一后另一条消失） | 【代码确认】 |
| P2-2 | 点击建议卡片定位正文会连带弹出划词工具条 | 【高概率】 |
| P2-3 | 载入快照后修改正文，历史里该版仍标「当前」 | 【代码确认】 |
| P2-4 | 快照只回滚 name/crowd，不回滚 frameworkId/sell/pain/scene 等，改写上下文仍会张冠李戴 | 【代码确认】 |
| P2-5 | API 弹层不支持点击外部/Esc 关闭 | 【代码确认】 |
| P2-6 | 「停止」按钮在顶栏最右远离生成按钮；生成全程无进度反馈 | 【已确认】 |
| P2-7 | ≤1100px 塌单栏后编辑器被埋在一屏半表单之下，无跳转 | 【已确认（截图）】 |
| P2-8 | localStorage 写满静默降级到 15 版，无任何提示 | 【代码确认】 |
| P2-9 | 标题条不能单条复制/不能关闭；「复制」复制带编号原文，展示去编号，所见≠所得 | 【代码确认】 |
| P2-10 | 深思模式 × 推理模型存在被 45s 空闲/60s 首包超时误杀的窗口 | 【高概率】 |
| P2-11 | 反馈体系用 window.confirm/alert 原生弹窗，与视觉体系割裂；无 Toast/Tooltip/ConfirmDialog 组件 | 【已确认】 |

## P3 可选增强
| 编号 | 问题 |
|---|---|
| P3-1 | v1 旧版与 v2 并存，入口混淆，建议移入 `legacy/` |
| P3-2 | `resolveApiKey` 跨厂商回退 OPENAI_API_KEY，401 时误导排查 |
| P3-3 | 死代码/小不一致：`settings.temperature` 无人使用；`.api-detail` inline width 380 覆盖 CSS 400；openai-responses 协议服务端支持但前端无入口 |
| P3-4 | 启动日志只按 OPENAI_API_KEY 判定 Key 状态 |
| P3-5 | 超宽屏（>2000px）中栏固定 820px，两侧大片留白 |
| P3-6 | 标题生成温度硬编码 1.0，不随用户设置 |

---

# 三、逐项分析问题（P0/P1 全量，P2/P3 合并详述）

## 问题 P0-1：覆盖正文无确认、无自动存版护栏

**问题位置**：
- `src/App.tsx` `generate()`（约 L158-206）：流式回调里 `editor.commands.setContent(...)` 直接覆写；
- `src/components/History/HistoryPanel.tsx` L76：历史卡片整卡 `onClick={() => onLoad(s)}`；
- `src/App.tsx` `loadSnapshot()`（L327-348）：`editor.commands.setContent(s.html, false)` 直接覆写。

**当前表现**：点「生成文案」后编辑器内容立即被流式输出替换；在历史面板任意位置单击某版本，编辑器立即被该版本替换。两个动作均无确认弹窗，覆盖前均不保存当前编辑器内容。快照只在「生成完成 / 接受改写 / 加标题 / 手动存一版」时产生——**用户在编辑器里的手动修改从不进入快照**。

**问题本质**：表面是「缺确认弹窗」，根因是**快照系统没有「未保存变更」的概念**：系统不区分「编辑器当前内容」与「最近一个快照」，也不把手动编辑视为需要保护的资产。`hadBefore` 变量（L170）只用于给快照打「初稿/重新生成」标签，不做保护。

**用户影响**：真实写手是「AI 出稿 + 人肉精修」混合作业。精修 20 分钟后误点历史卡片或顺手点重新生成，全部手改永久蒸发、无法撤销（`setContent` 同时重置 ProseMirror 撤销栈，Ctrl+Z 救不回）。丢稿一次即弃用。

**业务影响**：直接数据丢失，击穿产品最核心的「版本可回溯」承诺（品牌副标题就是「版本可回溯」）。

**建议方案**：
1. 新增 `isDirty()` 判断：比较 `editor.getHTML()` 与最近一个快照的 `html`（首版不存在时与空串比较）。
2. `generate()` 与 `loadSnapshot()` 执行覆盖前：若 dirty，先自动 `pushSnap('覆盖前自动备份')` 再执行；若 localStorage 满导致备份失败，弹确认「备份失败，仍要覆盖吗？」。
3. 历史卡片交互改分层：整卡单击仅选中/预览（或无副作用），「载入此版」改为显式按钮，按钮内同样走 dirty 护栏。
4. 顺带保留 undo 兜底：覆盖前把旧 HTML 存入一个内存级 `lastOverwrittenHtml`，状态条提供一次性「撤销覆盖」。（可选，护栏已足够时降级为 P3）

**修改原因**：自动备份优于确认弹窗——确认弹窗把判断负担推给用户且打断流，自动备份零成本零打断，与产品「每步都自动存版」的既有心智一致。

**修改风险**：快照数量增长变快（每次覆盖多一版），60 上限更快触顶 → 依赖 P1-2 的分组/上限治理同步做；`pushSnap` 现有去重逻辑无变化，连续重复覆盖会产生内容相同的快照，可加「与最新快照内容相同则跳过」去重。

**优先级**：P0

---

## 问题 P1-1：当前稿无复制/导出，导出不闭环

**问题位置**：`src/App.tsx` 中栏 JSX（L462-490）——`titles-strip` 与 `EditorPane` 之外无任何导出按钮；`services/storage.ts` 有 `download()`/`snapshotMarkdown()` 但只服务于快照。真机验证：页面无「复制全文」，历史外「导出」按钮数为 0。【已确认】

**当前表现**：用户精修完当前稿，要拿走文字只有三条路：① 手动全选编辑器复制（带富文本格式，粘贴目标可能不想要）；② 点「存一版」→ 切到历史 tab → 找到最新版 → 点「导出」；③ 绑定文件夹等自动落盘。

**问题本质**：v1→v2 重写时把 v1 的 out-bar（复制全文/导出 .md/导出 .txt）整个丢了，而 v2 的「快照导出」被当成了替代品——但快照导出的是**历史版本**，不是**当前工作稿**，两者语义不同。这是「迁移时功能清单未对齐」的根因（见第九节根因 D）的一个表现。

**用户影响**：文案工具的终点是「把文字拿走贴到电商后台/小红书」。终点被藏在 4 步操作之后，且没人告诉用户这条路。

**业务影响**：核心闭环的最后一环断裂；高频操作（每次出稿都要做）成本 ×4。

**建议方案**：在中栏底部统计栏（`.editor-stat-bar`）左侧或编辑器右上角加两个低噪按钮：「复制全文」（复制纯文本，`editor.getText()` 按段落 `\n\n` 拼接）「导出 .md」（复用现有 `download()`，正文用当前编辑器内容、标题条内容附上）。编辑器为空时禁用。

**修改原因**：统计栏是已存在的承托结构，放导出动作不增加视觉层级负担；纯文本复制符合粘贴到电商后台的真实场景。

**修改风险**：极低，纯增量。注意与 P0-1 的护栏无耦合。

**优先级**：P1

---

## 问题 P1-2：快照无产品维度

**问题位置**：`src/services/storage.ts` `pushSnapshot()` 单一 `cw.snapshots` 列表（上限 60）；`src/types/document.ts` `Snapshot.product` 字段已存在但 UI 未消费；`src/components/History/HistoryPanel.tsx` 无分组/筛选。

**当前表现**：所有产品、所有框架的快照混在一个列表，按时间倒序，找历史靠肉眼扫 80 字预览。60 条上限共享，写产品 B 时产品 A 的老快照被悄悄顶掉（截断无任何提示）。

**问题本质**：数据模型已经有 `product` 字段（说明设计时想过），但**信息架构没跟上**：列表是「时间流」而非「资产库」。对多产品用户，历史面板不是版本管理器，是个不断被稀释的流水账。

**用户影响**：重度用户一周内列表变垃圾场；跨产品找历史低效；老产品历史无声丢失。

**业务影响**：影响留存与专业度；是 P0-1 护栏落地的前置依赖（自动备份会加速触顶）。

**建议方案**：
1. 最小方案（推荐先做）：历史面板顶部加产品筛选器——从快照的 `product` 值去重生成下拉/芯片组，默认「当前产品」（`brief.name`），可切「全部」。上限改为每产品 60。
2. 完整方案：快照列表按 `product` 分组渲染（分组头显示产品名+版数），空产品名归入「未命名」。
3. 截断/降级时 toast 提示（与 P2-8 合并处理）。

**修改原因**：筛选器方案改动小（只动 HistoryPanel + storage 两个文件），覆盖 90% 场景；分组渲染视觉成本高，可后续迭代。

**修改风险**：`pushSnapshot` 的上限逻辑改为按产品计数会影响现有 60 条存量数据的展示顺序，需一次性迁移（读取后按 product 分组重存）；低。

**优先级**：P1

---

## 问题 P1-3：DashScope 默认端点必 404

**问题位置**：`src/services/storage.ts` `DEFAULT_PROVIDER_CONFIGS.dashscope.base = 'https://dashscope.aliyuncs.com/api/v1'`（L24-26）；`src/components/GeneratePanel/ApiSettings.tsx` dashscope `urls[0]` 同值（L57）；`server/handler.ts` `buildOpenAiUrl()` 直接在其后拼 `/chat/completions`。

**当前表现**：选 DashScope 预设、填 Key、点生成 → 请求发往 `https://dashscope.aliyuncs.com/api/v1/chat/completions`。阿里云 DashScope 的 OpenAI 兼容端点是 `/compatible-mode/v1`（正确值就躺在 chip 第二选项里），`/api/v1` 是其原生 API 前缀（原生路径形如 `/api/v1/services/aigc/text-generation/generation`），拼接结果不存在 → 404。

**问题本质**：预设的「默认值」与「可选值」放反了——把不可用于 OpenAI 兼容协议的原生端点设为默认，把兼容端点降为备选。【代码确认；建议执行时先跑一次 test-connection 实机复核，若阿里后来加了兼容路径则降级】

**用户影响**：选 DashScope 的用户第一次使用必失败，且 404 错误经 P1-5 的截断胶囊展示后几乎不可读。

**业务影响**：预设可用性直接决定新用户首日留存。

**建议方案**：`DEFAULT_PROVIDER_CONFIGS.dashscope.base` 改为 `https://dashscope.aliyuncs.com/compatible-mode/v1`；`ApiSettings.tsx` 中 urls 顺序对调，label 改为「OpenAI 兼容端点（推荐）」「原生 API 前缀（勿直接用于本工具）」。同时检查 `aliyun-token-plan`（其 base 已是 compatible-mode，无误）。

**修改原因**：默认值必须是「填了 Key 就能跑」的那个。

**修改风险**：无；已手动改过 base 的老用户配置存在 localStorage 里，不受影响（loadSettings 是 mergedProviders = defaults 被用户值覆盖）。

**优先级**：P1

---

## 问题 P1-4：各厂商「预设」默认模型名疑似未在售型号

**问题位置**：`src/services/storage.ts` `DEFAULT_PROVIDER_CONFIGS`（L12-63）与 `ApiSettings.tsx` `SERVICE_PRESETS` 各 `models` 数组中标注「(预设)」的项：

| 厂商 | 预设默认模型 | 同列表里的常见在役型号 |
|---|---|---|
| local | `qwen3.8-27b` | qwen2.5:7b / qwen2.5:14b / llama3.1:8b |
| moonshot | `kimi-k3` | moonshot-v1-8k / moonshot-v1-32k |
| dashscope | `qwen3.8-max` | qwen-plus / qwen-max / qwen-turbo |
| gemini | `gemini-3.1-pro` | gemini-2.0-flash / gemini-1.5-pro |
| zhipu | `glm-5.3` | glm-4-flash / glm-4-plus |
| deepseek | `DeepSeek-V4.1-Flash` | deepseek-chat / deepseek-reasoner |
| openai | `gpt-6-astra` | gpt-4o / gpt-4o-mini / o3-mini |
| anthropic | `claude-sonnet-5` | claude-3-5-sonnet-20241022 |

**当前表现**：新用户填完 Key 直接点生成，发到上游的 model 是「(预设)」那一项。

**问题本质**：`FRONTEND_DESIGN_AND_LOGIC.md` 第 10 条声称「补全现网真实推荐模型……不再出现 model_not_found」，但补全的方式是把真实型号放进 chip 列表，**默认值却仍是来源不明的命名**（命名风格像占位/推测名）。文档承诺与实现不一致。

**待核实**：这些型号是否真实在售无法从代码确认。核实方法：对每个厂商跑一次 `test-connection`（探针走的就是 max_tokens=1 的真实调用），或查各平台 `/models` 列表。本报告按【高概率】处理：8 个默认值里只要有几个是虚构名，对应渠道首用必败。

**用户影响**：第一印象 = 「这工具是坏的」。

**建议方案**：核实后把每个 `DEFAULT_PROVIDER_CONFIGS[x].model` 与预设 `models[0]` 统一改为该厂商当前已验证在售的主力型号；实验性型号若保留则明确标注「未验证」。

**修改原因**：默认值的可验证性高于先进性；用户要尝鲜可以自己选 chip。

**修改风险**：服务端 `handler.ts` 的 GET 分支、`resolveApiKey`、`openAiPayload` 里也有同款硬编码模型名（L296-305、L484、L531、L826 等），需一并替换，否则前端改了服务端兜底仍发旧名。低风险。

**优先级**：P1

---

## 问题 P1-5：错误反馈通道只有一条被截断的状态字符串

**问题位置**：`src/App.tsx` 所有 catch 都 `setStatus('失败：' + err.message)`（L201、L232、L273）；`.pill` CSS（styles.css L282-299）`max-width: 40%; text-overflow: ellipsis;`，元素无 `title` 属性；服务端 `sendJson` 返回的 `error`+`detail`（上游错误原文最多 500 字）经 `llm.ts post()` 拼进 message 后被胶囊截断。

**当前表现**：生成失败时用户在顶栏看到形如「失败：上游返回 4…」的截断文本，完整原因（模型名错？Key 错？限流？）不可见、不可复制。v1 用 `alert` 展示完整错误，v2 退化。【已确认】

**问题本质**：**反馈系统缺一层**。当前架构里 `status` 一个字符串同时承担：就绪态、进度态、成功态、错误态四种语义，且容器按「就绪摘要」的尺寸设计。错误信息需要的是「可展开、可复制、有时效」的通知通道，不是状态标签。

**用户影响**：失败 = 死胡同。无法自助排障，要么乱试要么放弃。

**业务影响**：API 类工具失败是常态（Key 错/限流/端点错），失败体验决定工具可信度。

**建议方案**：引入轻量 Toast/通知条组件（这也是 P2-11 设计系统缺口的落地）：
- 成功/进度：仍走状态胶囊（语义不变）。
- 失败：胶囊变红显摘要 + 弹出通知条（完整错误 + 「复制错误信息」按钮 + 8s 自动消失可手关）。
- 通知组件放 `src/components/Feedback/Toast.tsx`，全局单例，App 层用 `notify(type, msg)` 调用。

**修改原因**：分离「状态」与「通知」两种语义；通知条是后续所有失败场景（P2-1 建议作废提示、P2-8 写满告警、P0-1 备份失败确认）的公共地基。

**修改风险**：需把现有所有 `setStatus('失败…')` 调用点改为 `notify`，共约 6 处，机械替换；低。

**优先级**：P1

---

## 问题 P1-6：版本号是列表下标，删除后全体漂移

**问题位置**：`HistoryPanel.tsx` L74 `const no = items.length - i;`；`App.tsx` `pushSnap` 返回 `storage.pushSnapshot()` 的返回值即 `list.length`；`storage.ts` `pushSnapshot` L100 `return list.length`。

**当前表现**：有 5 个快照时最新版显示 v5；删除其中任意一个，全部重排，原 v5 变 v4。「已存 v3」这样的状态提示指向的是一个会变的数字。落盘文件名用时间戳命名，与 v 号又是另一套体系。

**问题本质**：版本号没有持久化——它是渲染时算的视图属性，不是数据属性。版本号的全部价值在于「可引用、可对比、可回指」，下标化之后三个价值全灭。

**用户影响**：用户无法对协作者（或对自己）说「用 v12 那版」；导出合集中的 v 号与面板里的 v 号在删除操作后对不上。

**业务影响**：版本回溯是产品核心卖点之一，语义缺陷直接削弱卖点可信度。

**建议方案**：`Snapshot` 增加 `seq: number`（持久自增，存 `cw.snapSeq` 计数器）；UI 展示 `v{seq}`；`exportAllSnaps`、落盘文件名同步使用 `seq`。存量数据迁移：读取时无 `seq` 的按时间顺序补号。

**修改原因**：版本号必须是数据而非视图。

**修改风险**：迁移逻辑需处理老数据；`pushSnap` 返回值语义改为 seq，调用点 3 处展示文本同步改；低。

**优先级**：P1

---

## P2 逐项（压缩格式：位置 / 表现与本质 / 方案 / 风险）

### P2-1 pending 建议静默销毁（三条路径）
- **位置**：`App.tsx` `generate()` L171 `dispatchSuggestion({type:'clear'})`；`suggestionPlugin.ts` L49-51 原文比对 filter；`accept()`/`acceptAll()` 后 mapping 使重叠建议失配。
- **表现与本质**：①重新生成直接清空所有待确认建议无提示；②用户在建议范围内手改一个字，该建议被 filter 静默作废；③选中两段重叠文本各改一次，接受其一时另一条无声消失。三条都是「系统替用户丢弃了 AI 产出物而用户不知情」。
- **方案**：`generate()` 有 pending 建议时先 toast 确认（或自动把 pending 建议存成一个快照再清）；filter 作废时在 App 层检测 items 减少且非显式 remove → toast「原文已修改，建议『X』已失效」；`rewrite()` 入口检测与现有 pending 建议坐标重叠 → toast 提示并拒绝创建或先清理旧建议。
- **风险**：filter 在 plugin 层，提示在 App 层，需要通过 sync 对比前后 items 差集实现，注意别在用户主动 reject 时误报（reject 走 meta remove，可区分）。中。

### P2-2 点击建议卡片弹出划词工具条
- **位置**：`App.tsx` `focusSuggestion()` L323 `setTextSelection({from,to})` → `Editor.tsx` `update()` 监听 selectionUpdate → `setSel` 非空 → 工具条出现。
- **表现与本质**：定位动作被工具条系统误认为「用户想改写」，每次看建议都弹一个不需要的气泡。
- **方案**：`focusSuggestion` 改为先 `setTextSelection({from,to})` 高亮 + `scrollIntoView`，随后下一帧 `setTextSelection(to)` 折叠光标；或 EditorPane 的 update 里忽略「程序性选区」（用一个 ref 标记跳过一次）。
- **风险**：选区折叠时机与 ProseMirror transaction 时序相关，需真机验证工具条不再闪弹。低。

### P2-3 「当前」标记不随内容偏离失效
- **位置**：`App.tsx` `currentId` 只在 pushSnap/loadSnapshot/delete 时更新；编辑器手动修改不清除。
- **方案**：在 `onUpdate` 里（或 scheduleSave 处）检测内容与 currentId 快照 html 不一致 → `setCurrentId(null)`；或更温和：标记改显「基于 vN 修改中」。
- **风险**：`onUpdate` 每击键触发，比较需节流（并入现有 600ms scheduleSave 即可）。低。

### P2-4 快照只回滚 name/crowd
- **位置**：`types/document.ts` `Snapshot` 无 brief 全量字段；`App.tsx` `loadSnapshot` L336-346 只回写 name/crowd。
- **表现与本质**：FRONTEND_DESIGN 文档第 6 条修过「载入快照后改写张冠李戴」，但只修了两个字段——载入 A 的快照后，prompt 里的卖点/痛点/场景/证据/框架仍是 B 的。修复不完整。
- **方案**：`Snapshot` 增加 `brief: Brief` 全量快照（pushSnap 时存）；loadSnapshot 整体回滚 brief。老数据无 brief 字段时保持现行为（回滚 name/crowd）。
- **风险**：快照体积增大（brief 约 1-2KB × 60），加剧 localStorage 压力，与 P1-2/P2-8 联动。低。

### P2-5 API 弹层不能点外/Esc 关闭
- **位置**：`ApiSettings.tsx` L215-219，开关只靠按钮 toggle。
- **方案**：open 时挂 document mousedown（判断 target 在 `.api-box` 外）与 keydown Esc 监听，关闭时移除。
- **风险**：注意与弹层内 select 原生下拉、测试按钮交互不冲突。低。

### P2-6 停止按钮位置与零进度反馈
- **位置**：`App.tsx` L440 `{busy && <button className="sm" …>停止</button>}` 在顶栏最右；左栏「生成文案」在 340px 列底部。
- **表现与本质**：生成 30-60s 期间，用户视线在编辑器流式文字上，「停止」在一臂之外；且全程无「已输出 X 字」进度感，长生成像卡死。
- **方案**：生成中把左栏主按钮原位变为「停止生成」（danger 样式）；状态胶囊文本带实时字数（流式回调里已有 full.length，throttle 进 status）。
- **风险**：generate/rewrite/genTitles 共用 busy，需区分 busyKind。低。

### P2-7 ≤1100px 单栏布局埋没编辑器
- **位置**：`styles.css` L1560-1587 媒体查询：三栏变单列，顺序为表单→编辑器→右栏。【已确认：900px 截图】
- **表现与本质**：窄屏下用户要滚过一屏半表单才能看到编辑器；本质是「布局塌了但没有替代导航」。
- **方案**：单栏模式顶部加 sticky 分段 tab：「设置 / 编辑器 / 建议·历史」，点击锚点跳转或切换显示。
- **风险**：只影响 ≤1100px 的 CSS/DOM 结构，桌面三栏不动。中（需新增一个窄屏导航组件）。

### P2-8 localStorage 写满静默降级
- **位置**：`storage.ts` `pushSnapshot` L100-102：写失败 → 截到 15 条再写，无返回值区分、无提示。
- **方案**：返回 `{seq, degraded: boolean}` 或在 storage 层抛出自定义事件，App 层 toast「本地空间不足，已只保留最近 15 版，建议导出备份」（v1 有此提示，v2 丢了）。
- **风险**：pushSnapshot 返回值语义变化，与 P1-6 的 seq 改造合并做。低。

### P2-9 标题条三处不一致
- **位置**：`App.tsx` L463-483 titles-strip。
- **表现**：①不能单条复制（只有整体复制）；②不能关闭（生成新稿才消失）；③「复制」复制的是 `titles` 原始字符串（带「1. 」编号），而界面展示用正则去了编号——所见≠所得。
- **方案**：每个 `.ts-item` 点击即复制该条（去编号后文本）+ 复制反馈；条尾加 ✕ 关闭；整体复制按钮复制去编号版本。
- **风险**：极低。

### P2-10 深思模式 × 推理模型的超时误杀窗口
- **位置**：`server/handler.ts` `IDLE_TIMEOUT_MS = 45_000`（L239）、`UPSTREAM_TIMEOUT_MS = 60_000`（L577）；`App.tsx` thinkingMode 传至服务端，Anthropic 分支开 thinking budget，OpenAI 兼容分支对 o1/o3/gpt-6 加 reasoning_effort。
- **表现与本质**：长思考模型首 token 可能 >60s（首包超时直接 abort）、推理间隙可能 >45s（空闲超时写 error 帧）。深思模式的产品承诺与超时预算不匹配。【高概率：多数推理模型流式持续输出 reasoning，实际触发率取决于厂商行为，需实测】
- **方案**：`thinkingMode === '深思'` 时前端在请求体带 `longThinking: true`，服务端据此把两个超时放宽（如首包 180s / 空闲 90s），或用 SSE 心跳保活替代固定空闲超时。
- **风险**：放宽超时后「真卡死」场景等待变长；可接受，有手动停止。低。

### P2-11 反馈层缺失（confirm/alert 原生弹窗 + 无 Toast/Tooltip）
- **位置**：`HistoryPanel.tsx` window.confirm ×2；`App.tsx` alert ×2（绑定文件夹失败）；无 Toast/Tooltip 组件。
- **表现与本质**：原生弹窗样式与 Apple 风界面完全割裂，且阻塞式 alert 打断流。根因是设计系统缺 Feedback 层（见第七节）。
- **方案**：随 P1-5 建 `components/Feedback/`：Toast（通知）、ConfirmDialog（替代 window.confirm，Promise 化 API）、Tooltip（胶囊/图标说明）。替换全部 confirm/alert 调用点。
- **风险**：ConfirmDialog 为异步替换同步 confirm，调用点改 then/await，共 2 处。中低。

---

# 四、业务逻辑专项审查结论

## 4.1 核心流程闭环检查（全程走查）

| 流程 | 闭环状态 | 断点 |
|---|---|---|
| 配置→生成→成稿 | ✅ 闭环（预设可用时） | P1-3/P1-4 预设断点 |
| 生成→精修→定稿→**拿走** | ❌ 断在最后一环 | P1-1 无导出 |
| 生成→精修→**意外覆盖**→找回 | ❌ 断 | P0-1 手动修改无快照 |
| 多产品并行写作→历史回溯 | ⚠️ 半断 | P1-2 无分组 |
| 快照→落盘→刷新后续接 | ✅ 已修复（待授权→点击授权） | — |
| 改写→接受/拒绝 | ✅ 闭环完整 | P2-1 边缘静默销毁 |

## 4.2 状态管理

- **busy 单布尔承担三种任务**（generate/genTitles/rewrite 互斥）：重复点击被禁用防住了，但「停止」只有一个 abortRef，状态本身无类型。【代码确认，现状可用，P2-6 改造时引入 busyKind】
- **建议状态机** streaming→pending→(accepted/rejected)：定义清晰；但销毁路径有三个入口（clear/remove/filter），filter 是隐式的（P2-1）。
- **前后端状态一致性**：本架构无服务端状态（无数据库），状态全在 localStorage + 内存，刷新后 doc/brief/titles/settings 均恢复，一致性设计合格。
- **网络失败后状态**：`streamChat` 失败抛错 → status 置失败，编辑器保留流式半程内容但**不产生快照、不清除**——编辑器里是「半成品 + 旧内容被毁」的混合态，只有旧快照能回滚（若有）。属 P0-1 的衍生场景。
- **重复提交**：按钮 disabled 防护完整；`pushSnapshot` 无幂等去重，连点「存一版」会产生多个内容相同的快照。【代码确认，低危，建议顺手加内容去重】

## 4.3 异常流程覆盖

| 场景 | 现状 |
|---|---|
| 空数据（空编辑器/空历史/空建议） | ✅ 三处空态文案均在，质量良好 |
| API 失败 | ⚠️ 有错误文本但被截断（P1-5） |
| 用户取消（停止） | ✅ abort 链路完整，服务端同步中断上游 |
| localStorage 写满 | ❌ 静默降级（P2-8） |
| 模型输出格式异常（无 ###） | ✅ 已修复并有测试（verify-frontend-fixes.mjs） |
| 浏览器不支持 File System Access | ✅ 有降级提示 |
| 刷新后落盘句柄失效 | ✅ 有「点击授权」续接 |
| 部分成功（改写流中断） | ✅ 建议被 remove，不产生半成品建议 |
| 长 Loading | ⚠️ 无进度反馈（P2-6） |
| 权限不足（文件夹授权被拒） | ⚠️ autoSaveSnapshotToFile catch 后仅 console.warn，用户无感知【代码确认，建议并入 Toast】 |

## 4.4 数据一致性

- 无数据库，一致性风险集中在 localStorage 三键（snapshots/doc/brief/titles）：doc 用 600ms 防抖写，**浏览器崩溃时最多丢 600ms 的手动输入**——可接受。【代码确认】
- `pushSnap` 里显式 `saveDoc`（注释说明了原因），生成/接受类 setContent 不丢。【代码确认】
- 快照删除/清空不级联删除已落盘的 .md 文件——合理（落盘是备份语义），但用户可能误以为同步删除，可在文案上注明。【设计建议】
- 孤儿数据：解绑文件夹只清 `cw.dirBound`，无残留；快照无外部引用，无孤儿问题。

---

# 五、前端交互专项：核心任务成本核算

以「第一次使用的用户完成一篇精修稿并拿走」计：

| 步骤 | 点击/理解成本 | 问题 |
|---|---|---|
| 配 API | 开 popover→选预设→填 Key→（可选）测试 = 3-4 次 | 合理；但默认模型可能让其失败（P1-4） |
| 填 brief | 必填 2 项，提示文案优秀（「所有人只会换来正确的废话」） | 好 |
| 生成 | 1 次 | 等待期无进度（P2-6） |
| 划词改写 | 选中→点指令 = 2 次，看建议→接受 = 1 次 | 路径优秀，是产品亮点 |
| **拿走成稿** | 存一版→切 tab→找到版本→导出 = **4 次 + 理解快照概念** | P1-1，应 = 1 次 |
| 找回误覆盖内容 | **不可能** | P0-1 |

**反直觉点清单**：
1. 历史卡片整卡单击 = 载入覆盖（破坏性动作挂在最低操作成本的手势上）——P0-1。
2. 点建议卡片 = 看详情，却弹出改写工具条——P2-2。
3. 复制标题得到的是带编号文本，与看到的不一样——P2-9。
4. 「版本 N」徽章数字会随删除变化——P1-6。
5. 状态胶囊看着像标签，实际是唯一的错误输出渠道，但读不全——P1-5。

**暴露给用户的技术概念**：「服务端 Key 状态」「Base URL」「token plan」「Interactions API 端点」——对目标用户（文案从业者）偏硬核。可接受（BYOK 工具的受众自带一定技术力），但 label 可再人话化（P3 级）。

---

# 六、视觉与商业化设计专项

**总体**：方向正确（Apple HIG 深色优先），执行 70 分。问题不在「不够 Apple」，在少数破差点。

**最弱的区域**：
1. **历史卡片**（`.hs-item`）：版本号胶囊+标签+时间+预览+两行按钮挤在 330px 列里，信息密度全站最高；【设计建议】预览文本可减到一行，按钮收敛为 hover 显现。
2. **标题条**（`.titles-strip`）：蓝底（--ac-soft）+ 蓝边框胶囊栏横在编辑器正上方，是全中栏视觉重量最大的元素，但它只是辅助产出物；且 `backdrop-filter: blur(16px)` 用在一个不浮在任何滚动内容之上的静态块——**无效毛玻璃**，应去蓝底改中性卡片、去 blur。
3. **顶栏**：brand + 状态胶囊 + 主题三段开关 + 服务商按钮 + 停止按钮，5 个元素争抢，1100px 附近即拥挤；【设计建议】主题开关可收成单按钮循环，或服务商按钮只显短名。

**最不像成熟商业软件的细节**：window.confirm/alert 原生弹窗（P2-11）——一弹出来整气质塌掉。

**风格不统一的组件**：标签类三种写法——`.pill`（顶栏）、`.sg-tag`（建议卡）、`.ts-item`（标题条）、`.vno`（版本号）各自实现圆角/底色/字号，应收敛为一个 Tag 组件三档尺寸（见第七节）。

**信息密度过高**：自定义框架编辑器（`.custom-sec-card` 内 2×2 输入格）——它是高级功能，密度可接受，保留。
**过空**：超宽屏中栏（P3-5）；右栏空态（文案尚可，保持）。
**视觉噪音**：建议卡原文区用 `bad-soft` 红底 + 红色删除线（`.sg-orig`）——长原文时大片红色块+删除线阅读疲劳；【设计建议】改中性灰底 + 细删除线，红色只留左边框 2.5px 作语义提示。

**毛玻璃/渐变适用性判断**：
- 顶栏 blur：✅ 合理（浮在滚动内容上）。
- 划词工具条 blur：✅ 合理（浮层）。
- 标题条 blur：❌ 去除（见上）。
- 主按钮渐变：✅ 克制，保留。
- 编辑器径向辉光（--radial-glow）：✅ 极淡，保留。
- 不建议新增任何毛玻璃区域；当前用量已在合理上限。

---

# 七、设计系统评估

**已有且统一的**：色板/线框/圆角/阴影/字体栈 token；Button 四档（primary/sm/ghost/hot）；Input/Select/Textarea；卡片基底；滚动条；双主题切换机制。这套底子**不需要重建**。

**缺失的层**（按优先级）：

| 缺失件 | 现状替代品 | 统一方案 |
|---|---|---|
| Toast/通知 | 顶栏 status 字符串 | 新建 `Feedback/Toast.tsx`（P1-5 落地） |
| ConfirmDialog | window.confirm ×2 | 新建 Promise 化 ConfirmDialog，替换 2 处 |
| Popover 行为 | api-detail 手写，无点外/Esc 关闭 | 抽 `Popover` 容器或给 api-detail 补行为（P2-5） |
| Tag/Badge | pill / sg-tag / ts-item / vno 四写 | 收敛 `Tag`（size: sm/md，tone: accent/neutral/warn） |
| Tooltip | 无（title 属性零散） | 轻量 Tooltip，先服务顶栏与历史卡片 |
| Loading | sg-dot blink / pill busy 各自为战 | 统一 spinner/dot 组件 |
| Empty State | panel-empty 两处一致 ✅ | 抽组件即可，样式不动 |
| Error State | 无独立形态 | 随 Toast 落地 |
| Modal | 无（v1 有，v2 无需求） | 暂不建 |

**「同一功能不同 UI」实例**：版本号 `.vno`（白底蓝边胶囊）vs 建议序号 `.custom-sec-badge`（蓝底方）vs 框架段号 `.sec-item b`（纯文字）——三种序号语言，统一为 Tag-neutral 一种。

---

# 八、页面级改造建议（单页应用，按区域）

## 8.1 顶栏（app-header）

- **当前定位**：品牌 + 全局状态 + 全局设置入口。
- **当前问题**：5 元素拥挤；状态胶囊超负荷承担错误详情（P1-5）；停止按钮在此而非操作原位（P2-6）。
- **改造方向**：品牌 | 状态胶囊（只放摘要，点击展开最近一条完整通知） | 弹性空间 | 服务商 | 主题（收单按钮）。停止移回左栏主按钮原位。
- **视觉建议**：保持现状磨砂+细线即可，不加新装饰。

## 8.2 左栏 GeneratePanel

- **当前定位**：任务定义区（框架+素材+风格）+ 主动作。
- **当前问题**：分组逻辑（必填/素材/心智/风格）清晰、文案优秀；主按钮生成中无进度（P2-6）。
- **改造方向**：结构不动；主按钮生成中原位变「停止生成（已输出 X 字）」。
- **推荐布局**：维持现状——这是全站信息架构最好的一栏。
- **视觉建议**：保持朴素 inspector 风，禁止加卡片化/毛玻璃。

## 8.3 中栏 EditorPane + 标题条

- **当前定位**：核心画布 + 辅助产出（标题）。
- **当前问题**：无导出（P1-1）；标题条视觉过重+功能不全（P2-9+第六节）。
- **改造方向**：
  - Header 区（中栏顶部）：标题条改为中性卡片、可单条复制、可关闭。
  - Main：编辑器纸张不动。
  - Footer（统计栏）：左侧加「复制全文 / 导出 .md」，右侧统计不动。
- **视觉建议**：纸张画布是全站视觉锚点，保持；标题条去蓝底去 blur。

## 8.4 右栏 Tabs（SuggestionPanel / HistoryPanel）

- **当前定位**：改写建议确认 + 版本资产。
- **当前问题**：建议卡红色噪音（第六节）；历史卡整卡载入（P0-1）、密度高、无产品筛选（P1-2）、版本号漂移（P1-6）。
- **改造方向**：
  - Suggestion：原文区中性化；批量操作保留。
  - History：顶部产品筛选器 → 列表（单击选中预览 / 显式「载入」「导出」「删除」按钮，破坏性按钮 hover 显现）。
- **推荐布局**：
  ```
  Tabs [修改建议(n) | 历史(n)]
  → (历史) 落盘状态条
  → (历史) 产品筛选 chips
  → 版本卡列表：v号+标签+时间 / 一行预览 / hover 操作行
  ```

## 8.5 API 设置 popover

- **当前定位**：服务商配置。
- **当前问题**：行为不完整（P2-5）、label 硬核（P3）、默认端点/模型错误（P1-3/P1-4）、inline width 与 CSS 不一致（P3-3）。
- **改造方向**：补关闭行为；「官方 API 端点」类 label 改人话（「兼容端点（推荐）」）；宽度统一进 CSS。
- **视觉建议**：popover 样式本身（18px 圆角+shadow-pop）达标，不动。

---

# 九、问题之间的关联（根因图谱）

```
根因 A：快照系统语义缺陷（无持久版本号 / 无产品维度 / 无 dirty 概念）
 ├─→ P0-1 覆盖无护栏（无 dirty 概念）
 ├─→ P1-2 多产品混放（无产品维度消费）
 ├─→ P1-6 版本号漂移（无持久序号）
 ├─→ P2-3 「当前」标记说谎（无 dirty 概念）
 ├─→ P2-4 brief 回滚不全（快照数据模型太薄）
 └─→ P2-8 写满静默（无存储健康概念）

根因 B：反馈系统只有一根管道（status 字符串）
 ├─→ P1-5 错误截断不可读
 ├─→ P2-1 建议静默销毁无提示
 ├─→ P2-6 生成无进度
 ├─→ P2-8 降级无提示
 ├─→ P2-11 confirm/alert 割裂
 └─→ 落盘失败仅 console.warn

根因 C：预设配置无上线校验流程
 ├─→ P1-3 DashScope 端点错误
 ├─→ P1-4 默认模型名疑似虚构
 └─→ 文档（FRONTEND_DESIGN 第 10 条）承诺与实现不符

根因 D：v1→v2 迁移无功能清单对齐
 ├─→ P1-1 导出丢失
 ├─→ P2-8 写满提示丢失（v1 有）
 └─→ P1-5 错误详情展示退化（v1 用 alert 至少有全文）
```

**结论**：19 个问题里 14 个挂在 4 个根因上。优先修根因 A（快照语义）和根因 B（反馈层），一半的表面问题会随之消解；逐个打补丁（如只加确认弹窗不做自动备份）会在根因上继续长出新的表面问题。

---

# 十、修改优先级与实施顺序

## 第一阶段：业务修复（止损）
1. TASK-001 P0-1 覆盖护栏（自动备份 + 历史卡片交互分层）
2. TASK-002 P1-1 当前稿导出
3. TASK-003 P1-3+P1-4 预设端点与默认模型修正（含实机探针验证）
4. TASK-004 P1-6 持久版本号（含迁移）

依赖：TASK-004 与 TASK-001 都改 pushSnap，**串行**（先 004 改数据结构，001 复用）；TASK-002/003 互相独立，可并行。

## 第二阶段：核心交互（反馈层 + 快照语义补齐）
5. TASK-005 P1-5+P2-11 Feedback 组件层（Toast/ConfirmDialog）并替换全部调用点
6. TASK-006 P1-2 快照产品筛选 + 上限按产品计 + 写满提示（P2-8 并入）
7. TASK-007 P2-1+P2-2+P2-3+P2-4 建议生命周期与快照 brief 全量

依赖：TASK-005 是 006/007 所有 toast 提示的地基，**必须先做**；006 依赖 004（数据结构）。

## 第三阶段：设计系统补缺
8. TASK-008 Tag/Tooltip/Loading 收敛 + 建议卡红色降噪 + 标题条改造（P2-9 并入）

## 第四阶段：页面级收尾
9. TASK-009 P2-5 popover 关闭行为 + P2-6 停止归位/进度 + P2-7 窄屏导航 + P2-10 深思超时放宽

## 第五阶段：可选项（现在不做）
- P3-1 legacy 目录归置、P3-2 Key 回退收紧、P3-3 死代码清理、P3-5 超宽屏弹性。

**「看起来重要但优先级低」**：超宽屏适配（P3-5，目标用户 1440-1920 为主）；openai-responses 前端入口（协议已备，无用户诉求前不接）；编辑器 undo 跨 setContent 保留（护栏已覆盖场景）。

**不应该现在做**：多用户/云端同步/账户体系（架构上是另一个产品）；v1 删除（先归置观察）。

---

# 十一、实施任务清单

### TASK-001
**优先级：P0**
**位置**：`src/App.tsx`（generate / loadSnapshot / pushSnap）、`src/components/History/HistoryPanel.tsx`
**问题**：生成与载入快照无确认覆盖正文，手动修改无快照可回（P0-1）。
**修改目标**：任何覆盖编辑器内容的动作发生前，若当前内容相对最近快照有变更，先自动存一版「覆盖前自动备份」；历史卡片整卡单击不再载入。
**建议实现**：
1. App 层新增 `isDirty()`：比较 `editor.getHTML()` 与 `storage.loadSnapshots()[0]?.html`（无快照时 `!editor.isEmpty` 即 dirty）。
2. `generate()` 与 `loadSnapshot()` 开头：`if (isDirty()) pushSnap('覆盖前自动备份')`；pushSnap 返回 0（写失败）时用 ConfirmDialog 确认「备份失败仍要覆盖吗」，否则中止。
3. `pushSnap` 加去重：新内容与最新快照 html 相同则直接返回不新增。
4. HistoryPanel：整卡 onClick 移除；操作行固定显示「载入 / 导出 / 删除」三个 sm 按钮，「载入」调原 onLoad（内部已带护栏）。
**不要修改**：suggestionPlugin.ts；generate 的 prompt 构建逻辑；快照数据结构（属 TASK-004）。
**验收标准**：
- 生成后手改 10 个字 → 点「生成文案」→ 历史列表出现「覆盖前自动备份」版且内容为手改稿；
- 手改后单击历史卡片 → 编辑器内容不变；点「载入」→ 出现自动备份版 + 编辑器变为目标版；
- 连续点两次「存一版」→ 只新增一个快照；
- localStorage 塞满模拟（写失败）→ 覆盖动作弹确认且可中止。

### TASK-002
**优先级：P1**
**位置**：`src/App.tsx`（中栏 JSX）、`src/components/Editor/Editor.tsx`（或新小组件）
**问题**：当前稿无复制/导出入口（P1-1）。
**修改目标**：编辑器非空时，统计栏左侧出现「复制全文」「导出 .md」。
**建议实现**：复制用 `editor.getText()` 段落间补 `\n\n`；导出复用 `download()`，md 结构 = `# {brief.name}` + 人群引用行 + 正文（h2/段落由 `editor.getHTML()` 转 md 或直接文本分段）+ 标题条内容；空编辑器禁用。文件名沿用 `safeFileName` 规则。
**不要修改**：快照导出逻辑；titles 存储。
**验收标准**：复制结果粘贴到纯文本编辑器格式正确（段落空行分隔、无 HTML 标签）；导出 .md 用 Typora/Obsidian 打开结构正确；标题存在时 md 尾部含「## 配套标题」。

### TASK-003
**优先级：P1**
**位置**：`src/services/storage.ts`（DEFAULT_PROVIDER_CONFIGS）、`src/components/GeneratePanel/ApiSettings.tsx`（SERVICE_PRESETS）、`server/handler.ts`（GET 分支与各处默认模型硬编码 L296-305/484/531/826 等）
**问题**：DashScope 默认端点 404（P1-3）；默认模型名疑似未在售（P1-4）。
**修改目标**：所有厂商默认值 = 「填 Key 就能跑通」的已验证组合。
**建议实现**：
1. dashscope base 默认改 `https://dashscope.aliyuncs.com/compatible-mode/v1`，urls[0]/[1] 顺序与 label 同步调整；
2. 逐厂商核实默认模型（用本工具的 test-connection 探针逐个实测，或查官方 /models），把 DEFAULT_PROVIDER_CONFIGS、SERVICE_PRESETS models[0]、handler.ts 全部硬编码默认值统一替换；核实不了的型号标注「(未验证)」或移出默认位；
3. gemini 默认注意 `buildOpenAiUrl` 对 generativelanguage.googleapis.com 的特判路径仍然成立。
**不要修改**：resolveApiKey 白名单逻辑；协议识别 resolveProtocol。
**验收标准**：对每个厂商执行 test-connection 探针（用有效 Key 或本地 ollama），默认 base+默认模型组合返回 ok:true；local 预设指向 `http://127.0.0.1:11434/v1` + 本机已拉取模型时探针通过。

### TASK-004
**优先级：P1**
**位置**：`src/types/document.ts`（Snapshot）、`src/services/storage.ts`（pushSnapshot/loadSnapshots）、`src/App.tsx`（pushSnap/状态文本）、`HistoryPanel.tsx`（v 号渲染）、`exportAllSnaps`
**问题**：版本号是列表下标，删除后漂移（P1-6）。
**修改目标**：版本号持久化。
**建议实现**：Snapshot 加 `seq: number`；storage 加 `cw.snapSeq` 自增计数器；loadSnapshots 做一次性迁移（无 seq 的老数据按 ts 升序补 1..N）；pushSnapshot 返回 seq；UI 全部改显 `v{seq}`；落盘文件名时间戳后加 `_v{seq}`。
**不要修改**：快照上限逻辑（属 TASK-006）。
**验收标准**：存 5 版删中间 1 版 → 剩余版本号不变；刷新页面版本号不变；导出合集的 v 号与面板一致；老数据（无 seq）首次打开正常补号且顺序与原先一致。

### TASK-005
**优先级：P1**
**位置**：新建 `src/components/Feedback/`（Toast.tsx、ConfirmDialog.tsx）；替换点：`App.tsx`（全部 setStatus('失败…')、alert ×2）、`HistoryPanel.tsx`（window.confirm ×2）
**问题**：错误截断不可读（P1-5）、原生弹窗割裂（P2-11）。
**修改目标**：状态（胶囊）与通知（Toast）语义分离；确认弹窗组件化。
**建议实现**：Toast 全局单例（右下角堆叠，accent/neutral/error 三态，error 态含「复制详情」按钮，8s 自动关闭可手关）；ConfirmDialog Promise 化（`const ok = await confirmDialog({title, body, danger})`）；失败类 setStatus 改为胶囊摘要 + toast 详情。
**不要修改**：样式 token 体系；状态胶囊的基础样式。
**验收标准**：制造一次 401 → 胶囊显红色摘要、toast 显完整错误含上游 detail、可复制；清空历史与删除单版走新 ConfirmDialog，样式与全局一致；Esc/点遮罩可关。

### TASK-006
**优先级：P1**
**位置**：`src/services/storage.ts`（上限逻辑）、`src/components/History/HistoryPanel.tsx`（筛选 UI）、`App.tsx`（toast 接线）
**问题**：快照无产品维度（P1-2）、写满静默（P2-8）。
**修改目标**：历史可按产品筛选；上限按产品计；降级/截断有提示。
**建议实现**：筛选 chips 从快照 product 去重生成（「当前产品 / 全部 / 各产品名」）；pushSnapshot 上限改为每产品 60（总量软上限 200 防爆 localStorage）；写失败降级时通过 TASK-005 的 toast 提示「本地空间不足…建议导出全部备份」。
**依赖**：TASK-004（seq）、TASK-005（toast）。
**验收标准**：两个产品各存若干版后，筛选器能正确分流；某产品超上限只截该产品最老版；模拟写满出现 toast。

### TASK-007
**优先级：P2**
**位置**：`src/App.tsx`（generate/rewrite/focusSuggestion/loadSnapshot/onUpdate）、`suggestionPlugin.ts`（不动 filter 本身，在 App sync 层检测）
**问题**：建议静默销毁（P2-1）、定位弹工具条（P2-2）、当前标记说谎（P2-3）、brief 回滚不全（P2-4）。
**修改目标**：建议失效有提示；定位不弹工具条；内容偏离后当前标记更新；快照存/回滚全量 brief。
**建议实现**：详见 P2-1/2/3/4 各条方案；Snapshot 加 `brief?: Brief`（可选字段，老数据兼容）。
**依赖**：TASK-005（toast）。
**验收标准**：改写 pending 中点生成 → toast 确认；编辑建议内原文 → toast「建议已失效」；点建议卡 → 正文滚动定位且无工具条弹出；载入快照后手改 → 历史「当前」标记消失或变更；载入老产品快照后 brief 全字段回滚。

### TASK-008
**优先级：P2**
**位置**：`src/components/`（新 Tag/Tooltip）、`styles.css`（sg-orig/titles-strip/vno 等）
**问题**：标签四写、建议卡红色噪音、标题条不一致（第六节、P2-9）。
**修改目标**：Tag 收敛三档；建议卡原文区中性化；标题条中性卡片化 + 单条复制 + 可关闭 + 复制内容与展示一致。
**建议实现**：见第六、七节；titles-strip 去 `backdrop-filter`、底色改 `var(--panel)`。
**验收标准**：四序号场景共用 Tag；长原文建议卡无大面积红块；标题单条点击复制内容无编号。

### TASK-009
**优先级：P2**
**位置**：`ApiSettings.tsx`、`App.tsx`（busyKind/停止/进度）、`styles.css`（≤1100px 区块）、`server/handler.ts`（超时）、`llm.ts`（透传 longThinking）
**问题**：popover 关闭（P2-5）、停止/进度（P2-6）、窄屏导航（P2-7）、深思超时（P2-10）。
**修改目标**：popover 点外/Esc 关；生成中原位停止 + 实时字数；窄屏顶部分段导航；深思模式放宽超时（首包 180s/空闲 90s 或心跳）。
**验收标准**：逐项按 P2 各条验收；窄屏（≤1100px）下两次点击内可达编辑器。

### TASK-010（可选批次）
**优先级：P3**
**内容**：P3-1 根目录 index.html 移 `legacy/`（README 同步）；P3-2 resolveApiKey 去掉跨厂商回退；P3-3 删 settings.temperature、api-detail 宽度归 CSS；P3-4 启动日志按各厂商 Key 分别报告；P3-5 超宽屏 editor max-width 提至 960-1100px。
**验收标准**：typecheck + build PASS；各 P3 项行为如述。

**全局验收底线（每个 TASK 完成后必跑）**：`npm run typecheck` PASS；`npm run build` PASS；`.playwright-test/` 下既有验证脚本（verify-frontend-fixes / verify-key-whitelist / verify-idle-timeout-error / verify-timeout-gemini）全部 PASS。

---

# 附：本报告未能确认、需执行期核实的事项

1. 各厂商「预设」默认模型是否真实在售 → TASK-003 第 2 步用探针实测。
2. DashScope `/api/v1/chat/completions` 是否确为 404 → TASK-003 先跑一次探针复核（若意外可用，仍建议默认改 compatible-mode 以符合 OpenAI 协议语义）。
3. P2-10 推理模型实际触发超时误杀的频率 → 需用 deepseek-reasoner/o3 类模型实测一次深思模式长生成。
4. 用户机器上 `.env` 是否已配置真实 Key（本次只看到 LOCAL_BASE_URL/LOCAL_MODEL/DEFAULT_PROVIDER/PORT 等键名，未读取值）→ 不影响本报告结论。
