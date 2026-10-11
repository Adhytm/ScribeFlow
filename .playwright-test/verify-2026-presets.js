const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const APP = 'http://127.0.0.1:5174';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const results = [];
function check(name, ok, extra) {
  results.push((ok ? 'PASS' : 'FAIL') + ' | ' + name + (extra !== undefined ? ' | ' + extra : ''));
}

function waitForServer(url, timeoutMs = 10000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryReq() {
      const req = http.get(url, res => {
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error('Server did not start in time'));
        } else {
          setTimeout(tryReq, 200);
        }
      });
    }
    tryReq();
  });
}

(async () => {
  const serverProc = spawn('node', ['dist-server/index.js'], {
    cwd: path.resolve(__dirname, '../copywriter'),
    env: { ...process.env, PORT: '5174' },
    stdio: 'ignore'
  });

  try {
    await waitForServer(APP, 10000);

    // 1. 服务端配置校验
    const cfg = await (await fetch(`${APP}/api/llm`)).json();
    check('GET /api/llm 包含 local 配置', !!cfg.providers.local && cfg.providers.local.model === 'qwen3.8-27b');
    check('GET /api/llm 包含 moonshot 配置', !!cfg.providers.moonshot && cfg.providers.moonshot.model === 'kimi-k3');
    check('GET /api/llm 包含 dashscope 配置', !!cfg.providers.dashscope && cfg.providers.dashscope.model === 'qwen3.8-max');
    check('GET /api/llm 包含 aliyun-token-plan 配置', !!cfg.providers['aliyun-token-plan'] && cfg.providers['aliyun-token-plan'].model === 'qwen3.8-max');
    check('GET /api/llm 包含 gemini 配置', !!cfg.providers.gemini && cfg.providers.gemini.model === 'gemini-3.8-flash');
    check('GET /api/llm 包含 zhipu 配置', !!cfg.providers.zhipu && cfg.providers.zhipu.model === 'glm-5.3');
    check('GET /api/llm 包含 zhipu-coding 配置', !!cfg.providers['zhipu-coding'] && cfg.providers['zhipu-coding'].model === 'glm-5.3');
    check('GET /api/llm 包含 deepseek 配置', !!cfg.providers.deepseek && cfg.providers.deepseek.model === 'deepseek-flash');
    check('GET /api/llm 包含 openai 配置', !!cfg.providers.openai && cfg.providers.openai.model === 'gpt-6.1-sol');
    check('GET /api/llm 包含 anthropic 配置', !!cfg.providers.anthropic && cfg.providers.anthropic.model === 'claude-sonnet-5-5');

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
    const modelInput = page.locator('.api-detail input').nth(1);

    // 检查是否有任何 "未验证" 字样
    const allDetailText = await page.textContent('.api-detail');
    check('面板没有任何 "未验证" 标签', !allDetailText.includes('未验证'));

    // 测试 1: 本地 (qwen3.8-27b)
    await select.selectOption('local');
    check('本地大模型默认模型为 qwen3.8-27b', (await modelInput.inputValue()) === 'qwen3.8-27b');

    // 测试 2: Moonshot (Kimi)
    await select.selectOption('moonshot');
    check('Moonshot 默认模型为 kimi-k3', (await modelInput.inputValue()) === 'kimi-k3');
    const kimi26Chip = page.getByRole('button', { name: 'kimi-k2.6', exact: true });
    check('存在 kimi-k2.6 标签', await kimi26Chip.count() > 0);
    await kimi26Chip.click();
    check('点击标签更新模型为 kimi-k2.6', (await modelInput.inputValue()) === 'kimi-k2.6');

    // 测试 3: 阿里云 DashScope (qwen3.8-max, qwen-3.8-flash)
    await select.selectOption('dashscope');
    check('DashScope 默认模型为 qwen3.8-max', (await modelInput.inputValue()) === 'qwen3.8-max');
    const qwenFlashChip = page.getByRole('button', { name: 'qwen-3.8-flash', exact: true });
    check('存在 qwen-3.8-flash 标签', await qwenFlashChip.count() > 0);
    await qwenFlashChip.click();
    check('点击标签更新模型为 qwen-3.8-flash', (await modelInput.inputValue()) === 'qwen-3.8-flash');

    // 测试 4: Google Gemini (gemini-3.8-flash, gemini-3.1-pro)
    await select.selectOption('gemini');
    check('Gemini 默认模型为 gemini-3.8-flash', (await modelInput.inputValue()) === 'gemini-3.8-flash');
    const geminiProChip = page.getByRole('button', { name: 'gemini-3.1-pro', exact: true });
    check('存在 gemini-3.1-pro 标签', await geminiProChip.count() > 0);
    await geminiProChip.click();
    check('Gemini 模型更新为 gemini-3.1-pro', (await modelInput.inputValue()) === 'gemini-3.1-pro');

    // 测试 5: 智谱 AI GLM (glm-5.3, glm-5.3-flash)
    await select.selectOption('zhipu');
    check('智谱默认模型为 glm-5.3', (await modelInput.inputValue()) === 'glm-5.3');
    const glmFlashChip = page.getByRole('button', { name: 'glm-5.3-flash', exact: true });
    check('存在 glm-5.3-flash 标签', await glmFlashChip.count() > 0);

    // 测试 6: DeepSeek (deepseek-flash, deepseek-pro)
    await select.selectOption('deepseek');
    check('DeepSeek 默认模型为 deepseek-flash', (await modelInput.inputValue()) === 'deepseek-flash');
    const deepseekProChip = page.getByRole('button', { name: 'deepseek-pro', exact: true });
    check('存在 deepseek-pro 标签', await deepseekProChip.count() > 0);
    await deepseekProChip.click();
    check('DeepSeek 模型更新为 deepseek-pro', (await modelInput.inputValue()) === 'deepseek-pro');

    // 测试 7: OpenAI (gpt-6.1-sol, gpt-6-astra, gpt-6-luna)
    await select.selectOption('openai');
    check('OpenAI 默认模型为 gpt-6.1-sol', (await modelInput.inputValue()) === 'gpt-6.1-sol');
    const gptAstraChip = page.getByRole('button', { name: 'gpt-6-astra', exact: true });
    const gptLunaChip = page.getByRole('button', { name: 'gpt-6-luna', exact: true });
    check('存在 gpt-6-astra 与 gpt-6-luna 标签', await gptAstraChip.count() > 0 && await gptLunaChip.count() > 0);

    // 测试 8: Anthropic Claude (claude-sonnet-5-5, claude-opus-5-5, claude-fable-5-1, fable-5-1)
    await select.selectOption('anthropic');
    check('Claude 默认模型为 claude-sonnet-5-5', (await modelInput.inputValue()) === 'claude-sonnet-5-5');
    const opusChip = page.getByRole('button', { name: 'claude-opus-5-5', exact: true });
    const fableChip = page.getByRole('button', { name: 'claude-fable-5-1', exact: true });
    const fableAliasChip = page.getByRole('button', { name: 'fable-5-1', exact: true });
    check('存在 claude-opus-5-5 与 claude-fable-5-1 及 fable-5-1 标签',
      await opusChip.count() > 0 && await fableChip.count() > 0 && await fableAliasChip.count() > 0);

    const shotPath = path.resolve(__dirname, 'presets-2026.png');
    await page.screenshot({ path: shotPath });
    check('2026 预设面板截图已生成', fs.existsSync(shotPath), shotPath);

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
  } catch (err) {
    console.error('Test error:', err);
    process.exitCode = 1;
  } finally {
    serverProc.kill();
  }
})();
