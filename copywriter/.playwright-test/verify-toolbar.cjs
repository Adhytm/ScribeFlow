/* 回归：SelectionToolbar 的自定义输入框点击后应能聚焦，键盘输入应进输入框而不是文档 */
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');

const NODE = 'C:/Users/Adhytm/.workbuddy/binaries/node/versions/22.22.2-3/node.exe';
const SERVER = 'D:/vault/文案撰写/copywriter/dist-server/index.js';

(async () => {
  const server = spawn(NODE, [SERVER], { env: { ...process.env, PORT: '5199', OPENAI_API_KEY: '' }, stdio: 'pipe' });
  // 等服务器就绪（首次启动可能超过 2s）
  for (let i = 0; i < 30; i++) {
    const ok = await fetch('http://localhost:5199/').then(r => r.ok).catch(() => false);
    if (ok) break;
    await new Promise(r => setTimeout(r, 300));
    if (i === 29) throw new Error('server did not start');
  }

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('http://localhost:5199', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pm-body', { timeout: 8000 });

  await page.evaluate(() => {
    localStorage.setItem('cw.doc', JSON.stringify('<h2>开头钩子</h2><p>她加班到凌晨一点，洗脸时摸到一脸油光。</p><p>第二段内容用来测试选择。</p>'));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pm-body p', { timeout: 8000 });

  await page.evaluate(() => {
    const p = document.querySelector('.pm-body p');
    const range = document.createRange();
    range.selectNodeContents(p);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  await page.waitForSelector('.sel-toolbar', { timeout: 5000 });

  await page.locator('.st-input').click();
  await page.waitForTimeout(200);
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.className);
  console.log('ACTIVE_ELEMENT_AFTER_CLICK:', JSON.stringify(focused));
  console.log('INPUT_FOCUSABLE_BY_MOUSE:', focused === 'st-input' ? 'YES (fixed)' : 'NO <-- BUG STILL PRESENT');

  await page.keyboard.type('更口语');
  const val = await page.locator('.st-input').inputValue();
  console.log('INPUT_VALUE_AFTER_TYPING:', JSON.stringify(val), val === '更口语' ? '(OK)' : '<-- WRONG TARGET');
  const docText = await page.evaluate(() => document.querySelector('.pm-body').textContent);
  console.log('DOC_UNTOUCHED:', docText.includes('更口语') ? 'NO <-- 键盘输入写进了文档!' : 'YES');

  if (errors.length) console.log('PAGE_ERRORS:', errors);
  await browser.close();
  server.kill();
  process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
