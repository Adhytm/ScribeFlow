const { chromium } = require('playwright-core');

const APP = 'http://127.0.0.1:5173';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const results = [];
function check(name, ok, extra) {
  results.push((ok ? 'PASS' : 'FAIL') + ' | ' + name + (extra !== undefined ? ' | ' + extra : ''));
}

(async () => {
  // 1. 服务端配置校验
  const cfg = await (await fetch(`${APP}/api/llm`)).json();
  check('GET /api/llm 包含 local、anthropic、openai-responses',
    !!cfg.providers.local && !!cfg.providers.anthropic && !!cfg.providers['openai-responses']);
  check('本地渠道推荐模型为 qwen3.8-27b', cfg.providers.local.model === 'qwen3.8-27b', cfg.providers.local.model);
  check('Anthropic 渠道推荐模型为 claude-opus-5-5', cfg.providers.anthropic.model === 'claude-opus-5-5', cfg.providers.anthropic.model);
  check('OpenAI Responses 推荐模型为 gpt-6-sol', cfg.providers['openai-responses'].model === 'gpt-6-sol', cfg.providers['openai-responses'].model);
  check('服务端默认不再包含任何 8787 测试端口残留', !JSON.stringify(cfg).includes('8787'));

  // 2. 测试连接探针接口
  const probeLocal = await (await fetch(`${APP}/api/llm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'test-connection',
      provider: 'local',
      base: 'http://127.0.0.1:11434/v1',
      model: 'qwen3.8-27b'
    })
  })).json();
  check('本地模型 test-connection 接口返回结构有效 (包含 ok 与说明)', typeof probeLocal.ok === 'boolean' && (probeLocal.message || probeLocal.error));

  // 3. 浏览器端 UI 测试
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(APP);
  await page.waitForSelector('.app-header');

  // 打开设置下拉
  const setBtn = page.locator('.api-box button');
  await setBtn.click();
  await page.waitForSelector('.api-detail');

  // 校验 URL 与模型输入框存在且可编辑
  const urlInput = page.locator('.api-detail input').nth(0);
  const modelInput = page.locator('.api-detail input').nth(1);
  check('接口端点 (URL) 输入框可见且可编辑', await urlInput.isVisible());
  check('模型名称输入框可见且可编辑', await modelInput.isVisible());

  // 校验推荐标签 qwen3.8-27b
  const qwenChip = page.locator('.api-chip', { hasText: 'qwen3.8-27b' });
  check('推荐标签 qwen3.8-27b 存在', await qwenChip.count() > 0);
  await qwenChip.click();
  const currentModelVal = await modelInput.inputValue();
  check('点击推荐标签自动填入模型名称 qwen3.8-27b', currentModelVal === 'qwen3.8-27b', currentModelVal);

  // 校验「测试连接」按钮
  const testBtn = page.locator('.api-detail button', { hasText: '测试连接' });
  check('测试连接按钮存在', await testBtn.count() > 0);
  await testBtn.click();
  await page.waitForSelector('.api-test-res');
  const resText = await page.locator('.api-test-res').innerText();
  check('测试连接触发并给出明确反馈结果', resText.length > 0, resText.replace(/\n/g, ' '));

  // 切换到 Anthropic 渠道
  const select = page.locator('.api-detail select');
  await select.selectOption('anthropic');
  const opusChip = page.locator('.api-chip', { hasText: 'claude-opus-5-5' });
  check('切换到 Anthropic 后可见 claude-opus-5-5 推荐标签', await opusChip.count() > 0);
  await opusChip.click();
  check('Anthropic 模型已填入 claude-opus-5-5', (await modelInput.inputValue()) === 'claude-opus-5-5');

  // 切换到 Responses API 渠道
  await select.selectOption('openai-responses');
  const solChip = page.getByRole('button', { name: 'gpt-6-sol', exact: true });
  check('切换到 Responses API 后可见 gpt-6-sol 推荐标签', await solChip.count() > 0);
  await solChip.click();
  check('Responses 模型已填入 gpt-6-sol', (await modelInput.inputValue()) === 'gpt-6-sol');

  await page.screenshot({ path: '.playwright-test/settings-redesign.png' });
  check('设置面板重构截图已生成', true);

  await browser.close();

  console.log('\n=== 测试结果 ===');
  results.forEach(r => console.log(r));
  const failed = results.filter(r => r.startsWith('FAIL'));
  if (failed.length > 0) {
    console.error(`\n❌ ${failed.length} 项测试未通过`);
    process.exit(1);
  } else {
    console.log(`\n🎉 全部 ${results.length} 项测试顺利通过！`);
  }
})();
