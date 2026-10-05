/**
 * 模拟多协议 LLM 上游（端口 8787）。
 * 支持：
 *   1. OpenAI Chat Completions (/chat/completions)
 *   2. OpenAI Responses API (/responses)
 *   3. Anthropic Claude (/messages)
 *   4. 本地渠道 (/local/v1/chat/completions)
 *
 * 供测试套件在不花真钱的情况下完整验证端到端多渠道转发。
 */
const http = require('node:http');

const SECTIONS = [
  ['开头钩子', '晚上十一点，你只想让这张脸赶紧安静下来。'],
  ['痛点放大', '皂基洗完绷得像戴了面具，换季一碰就红，卸了防晒总觉得还糊着一层。'],
  ['卖点登场', '轻氧净澈这支洁面用的是氨基酸表活，pH5.5 弱酸，靠胶束把油污卷走。'],
  ['卖点拆解', '一是氨基酸表活，清洁力够日常防晒。二是无香精无酒精。三是洗后三小时不紧绷。'],
  ['场景代入', '早八赶时间挤一泵就走；加班回家十一点温水一冲就干净。'],
  ['信任背书', '累计售出 42 万支，第三方斑贴测试通过。'],
  ['促单收口', '换季这段时间是脸最挑的时候，现在换正好。']
];

const REWRITE = '洗完脸绷到笑不动的那种感觉，你大概不陌生。';
const XSS = '<img src=x onerror="window.__xss=1">这里是<b>危险</b>内容';

let seenAuth = null;
let seenXApiKey = null;
let seenAnthropicVersion = null;

function sseOpenAi(text) {
  const out = [];
  for (let i = 0; i < text.length; i += 14) {
    out.push('data: ' + JSON.stringify({ choices: [{ delta: { content: text.slice(i, i + 14) } }] }) + '\n\n');
  }
  out.push('data: [DONE]\n\n');
  return out.join('');
}

function sseAnthropic(text) {
  const out = [];
  for (let i = 0; i < text.length; i += 14) {
    out.push('data: ' + JSON.stringify({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: text.slice(i, i + 14) }
    }) + '\n\n');
  }
  out.push('data: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n');
  return out.join('');
}

function sseOpenAiResponses(text) {
  const out = [];
  for (let i = 0; i < text.length; i += 14) {
    out.push('data: ' + JSON.stringify({
      type: 'response.output_text.delta',
      delta: text.slice(i, i + 14)
    }) + '\n\n');
  }
  out.push('data: ' + JSON.stringify({ type: 'response.completed' }) + '\n\n');
  return out.join('');
}

const server = http.createServer((req, res) => {
  if (req.url === '/__auth') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      auth: seenAuth,
      xApiKey: seenXApiKey,
      anthropicVersion: seenAnthropicVersion
    }));
  }

  const isAnthropic = req.url.includes('/messages');
  const isOpenAiResponses = req.url.includes('/responses');
  const isOpenAiChat = req.url.includes('/chat/completions');

  if (!isAnthropic && !isOpenAiResponses && !isOpenAiChat) {
    res.statusCode = 404;
    return res.end('not found');
  }

  let raw = '';
  req.on('data', c => (raw += c));
  req.on('end', () => {
    seenAuth = req.headers.authorization || null;
    seenXApiKey = req.headers['x-api-key'] || null;
    seenAnthropicVersion = req.headers['anthropic-version'] || null;

    const body = JSON.parse(raw || '{}');
    const user = ((body.messages || body.input || []).map(m => m.content || '').join('\n')) +
      (body.system || '');

    if (user.includes('__FAIL__')) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: '上游炸了（这是测试注入的故障）' }));
    }

    let text;
    if (user.includes('需要改写的片段')) text = REWRITE;
    else if (user.includes('__XSS__')) text = '###开头钩子\n' + XSS;
    else text = SECTIONS.map(s => '###' + s[0] + '\n' + s[1]).join('\n\n');

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });

    let ssePayload;
    if (isAnthropic) ssePayload = sseAnthropic(text);
    else if (isOpenAiResponses) ssePayload = sseOpenAiResponses(text);
    else ssePayload = sseOpenAi(text);

    const chunks = ssePayload.match(/[\s\S]{1,120}/g) || [];
    let i = 0;
    const timer = setInterval(() => {
      if (i >= chunks.length) {
        clearInterval(timer);
        return res.end();
      }
      res.write(chunks[i++]);
    }, user.includes('__SLOW__') ? 350 : 12);
  });
});

server.listen(8787, '127.0.0.1', () => console.log('multi-protocol mock llm on 8787'));
