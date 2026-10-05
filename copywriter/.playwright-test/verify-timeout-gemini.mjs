import http from 'node:http';
import { handleLlm } from '../server/handler.ts';

// -----------------------------------------------------------------
// 1. 测试安全文件名与文件格式化
// -----------------------------------------------------------------
import { safeFileName, snapshotMarkdown } from '../src/services/storage.ts';

const mockSnap = {
  id: 's1',
  ts: 1727770000000,
  label: '初稿·电商详情',
  product: '轻氧/洁面乳*测试',
  crowd: '20-30岁人群',
  html: '<p>正文内容</p>',
  text: '正文内容',
  titles: '1. 标题一\n2. 标题二'
};

const fname = safeFileName(mockSnap);
console.log('SAFE FILE NAME:', fname);
if (fname.includes('/') || fname.includes('*') || fname.includes('\\')) {
  throw new Error('safeFileName 含有非法字符');
}
if (!fname.endsWith('.md')) {
  throw new Error('safeFileName 必须以 .md 结尾');
}
console.log('✓ safeFileName 校验通过');

const md = snapshotMarkdown(mockSnap);
if (!md.includes('# 轻氧/洁面乳*测试') || !md.includes('## 配套标题')) {
  throw new Error('snapshotMarkdown 渲染不全');
}
console.log('✓ snapshotMarkdown 渲染校验通过');

// -----------------------------------------------------------------
// 2. Mock 上游服务：测试 Gemini Interactions 流式解析
// -----------------------------------------------------------------
const mockPort = 8791;
let upstreamReceivedAbort = false;
let upstreamReceivedBody = null;

const mockServer = http.createServer((req, res) => {
  let raw = '';
  req.on('data', c => raw += c);
  req.on('end', () => {
    try { upstreamReceivedBody = JSON.parse(raw); } catch {}
  });

  req.on('close', () => {
    if (!res.writableEnded) {
      upstreamReceivedAbort = true;
    }
  });

  if (req.url?.includes('timeout-test')) {
    // 故意挂起，用于测试超时
    return;
  }

  if (req.url?.includes('interactions')) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    // 模拟 Google Gemini Interactions API 官方返回
    res.write('event: interaction.created\n');
    res.write('data: {"type": "interaction.created", "interaction": {"id": "int_1", "status": "created"}}\n\n');

    res.write('event: step.delta\n');
    res.write('data: {"type": "step.delta", "index": 0, "delta": {"type": "text", "text": "你好Gemini"}}\n\n');

    res.write('event: step.delta\n');
    res.write('data: {"type": "step.delta", "index": 0, "delta": {"type": "text", "text": "文案撰写完成"}}\n\n');

    res.write('event: interaction.completed\n');
    res.write('data: {"type": "interaction.completed", "interaction": {"id": "int_1", "status": "completed"}}\n\n');
    res.end();
    return;
  }

  res.writeHead(200);
  res.end('ok');
});

await new Promise(r => mockServer.listen(mockPort, r));

// -----------------------------------------------------------------
// 测试 Gemini Interactions 请求与解析
// -----------------------------------------------------------------
console.log('\n--- 测试 Gemini Interactions 流式解析 ---');
const fakeReq = new http.IncomingMessage(null);
fakeReq.method = 'POST';

// 构建由本地 Node HTTP 服务器转接的客户端请求
const localServer = http.createServer((req, res) => {
  handleLlm(req, res, {
    GEMINI_API_KEY: 'test-gemini-key',
    UPSTREAM_TIMEOUT_MS: '2000'
  });
});
const localPort = 8792;
await new Promise(r => localServer.listen(localPort, r));

// 向本地服务器发起调用 Gemini Interactions
const resp = await fetch(`http://127.0.0.1:${localPort}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    base: `http://127.0.0.1:${mockPort}/interactions`,
    provider: 'gemini',
    apiKey: 'user-gemini-key',
    messages: [
      { role: 'system', content: '你是电商操盘手' },
      { role: 'user', content: '写一段氨基酸洁面乳文案' }
    ]
  })
});

if (!resp.ok) {
  throw new Error(`Gemini Interactions 请求失败: HTTP ${resp.status}`);
}

const reader = resp.body.getReader();
const decoder = new TextDecoder();
let streamResult = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  for (const line of chunk.split('\n')) {
    if (line.startsWith('data:')) {
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const j = JSON.parse(payload);
        const text = j.choices?.[0]?.delta?.content;
        if (text) streamResult += text;
      } catch {}
    }
  }
}

console.log('Gemini Interactions 最终解析结果:', streamResult);
if (streamResult !== '你好Gemini文案撰写完成') {
  throw new Error(`Gemini Interactions 解析文本不匹配: 期望 "你好Gemini文案撰写完成"，实际 "${streamResult}"`);
}
console.log('✓ Gemini Interactions 流式解析验证通过！');

if (!upstreamReceivedBody || upstreamReceivedBody.system_instruction !== '你是电商操盘手' || upstreamReceivedBody.input !== '写一段氨基酸洁面乳文案') {
  throw new Error(`Gemini 请求体未正确映射: ${JSON.stringify(upstreamReceivedBody)}`);
}
console.log('✓ Gemini Interactions 请求体（system_instruction + input）格式映射正确！');

// -----------------------------------------------------------------
// 测试上游超时 (504)
// -----------------------------------------------------------------
console.log('\n--- 测试上游请求超时机制 ---');
const timeoutResp = await fetch(`http://127.0.0.1:${localPort}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    base: `http://127.0.0.1:${mockPort}/timeout-test/interactions`,
    provider: 'gemini',
    apiKey: 'user-gemini-key',
    messages: [{ role: 'user', content: 'test timeout' }]
  })
});

console.log('超时响应状态码:', timeoutResp.status);
const timeoutJson = await timeoutResp.json();
console.log('超时响应结果:', timeoutJson);
if (timeoutResp.status !== 504 || !timeoutJson.error?.includes('超时')) {
  throw new Error('未正确捕获超时或状态码不是 504');
}
console.log('✓ 上游超时控制 (504 Gateway Timeout) 验证通过！');

// -----------------------------------------------------------------
// 测试客户端断连传播 (Abort Propagation)
// -----------------------------------------------------------------
console.log('\n--- 测试客户端断连传播 ---');
upstreamReceivedAbort = false;
const abortCtrl = new AbortController();

const abortReqPromise = fetch(`http://127.0.0.1:${localPort}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    base: `http://127.0.0.1:${mockPort}/timeout-test/interactions`,
    provider: 'gemini',
    apiKey: 'user-gemini-key',
    messages: [{ role: 'user', content: 'test abort' }]
  }),
  signal: abortCtrl.signal
}).catch(err => {
  // 预期 client 抛出 AbortError
});

// 100ms 后客户端主动打断
await new Promise(r => setTimeout(r, 100));
abortCtrl.abort();
await abortReqPromise;

// 检查 mock upstream 是否感知到了断连
await new Promise(r => setTimeout(r, 200));
console.log('上游是否接收到断连/取消信号:', upstreamReceivedAbort);
if (!upstreamReceivedAbort) {
  throw new Error('客户端断连未传播至上游');
}
console.log('✓ 客户端断连传播至上游请求 验证通过！');

mockServer.close();
localServer.close();
console.log('\n========================================');
console.log('全部 4 项核心测试全部 PASS！');
console.log('========================================');
