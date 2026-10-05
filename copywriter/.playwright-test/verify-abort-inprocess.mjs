/* 在进程内直接挂 handler（去掉 Express），逐步定位断连传播断在哪一环 */
import http from 'node:http';
import { handleLlm } from '../dist-server/handler.js';

// 假上游
let upstreamClosedEarly = false;
const upstream = http.createServer((req, res) => {
  req.resume();
  req.on('end', () => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    let i = 0;
    const timer = setInterval(() => {
      i++;
      if (i > 5) { clearInterval(timer); res.write('data: [DONE]\n\n'); res.end(); return; }
      res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: 'w' + i } }] }) + '\n\n');
    }, 300);
    res.on('close', () => {
      if (i <= 5) { clearInterval(timer); upstreamClosedEarly = true; console.log('  [upstream] connection closed early at chunk', i); }
    });
  });
});
await new Promise(r => upstream.listen(9899, '127.0.0.1', r));

// 直接挂 handler，附诊断日志
const server = http.createServer((req, res) => {
  if (req.url !== '/api/llm') { res.writeHead(404); res.end(); return; }
  req.on('close', () => console.log('  [diag] req close, writableEnded =', res.writableEnded));
  res.on('close', () => console.log('  [diag] res close, writableEnded =', res.writableEnded));
  handleLlm(req, res, {}).catch(e => { console.log('  [diag] handler threw', e.message); res.statusCode = 500; res.end(); });
});
await new Promise(r => server.listen(5199, '127.0.0.1', r));

const body = JSON.stringify({
  provider: 'local', base: 'http://127.0.0.1:9899/v1', model: 'm',
  messages: [{ role: 'user', content: 'hi' }], stream: true
});

await new Promise(resolve => {
  const req = http.request('http://127.0.0.1:5199/api/llm', { method: 'POST' }, res => {
    res.once('data', () => { console.log('  [client] got first chunk, destroying socket'); req.destroy(); resolve(); });
  });
  req.on('error', () => {});
  req.end(body);
});

await new Promise(r => setTimeout(r, 1500));
console.log('upstreamClosedEarly:', upstreamClosedEarly, upstreamClosedEarly ? 'PASS' : 'FAIL');
upstream.close(); server.close();
process.exit(0);
