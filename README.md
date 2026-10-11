# 一键文案撰写工具

电商文案生成、局部段落改写与版本回溯工具。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://react.dev/)
[![Tiptap](https://img.shields.io/badge/Tiptap-2.11-gray.svg)](https://tiptap.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646cff.svg)](https://vitejs.dev/)

---

## 界面预览

| 暗色主题（编辑与版本历史） | 局部划词改写与建议审查 |
| :---: | :---: |
| ![暗色界面](docs/screenshots/editor-dark.png) | ![划词改写](docs/screenshots/selection-toolbar.png) |

| 亮色主题（多维输入表单） | API 设置与真实在售预设 |
| :---: | :---: |
| ![亮色界面](docs/screenshots/editor-light.png) | ![API设置](docs/screenshots/api-settings.png) |

---

## 项目架构与版本说明

本项目经历了两代演进，为了兼顾轻量便携与全栈能力，**全部源码永久归档保留**：

```
文案撰写/
├─ copywriter/           ★ 当前主线版本（v2 全栈应用）
│   ├─ server/           本地安全代理层（Node/Express，负责 API Key 安全持有、超时/断连控制、多协议转换）
│   ├─ src/              前端界面（React 18 + Tiptap 富文本编辑器 + Canvas 式选中局部改写 + 文件夹自动落盘）
│   ├─ .env.example      环境变量模板（含 2026 最新主流大模型真实在售预设）
│   └─ package.json
├─ docs/                 项目文档与静态资源
│   ├─ screenshots/      README 界面截图
│   └─ archive/          历史审计与任务归档文档
├─ index.html            ★ 历史原型便携版（v1 纯前端单文件版）
│                        无需安装 Node 与任何依赖，双击即可在浏览器中打开使用。
├─ LICENSE               MIT 开源许可证
├─ RELEASE_REVIEW.md     发布前评估与上线检查清单
└─ README.md             本说明文档
```

---

## 快速开始（主线版本 `copywriter/`）

### 极速推荐：Windows 一键双击启动（免命令行）

1. 直接双击根目录下的 **`一键启动.bat`**：
   - 自动检测 Node.js 环境与依赖，自动启动并呼出默认浏览器直达工作台；
2. 或者双击 **`生成桌面快捷方式.bat`**：
   - 会直接在电脑桌面上生成 **“ScribeFlow文案工具”** 图标，以后在桌面双击即开！

---

### 开发者命令行启动

#### 1. 安装依赖

```bash
# 根目录执行或进入 copywriter 目录安装
cd copywriter
npm install
```

### 2. 配置大模型渠道（可选）

复制环境配置模板：

```bash
cp .env.example .env
```

`.env` 默认配置为本地 Ollama 免密直连（`qwen2.5:7b`）。如需接入云端模型，只需填入对应 Key：
- **阿里云通义千问**：`DASHSCOPE_API_KEY=sk-...`（默认 `qwen-plus`）
- **DeepSeek**：`DEEPSEEK_API_KEY=sk-...`（默认 `deepseek-chat` / `deepseek-reasoner`）
- **Google Gemini**：`GEMINI_API_KEY=...`（默认 `gemini-2.0-flash`）
- **智谱 GLM**：`ZHIPU_API_KEY=...`（默认 `glm-4-flash`）
- **Moonshot Kimi**：`MOONSHOT_API_KEY=sk-...`（默认 `moonshot-v1-8k`）
- **OpenAI**：`OPENAI_API_KEY=sk-...`（默认 `gpt-4o`）
- **Anthropic Claude**：`ANTHROPIC_API_KEY=sk-ant-...`（默认 `claude-3-5-sonnet-20241022`）

> **安全说明**：服务端的 Key 仅在本地 Node 代理层使用，绝不会打包到前端静态资源中；亦可在前端右上角「设置」直接填入临时 Key 保存在浏览器本地。

### 3. 开发模式运行

```bash
npm run dev
```

浏览器访问：`http://localhost:5173`

### 4. 生产模式打包与启动

```bash
npm run build
npm start
```

本地服务默认监听 `http://127.0.0.1:5174`（绑定回环地址，防止局域网未授权访问）。

---

## 核心特性

1. **画布式交互与局部改写**：
   - 基于 Tiptap / ProseMirror，可在文档中选中任意词句或段落，浮出改写工具条。
   - 改写建议在侧边栏以 Diff 预览卡片呈现，支持单独或批量「接受 / 拒绝」，不破坏周围排版与光标定位。
2. **多协议 LLM 安全代理**：
   - 自动适配 Anthropic Messages、OpenAI Chat/Responses、Google Gemini (Interactions & OpenAI 兼容模式)、本地模型（Ollama / LM Studio）等。
   - 服务端具备 **域名白名单防御**、**上游首包超时（60s）** 与 **客户端断连立即中断上游生成** 能力，杜绝后台死锁与额度浪费。
3. **版本快照与文件夹自动落盘**：
   - 每次全文生成、段落改写确认、添加标题均自动生成具备独立递增序号（`seq`）的时间戳版本快照。
   - 覆盖正文前具备自动备份与二次确认护栏，杜绝误操作丢稿。
   - 支持通过现代浏览器 File System Access API 绑定本地文件夹（如 Obsidian 库或坚果云目录），每版自动同步写入 Markdown 文件，断网、刷新均不丢稿。

---

## 详细架构与相关文档

- **前端架构与交互设计**：👉 **[`copywriter/FRONTEND_DESIGN_AND_LOGIC.md`](copywriter/FRONTEND_DESIGN_AND_LOGIC.md)**
- **发布前审查评估报告**：👉 **[`RELEASE_REVIEW.md`](RELEASE_REVIEW.md)**
- **历史产品审计报告**：👉 **[`docs/archive/PRODUCT_AUDIT_REPORT.md`](docs/archive/PRODUCT_AUDIT_REPORT.md)**

---

## 开源协议

本项目基于 [MIT License](LICENSE) 开源。
