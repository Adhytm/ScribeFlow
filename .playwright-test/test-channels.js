/**
 * 多渠道与安全验证套件：
 * 验证 Anthropic API、OpenAI Responses API、标准 OpenAI Chat、本地免密渠道
 * 均可被后端代理正确解析与流式透传，且所有 Key 严禁泄露至浏览器。
 */
const { chromium } = require('playwright-core');

const APP = process.env.APP || 'http://127.0.0.1:5173';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OPENAI_KEY = 'test-key-local-only';
const ANTHROPIC_KEY = 'test-anthropic-key-local-only';

const results = [];
function check(name, ok, extra) {
  results.push((ok ? 'PASS' : 'FAIL') + ' | ' + name + (extra !== undefined ? ' | ' + extra : ''));
}

async function streamFetch(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const p = t.slice(5).trim();
      if (p === '[DONE]') continue;
      try {
        const j = JSON.parse(p);
        const c = j.choices?.[0]?.delta?.content;
        if (c) full += c;
      } catch {}
    }
  }
  return full;
}

(async () => {
  // 1. 测试 GET /api/llm 配置接口
  const cfg = await (await fetch(`${APP}/api/llm`)).json();
  check('GET /api/llm 包含 providers 列表', !!cfg.providers && !!cfg.providers.anthropic && !!cfg.providers.local);
  check('本地渠道无需 Key (hasKey: true)', cfg.providers.local.hasKey === true);
  check('Anthropic 渠道检测到 Key', cfg.providers.anthropic.hasKey === true);
  check('所有响应中严禁泄露任何 Key 明文',
    !JSON.stringify(cfg).includes(OPENAI_KEY) && !JSON.stringify(cfg).includes(ANTHROPIC_KEY));

  // 2. 测试 Anthropic Claude 渠道转发
  const anthropicRes = await streamFetch(`${APP}/api/llm`, {
    provider: 'anthropic',
    messages: [
      { role: 'system', content: '资深文案' },
      { role: 'user', content: '写一段开头钩子' }
    ]
  });
  check('Anthropic 渠道返回文案内容', anthropicRes.includes('晚上十一点'), anthropicRes.slice(0, 30));

  const authState = await (await fetch('http://127.0.0.1:8787/__auth')).json();
  check('Anthropic 请求携带了 x-api-key', authState.xApiKey === ANTHROPIC_KEY);
  check('Anthropic 请求携带了 anthropic-version', authState.anthropicVersion === '2023-06-01');

  // 3. 测试 OpenAI Responses API 渠道转发
  const responsesRes = await streamFetch(`${APP}/api/llm`, {
    provider: 'openai-responses',
    messages: [
      { role: 'system', content: '资深文案' },
      { role: 'user', content: '写一段开头钩子' }
    ]
  });
  check('OpenAI Responses API 渠道返回文案内容', responsesRes.includes('晚上十一点'), responsesRes.slice(0, 30));

  // 4. 测试本地免密直连渠道
  const localRes = await streamFetch(`${APP}/api/llm`, {
    provider: 'local',
    messages: [
      { role: 'user', content: '写一段开头钩子' }
    ]
  });
  check('本地模型渠道返回文案内容', localRes.includes('晚上十一点'), localRes.slice(0, 30));

  // 5. 真实浏览器端测试：切换渠道并生成
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const leakedRequests = [];
  page.on('request', r => {
    const text = r.url() + ' ' + JSON.stringify(r.headers());
    if (text.includes(OPENAI_KEY) || text.includes(ANTHROPIC_KEY)) leakedRequests.push(text);
  });

  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // 打开 API 面板
  await page.click('.api-box button');
  await page.waitForSelector('.api-detail select', { timeout: 5000 });
  check('设置面板下拉框包含本地渠道选项', (await page.textContent('.api-detail select')).includes('本地模型'));

  // 切换为本地模型
  await page.selectOption('.api-detail select', 'local');
  await page.waitForTimeout(300);
  check('切换本地渠道后显示免密状态', (await page.textContent('.api-detail')).includes('无需 Key'));

  // 填表单生成
  await page.fill('input[placeholder^="如：轻氧净澈"]', '本地测试产品');
  await page.fill('input[placeholder^="如：25-35"]', '测试人群');
  await page.click('button.primary');
  await page.waitForFunction(() => document.querySelectorAll('.pm-body h2').length >= 7, null, { timeout: 20000 });
  check('本地渠道生成 7 个段落成功', (await page.locator('.pm-body h2').count()) === 7);

  // 验证浏览器全程无 Key 泄露
  check('浏览器发出的任何网络请求中均不含任何 Key', leakedRequests.length === 0);

  await browser.close();

  console.log(results.join('\n'));
  const failed = results.filter(r => r.startsWith('FAIL')).length;
  console.log('\n总计 ' + results.length + ' 项，失败 ' + failed + ' 项');
  if (failed > 0) process.exit(1);
})().catch(e => {
  console.error('TEST ERROR:', e);
  process.exit(1);
});
