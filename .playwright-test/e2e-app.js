/**
 * 端到端验证：浏览器 → Vite 中间件(后端) → mock 上游
 * 重点验证 Canvas 交互闭环 + API Key 从不进入浏览器。
 */
const { chromium } = require('playwright-core');

const APP = process.env.APP || 'http://127.0.0.1:5173';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const KEY = 'test-key-local-only';

const results = [];
function check(name, ok, extra) {
  results.push((ok ? 'PASS' : 'FAIL') + ' | ' + name + (extra !== undefined ? ' | ' + extra : ''));
}

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });

  const errors = [];
  const pageRequests = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('request', r => pageRequests.push(r.url() + ' ' + JSON.stringify(r.headers())));

  await page.goto(APP, { waitUntil: 'networkidle' });

  // 1. 后端配置
  const cfg = await (await fetch('http://127.0.0.1:5173/api/llm')).json();
  check('后端报告已持有 Key', cfg.hasKey === true, JSON.stringify(cfg));
  check('后端不回传 Key 明文', !JSON.stringify(cfg).includes(KEY));
  check('前端显示后端已配置', (await page.textContent('.api-box button')).includes('已配置 Key'),
    await page.textContent('.api-box button'));

  // 2. 生成
  await page.fill('input[placeholder^="如：轻氧净澈"]', '轻氧净澈氨基酸洁面乳');
  await page.fill('input[placeholder^="如：25-35"]', '25-35 岁混油皮女生，加班多、怕闷痘');
  await page.click('button.primary');
  await page.waitForFunction(() => document.querySelectorAll('.pm-body h2').length >= 7, null, { timeout: 20000 });

  const heads = await page.locator('.pm-body h2').allTextContents();
  check('生成 7 个段落标题', heads.length === 7, heads.join('/'));
  const bodyText = await page.textContent('.pm-body');
  check('正文含 mock 内容', bodyText.includes('晚上十一点'), bodyText.slice(0, 20));
  check('生成后自动存快照', (await page.textContent('.tabs button:nth-child(2)')).includes('(1)'),
    await page.textContent('.tabs button:nth-child(2)'));

  // 3. 选中 → 改写（Canvas 闭环）
  const target = page.locator('.pm-body p').nth(1);
  const targetText = (await target.textContent()).trim();
  await target.click({ clickCount: 3 });
  await page.waitForSelector('.sel-toolbar', { timeout: 5000 });
  check('选中后浮出工具条', true);
  const box = await page.locator('.sel-toolbar').boundingBox();
  const wrapBox = await page.locator('.editor-wrap').boundingBox();
  check('工具条未被容器裁掉', box.y >= wrapBox.y - 2 && box.y + box.height <= wrapBox.y + wrapBox.height + 400,
    `toolbar.y=${Math.round(box.y)} wrap.y=${Math.round(wrapBox.y)}`);

  await page.locator('.st-chip', { hasText: '更口语一点' }).click();
  await page.waitForSelector('.sg-card', { timeout: 10000 });
  check('建议卡出现', true);
  await page.waitForSelector('.sg-card button:has-text("接受")', { timeout: 15000 });
  const origText = (await page.textContent('.sg-orig')).trim();
  check('建议卡记录原文', origText.slice(0, 12) === targetText.slice(0, 12), origText.slice(0, 20));
  const newText = (await page.textContent('.sg-new')).trim();
  check('建议卡显示新文案', newText.includes('洗完脸绷到笑不动'), newText.slice(0, 20));

  // 4. pending 高亮确实打在原文上
  const marked = await page.locator('.sg-pending').count();
  check('原文被标记为 pending 高亮', marked >= 1, 'count=' + marked);

  // 5. 接受
  await page.click('.sg-card button:has-text("接受")');
  await page.waitForTimeout(400);
  const afterAccept = await page.textContent('.pm-body');
  check('接受后正文已被替换', afterAccept.includes('洗完脸绷到笑不动'));
  check('接受后原文已消失', !afterAccept.includes('皂基洗完绷得像戴了面具'));
  check('接受后建议清空', (await page.locator('.sg-card').count()) === 0);
  check('接受后自动存快照', (await page.textContent('.tabs button:nth-child(2)')).includes('(2)'),
    await page.textContent('.tabs button:nth-child(2)'));

  // 6. 拒绝路径
  const t2 = page.locator('.pm-body p').nth(3);
  await t2.click({ clickCount: 3 });
  await page.waitForSelector('.sel-toolbar');
  await page.locator('.st-chip', { hasText: '更短更利落' }).click();
  await page.waitForSelector('.sg-card button:has-text("接受")', { timeout: 15000 });
  await page.click('.sg-card button:has-text("拒绝")');
  await page.waitForTimeout(300);
  check('拒绝后建议清空', (await page.locator('.sg-card').count()) === 0);
  check('拒绝不动正文', !(await page.textContent('.pm-body')).includes('洗完脸绷到笑不动。洗完脸绷到笑不动'));

  // 7. 历史回滚
  await page.click('.tabs button:nth-child(2)');
  await page.waitForTimeout(200);
  const hsCount = await page.locator('.hs-item').count();
  check('历史列出多版', hsCount >= 2, 'count=' + hsCount);
  await page.locator('.hs-item').last().click();
  await page.waitForTimeout(300);
  const rolled = await page.textContent('.pm-body');
  check('回滚到最早版本成功', rolled.includes('皂基洗完绷得像戴了面具'), rolled.slice(0, 30));

  // 8. 刷新后文档仍在
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  check('刷新后正文恢复', (await page.textContent('.pm-body')).includes('皂基洗完绷得像戴了面具'));

  // 9. Key 从不进入浏览器
  const leaked = pageRequests.filter(r => r.includes(KEY));
  check('浏览器侧任何请求都不含 Key', leaked.length === 0, leaked.slice(0, 1).join(''));
  const bundleHasKey = await page.evaluate(async () => {
    const srcs = [...document.querySelectorAll('script[src]')].map(s => s.src);
    for (const s of srcs) {
      const t = await (await fetch(s)).text();
      if (t.includes('test-key-local-only')) return true;
    }
    return false;
  });
  check('前端产物里不含 Key', bundleHasKey === false);

  console.log(results.join('\n'));
  console.log('\n--- 运行时错误 ---');
  console.log(errors.length ? errors.join('\n') : '(无)');
  const failed = results.filter(r => r.startsWith('FAIL')).length;
  console.log('\n总计 ' + results.length + ' 项，失败 ' + failed + ' 项');
  await browser.close();
})().catch(e => { console.error('RUNNER ERROR:', e); process.exit(1); });
