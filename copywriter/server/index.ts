import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { handleLlm } from './handler.js';

/**
 * 生产模式：npm run build 之后用 npm start 启动。
 * 和开发期共用同一个 handler，行为完全一致，静态文件也由它托管。
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist');
const ROOT = path.resolve(__dirname, '..');

/** 手写一个极简 .env 读取，避免依赖 node 的 --env-file 版本差异 */
function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^['"]|['"]$/g, '');
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

loadDotEnv();

const PORT = Number(process.env.PORT || 5174);

if (!fs.existsSync(DIST)) {
  console.error('找不到 dist/，请先运行 npm run build');
  process.exit(1);
}

const app = express();

app.use('/api/llm', (req, res) => {
  handleLlm(req, res, process.env).catch(err => {
    res.statusCode = 500;
    res.end(String(err));
  });
});

app.use(express.static(DIST));
app.get(/.*/, (_req, res) => res.sendFile(path.join(DIST, 'index.html')));

// 只绑回环地址：这是无鉴权的单机工具，绑 0.0.0.0 会把 LLM 代理（和服务端 Key）暴露给局域网
const HOST = process.env.HOST || '127.0.0.1';

http.createServer(app).listen(PORT, HOST, () => {
  console.log('一键文案撰写 → http://localhost:' + PORT);
  console.log('API Key：' + (process.env.OPENAI_API_KEY ? '已从 .env 读取' : '未配置（请检查 .env）'));
});
