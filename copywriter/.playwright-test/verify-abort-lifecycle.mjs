/* 验证 Gemini 大修的两个服务端行为：
 * 1. req.on('close') 不会在正常请求中途误杀生成（重点回归——Node 的 close 语义容易踩）
 * 2. 客户端主动断开后，上游流确实被中断（不再空烧 token）
 */
import http from 'node:http';
import { spawn } from 'node:child_process';

const NODE = 'C:/Users/Adhytm/.workbuddy/binaries/node/versions/22.22.2-3/node.exe';
const SERVER = 'D:/vault/文案撰写/copywriter/dist-server/index.js';

// ---- 假上游：本地渠道 SSE，滴 5 个 chunk，每个间隔 400ms ----
let upstreamStats = { requests: 0, finishedFull: 0, abortedEarly: 0 };
const upstream = http.createServer((req, res) => {
  if (req.method !== 'POST') { res.writeHead(404); res.end(); return; }
  upstreamStats.requests++;
  let drained = '';
  req.on('data', c => drained += c);
  req.on('end', () => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    let i = 0;
    const timer = setInterval(() => {
      i++;
      if (i > 5) {
        clearInterval(timer);
        res.write('data: [DONE]\n\n');
        res.end();
        upstreamStats.finishedFull++;
        return;
      }
      res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: '词' + i } }] }) + '\n\n');
    }, 400);
    res.on('close', () => {
      if (i <= 5) { clearInterval(timer); upstreamStats.abortedEarly++; }
    });
  });
});
await new Promise(r => upstream.listen(9899, '127.0.0.1', r));

// ---- 启动生产服务器 ----
const server = spawn(NODE, [SERVER], { env: { ...process.env, PORT: '5199', OPENAI_API_KEY: '' }, stdio: 'pipe' });
for (let i = 0; i < 30; i++) {
  const ok = await fetch('http://localhost:5199/').then(r => r.ok).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 300));
  if (i === 29) throw new Error('server did not start');
}

const chatBody = JSON.stringify({
  provider: 'local',
  base: 'http://127.0.0.1:9899/v1',
  model: 'test-model',
  messages: [{ role: 'user', content: 'hi' }],
  stream: true
});

// ---- 用例1：正常完整请求，应收到全部 5 个 chunk + [DONE]（close 误杀检测）----
const res1 = await fetch('http://localhost:5199/api/llm', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: chatBody
});
const text1 = await res1.text();
const chunks1 = (text1.match(/词\d/g) || []).length;
console.log('CASE1 full-request:');
console.log('  status:', res1.status, '| chunks received:', chunks1, '| has [DONE]:', text1.includes('[DONE]'));
console.log('  RESULT:', chunks1 === 5 ? 'PASS (未被 req close 误杀)' : 'FAIL <-- 流被提前中断!');

// ---- 用例2：客户端收到第一个 chunk 后主动断开，上游应被中断 ----
upstreamStats = { requests: 0, finishedFull: 0, abortedEarly: 0 };
const ctrl = new AbortController();
const res2 = await fetch('http://localhost:5199/api/llm', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: chatBody, signal: ctrl.signal
});
const reader = res2.body.getReader();
await reader.read(); // 拿到第一个 chunk
ctrl.abort(new Error('user stopped'));
await new Promise(r => setTimeout(r, 1500)); // 等中断传播
console.log('CASE2 client-abort:');
console.log('  upstream finishedFull:', upstreamStats.finishedFull, '| abortedEarly:', upstreamStats.abortedEarly);
console.log('  RESULT:', upstreamStats.abortedEarly >= 1 && upstreamStats.finishedFull === 0 ? 'PASS (断连正确打断上游)' : 'FAIL <-- 上游仍在空跑');

upstream.close();
server.kill();
process.exit(0);
