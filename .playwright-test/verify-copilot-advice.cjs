const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const APP = 'http://127.0.0.1:5174';

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
    const browser = await chromium.launch({ executablePath: EDGE, headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    await page.route('**/api/llm', async route => {
      const req = route.request();
      if (req.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ hasKey: true, base: 'https://mock.api', model: 'mock-gpt' })
        });
        return;
      }

      const body = JSON.parse(req.postData() || '{}');
      if (body.action === 'test-connection') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, latencyMs: 50 }) });
        return;
      }

      const isAdviceReq = body.messages && body.messages.some(m => m.content && m.content.includes('JSON 格式'));
      if (isAdviceReq) {
        const adviceJson = JSON.stringify({
          summary: '文案框架已完整成型。根据整体结构，建议先精修开头第一段抓人钩子，或者把中间平铺直叙的卖点提炼成吸睛金句。',
          actions: [
            { label: '强化首句痛点钩子', instruction: '将第一句打磨为一针见血的生活痛点细节' },
            { label: '提炼3条卖点金句', instruction: '提炼浓缩3句朗朗上口的高光金句' },
            { label: '强化限时促单(CTA)', instruction: '在文末强化限时特惠与紧迫行动指令' }
          ]
        });
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: `data: ${JSON.stringify({ choices: [{ delta: { content: adviceJson } }] })}\n\ndata: [DONE]\n\n`
        });
        return;
      }

      const mockText = '### 抓人钩子\n每天加班到深夜，头发一把一把地掉。\n\n### 痛点唤醒\n每次洗头看着地漏都心慌，试过很多生发水却总是油腻闷痘。';
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: `data: ${JSON.stringify({ choices: [{ delta: { content: mockText } }] })}\n\ndata: [DONE]\n\n`
      });
    });

    await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(500);

    await page.fill('input[placeholder^="如：轻氧净澈"]', '植萃固发洗发水');
    await page.fill('input[placeholder^="如：25-35"]', '经常熬夜加班、受掉发脱发困扰的年轻白领');
    await page.click('button.primary');

    await page.waitForSelector('.smart-capsules-wrap', { timeout: 8000 });
    await page.waitForTimeout(800);

    // 滚动到副驾卡片并对整个卡片截图
    const cardEl = page.locator('.smart-capsules-wrap');
    await cardEl.scrollIntoViewIfNeeded();
    const shotPath = path.resolve(__dirname, 'copilot-advice-verified.png');
    await cardEl.screenshot({ path: shotPath });

    console.log('PASS | 截取卡片元素图成功 | ' + shotPath);
    await browser.close();
  } catch (err) {
    console.error('Test error:', err);
    process.exitCode = 1;
  } finally {
    serverProc.kill();
  }
})();
