import http from 'node:http';
import { streamChat } from '../src/services/llm.ts';

// 模拟一个发生空闲超时的服务端 SSE 流
const mockPort = 8795;
const mockServer = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // 先正常发一段正文
  res.write('data: {"choices":[{"delta":{"content":"这是前半截正常文案。"巡}}]}\n\n');

  // 然后触发空闲超时：以规范的 error 通道下发，而不是伪装成正文 delta
  res.write('data: {"error":{"message":"上游响应超时中断（超过 45 秒无新内容）","code":"IDLE_TIMEOUT"}}\n\n');
  res.write('data: [DONE]\n\n');
  res.end();
});

await new Promise(r => mockServer.listen(mockPort, r));

let receivedDelta = '';
let thrownError = null;

try {
  // 劫持 global.fetch 请求到 mock 服务
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    return originalFetch(`http://127.0.0.1:${mockPort}`, init);
  };

  await streamChat(
    'system',
    'user',
    { provider: 'local', base: `http://127.0.0.1:${mockPort}` },
    partial => { receivedDelta = partial; }
  );
  globalThis.fetch = originalFetch;
} catch (e) {
  thrownError = e;
}

mockServer.close();

console.log('增量收到的正常内容:', JSON.stringify(receivedDelta));
console.log('捕获到的错误信息:', thrownError?.message);

if (!thrownError) {
  throw new Error('测试失败：streamChat 未能捕获 SSE 中的 error 消息');
}
if (!thrownError.message.includes('上游响应超时中断')) {
  throw new Error(`测试失败：抛出的错误信息不正确: ${thrownError.message}`);
}
if (receivedDelta.includes('[上游响应超时中断]')) {
  throw new Error('测试失败：超时中断提示词被污染进了正文 delta！');
}

console.log('✓ 错误通道机制校验成功：超时信息作为 Error 正常抛出，未污染正文！');
