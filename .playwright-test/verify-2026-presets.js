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
  check('GET /api/llm 包含 moonshot 配置', !!cfg.providers.moonshot && cfg.providers.moonshot.model === 'kimi-k3');
  check('GET /api/llm 包含 dashscope 配置', !!cfg.providers.dashscope && cfg.providers.dashscope.model === 'qwen3.8-max');
  check('GET /api/llm 包含 aliyun-token-plan 配置', !!cfg.providers['aliyun-token-plan']);
  check('GET /api/llm 包含 gemini 配置', !!cfg.providers.gemini && cfg.providers.gemini.model === 'gemini-3.1-pro');
  check('GET /api/llm 包含 zhipu 配置', !!cfg.providers.zhipu && cfg.providers.zhipu.model === 'glm-5.3');
  check('GET /api/llm 包含 zhipu-coding 配置', !!cfg.providers['zhipu-coding']);
  check('GET /api/llm 包含 deepseek 配置', !!cfg.providers.deepseek && cfg.providers.deepseek.model === 'DeepSeek-V4.1-Flash');
  check('GET /api/llm 包含 openai 配置', !!cfg.providers.openai && cfg.providers.openai.model === 'gpt-6-astra');
  check('GET /api/llm 包含 anthropic 配置', !!cfg.providers.anthropic && cfg.providers.anthropic.model === 'claude-sonnet-5');

  // 2. 浏览器端 UI 测试
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(APP);
  await page.waitForSelector('.app-header');

  // 打开设置下拉
  const setBtn = page.locator('.api-box button');
  await setBtn.click();
  await page.waitForSelector('.api-detail');

  const select = page.locator('.api-detail select');
  const urlInput = page.locator('.api-detail input').nth(0);
  const modelInput = page.locator('.api-detail input').nth(1);

  // 测试 1: Moonshot (Kimi)
  await select.selectOption('moonshot');
  check('Moonshot 端点自动填入', (await urlInput.inputValue()).includes('https://api.moonshot.ai/v1/chat/completions'));
  check('Moonshot 默认模型为 kimi-k3', (await modelInput.inputValue()) === 'kimi-k3');
  const kimi26Chip = page.getByRole('button', { name: 'kimi-k2.6', exact: true });
  check('存在 kimi-k2.6 标签', await kimi26Chip.count() > 0);
  await kimi26Chip.click();
  check('点击标签更新模型为 kimi-k2.6', (await modelInput.inputValue()) === 'kimi-k2.6');

  // 测试 2: 阿里云 DashScope
  await select.selectOption('dashscope');
  check('DashScope 端点自动填入', (await urlInput.inputValue()) === 'https://dashscope.aliyuncs.com/api/v1');
  const qwenFlashChip = page.getByRole('button', { name: 'qwen-3.8-flash', exact: true });
  check('存在 qwen-3.8-flash 标签', await qwenFlashChip.count() > 0);
  await qwenFlashChip.click();
  check('点击标签更新模型为 qwen-3.8-flash', (await modelInput.inputValue()) === 'qwen-3.8-flash');

  // 测试 3: 阿里云 Token Plan
  await select.selectOption('aliyun-token-plan');
  check('Token Plan 端点自动填入', (await urlInput.inputValue()).includes('token-plan.ap-southeast-1.maas.aliyuncs.com'));

  // 测试 4: Google Gemini
  await select.selectOption('gemini');
  check('Gemini 官方端点自动填入', (await urlInput.inputValue()) === 'https://generativelanguage.googleapis.com');
  const geminiInteractionsChip = page.getByRole('button', { name: 'Interactions API 端点', exact: true });
  check('存在 Interactions API 端点标签', await geminiInteractionsChip.count() > 0);
  await geminiInteractionsChip.click();
  check('点击 Interactions 标签更新 URL', (await urlInput.inputValue()) === 'https://generativelanguage.googleapis.com/v1beta/interactions');
  const geminiFlashChip = page.getByRole('button', { name: 'gemini-3.8-flash', exact: true });
  check('存在 gemini-3.8-flash 标签', await geminiFlashChip.count() > 0);
  await geminiFlashChip.click();
  check('Gemini 模型更新为 gemini-3.8-flash', (await modelInput.inputValue()) === 'gemini-3.8-flash');

  // 测试 5: 智谱 AI GLM
  await select.selectOption('zhipu');
  check('智谱 GLM 官方端点自动填入', (await urlInput.inputValue()) === 'https://open.bigmodel.cn/api/paas/v4');
  check('智谱模型为 glm-5.3', (await modelInput.inputValue()) === 'glm-5.3');

  // 测试 6: 智谱 Coding Plan
  await select.selectOption('zhipu-coding');
  check('智谱 Coding Plan 端点自动填入', (await urlInput.inputValue()) === 'https://open.bigmodel.cn/api/coding/paas/v4');

  // 测试 7: DeepSeek
  await select.selectOption('deepseek');
  check('DeepSeek 官方端点自动填入', (await urlInput.inputValue()) === 'https://api.deepseek.com');
  check('DeepSeek 模型为 DeepSeek-V4.1-Flash', (await modelInput.inputValue()) === 'DeepSeek-V4.1-Flash');
  const deepseekProChip = page.getByRole('button', { name: 'deepseek-v4-pro', exact: true });
  check('存在 deepseek-v4-pro 标签', await deepseekProChip.count() > 0);
  await deepseekProChip.click();
  check('DeepSeek 模型更新为 deepseek-v4-pro', (await modelInput.inputValue()) === 'deepseek-v4-pro');

  // 测试 8: OpenAI
  await select.selectOption('openai');
  check('OpenAI 官方端点自动填入', (await urlInput.inputValue()) === 'https://api.openai.com/v1');
  check('OpenAI 模型包含 gpt-6-astra', (await modelInput.inputValue()) === 'gpt-6-astra');
  const gptSolChip = page.getByRole('button', { name: 'gpt-6-sol', exact: true });
  const gptLunaChip = page.getByRole('button', { name: 'gpt-6-luna', exact: true });
  check('存在 gpt-6-sol 与 gpt-6-luna 标签', await gptSolChip.count() > 0 && await gptLunaChip.count() > 0);
  await gptLunaChip.click();
  check('OpenAI 模型更新为 gpt-6-luna', (await modelInput.inputValue()) === 'gpt-6-luna');

  // 测试 9: Anthropic Claude
  await select.selectOption('anthropic');
  check('Claude 官方端点包含 v1/messages', (await urlInput.inputValue()) === 'https://api.anthropic.com/v1/messages');
  check('Claude 模型为 claude-sonnet-5', (await modelInput.inputValue()) === 'claude-sonnet-5');
  const fableChip = page.getByRole('button', { name: 'claude-fable-5-1', exact: true });
  const opusChip = page.getByRole('button', { name: 'claude-opus-5-5', exact: true });
  check('存在 claude-fable-5-1 与 claude-opus-5-5 标签', await fableChip.count() > 0 && await opusChip.count() > 0);
  await opusChip.click();
  check('Claude 模型更新为 claude-opus-5-5', (await modelInput.inputValue()) === 'claude-opus-5-5');

  // 测试 10: 测试连接按钮
  const testBtn = page.locator('.api-detail button', { hasText: '测试连接' });
  await testBtn.click();
  await page.waitForSelector('.api-test-res');
  const resText = await page.locator('.api-test-res').innerText();
  check('测试连接按钮响应明确', resText.length > 0, resText.replace(/\n/g, ' '));

  await page.screenshot({ path: '.playwright-test/presets-2026.png' });
  check('2026 预设面板截图已生成', true);

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
