/* CASE2 复测：用 http.request + req.destroy() 硬断 socket，排除 fetch keep-alive 干扰 */
import http from 'node:http';
import { spawn } from 'node:child_process';

const NODE = 'C:/Users/Adhytm/.workbuddy/binaries/node/versions/22.22.2-3/node.exe';
const SERVER = 'D:/vault/文案撰写/copywriter/dist-server/index.js';

let stats = { requests: 0, finishedFull: 0, abortedEarly: 0 };
const upstream = http.createServer((req, res) => {
  if (req.method !== 'POST') { res.writeHead(404); res.end(); return; }
  stats.requests++;
  req.resume();
  req.on('end', () => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    let i = 0;
    const timer = setInterval(() => {
      i++;
      if (i > 5) {
        clearInterval(timer);
        res.write('data: [DONE]\n\n');
        res.end();
        stats.finishedFull++;
        return;
      }
      res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: '词' + i } }] }) + '\n\n');
    }, 400);
    res.on('close', () => { if (i <= 5) { clearInterval(timer); stats.abortedEarly++; } });
  });
});
await new Promise(r => upstream.listen(9899, '127.0.0.1', r));

const server = spawn(NODE, [SERVER], { env: { ...process.env, PORT: '5199', OPENAI_API_KEY: '' }, stdio: 'pipe' });
for (let i = 0; i < 30; i++) {
  const ok = await fetch('http://localhost:5199/').then(r => r.ok).catch(() => false);
  if (ok) break;
  await new Promise(r => setTimeout(r, 300));
}

const chatBody = JSON.stringify({
  provider: 'local', base: 'http://127.0.0.1:9899/v1', model: 'test-model',
  messages: [{ role: 'user', content: 'hi' }], stream: true
});

await new Promise(resolve => {
  const req = http.request('http://localhost:5199/api/llm', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, res => {
    res.once('data', () => {
      req.destroy(); // 收到第一个字节就硬断 socket
      resolve();
    });
  });
  req.on('error', () => {});
  req.end(chatBody);
});

await new Promise(r => setTimeout(r, 2000));
console.log('hard-destroy test:');
console.log('  upstream requests:', stats.requests, '| finishedFull:', stats.finishedFull, '| abortedEarly:', stats.abortedEarly);
console.log('  RESULT:', stats.abortedEarly >= 1 ? 'PASS (硬断后上游被中断)' : 'FAIL <-- 断连未传播到上游');

upstream.close();
server.kill();
process.exit(0);
