/* 回归：服务端 .env 的 Key 不得随自定义 URL 外发；用户自己填的 apiKey 不受限（设计如此） */
import http from 'node:http';
import { Readable } from 'node:stream';
import { handleLlm } from '../dist-server/handler.js';

function fakeReq(body) {
  const req = Readable.from([JSON.stringify(body)]);
  req.method = 'POST';
  return req;
}
function fakeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(k, v) { this.headers[k] = v; },
    write(c) { this.body += c; },
    end(c) { if (c) this.body += c; this.ended = true; }
  };
  return res;
}
const json = res => { try { return JSON.parse(res.body); } catch { return null; } };

// 模拟攻击者控制的端点，记录收到的 Authorization
let captured = [];
const evil = http.createServer((req, res) => {
  captured.push({ url: req.url, auth: req.headers.authorization || null });
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
});
await new Promise(r => evil.listen(9898, '127.0.0.1', r));

const env = { OPENAI_API_KEY: 'sk-SERVER-SECRET' };

// 用例1：恶意自定义 base，不带用户 Key —— 服务端 Key 不得发出
let res = fakeRes();
await handleLlm(fakeReq({ action: 'test-connection', provider: 'openai', base: 'http://127.0.0.1:9898/v1', model: 'x' }), res, env);
const r1 = json(res);
console.log('CASE1 evil-base no-user-key:');
console.log('  response:', JSON.stringify(r1));
console.log('  evil received requests:', captured.length, captured.length === 0 ? '(OK, 未外发)' : '<-- LEAK!');

// 用例2：恶意自定义 base + 用户自己填的 Key —— 允许外发（用户自己的 Key 自己做主）
captured = [];
res = fakeRes();
await handleLlm(fakeReq({ action: 'test-connection', provider: 'openai', base: 'http://127.0.0.1:9898/v1', model: 'x', apiKey: 'sk-USER-OWN' }), res, env);
console.log('CASE2 evil-base with-user-key:');
console.log('  evil auth header:', JSON.stringify(captured[0]?.auth), captured[0]?.auth === 'Bearer sk-USER-OWN' ? '(OK, 用户 Key 正常透传)' : '<-- 意外');

// 用例3：官方域名应放行服务端 Key（本地无法真连 OpenAI，这里只验证白名单函数行为——请求会真实发出，预期网络失败但错误信息不是「未配置」）
res = fakeRes();
await handleLlm(fakeReq({ action: 'test-connection', provider: 'deepseek', base: 'https://api.deepseek.com.evil.com/v1', model: 'x' }), res, env);
const r3 = json(res);
console.log('CASE3 subdomain-spoof deepseek.com.evil.com:');
console.log('  response:', JSON.stringify(r3), r3 && r3.ok === false && /未配置/.test(r3.error || '') ? '(OK, 后缀欺骗被拦)' : '<-- 检查');

evil.close();
process.exit(0);
