/**
 * 专打边界的 debug 套件。主流程已由 e2e-app.js 覆盖，这里只啃没测过的地方：
 * 坐标漂移、pending 区间被删、多建议顺序、中断、上游故障、HTML 注入、空输入。
 */
const { chromium } = require('playwright-core');

const APP = process.env.APP || 'http://127.0.0.1:5173';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const results = [];
const check = (name, ok, extra) =>
  results.push((ok ? 'PASS' : 'BUG ') + ' | ' + name + (extra !== undefined ? ' | ' + extra : ''));

async function fillBrief(page, name, crowd) {
  await page.fill('input[placeholder^="如：轻氧净澈"]', name);
  await page.fill('input[placeholder^="如：25-35"]', crowd);
}

async function generate(page, minHeads = 7) {
  await page.click('button.primary');
  await page.waitForFunction(
    n => document.querySelectorAll('.pm-body h2').length >= n, minHeads, { timeout: 20000 });
  await page.waitForTimeout(200);
}

async function selectAndRewrite(page, pIndex, chip) {
  await page.locator('.pm-body p').nth(pIndex).click({ clickCount: 3 });
  await page.waitForSelector('.sel-toolbar', { timeout: 5000 });
  await page.locator('.st-chip', { hasText: chip }).click();
  await page.waitForSelector('.sg-card button:has-text("接受")', { timeout: 20000 });
  await page.waitForTimeout(150);
}

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // ---- 0. 空输入 ----
  await page.click('button.primary');
  await page.waitForTimeout(400);
  check('空输入点生成不崩溃且给出提示', (await page.textContent('.pill')).includes('至少填'), await page.textContent('.pill'));

  // ---- 1. 上游 500 ----
  await fillBrief(page, '__FAIL__ 测试品', '测试人群');
  await page.click('button.primary');
  await page.waitForTimeout(2500);
  const failMsg = await page.textContent('.pill');
  check('上游 500 时前端优雅提示', failMsg.includes('失败') || failMsg.includes('炸了'), failMsg.slice(0, 60));
  check('上游 500 后按钮恢复可用', !(await page.isDisabled('button.primary')));

  // ---- 2. HTML 注入 ----
  await fillBrief(page, '__XSS__ 测试品', '测试人群');
  await generate(page, 1);
  const xssFired = await page.evaluate(() => !!window.__xss);
  const xssText = await page.textContent('.pm-body');
  check('AI 返回的 HTML 不会被执行', xssFired === false);
  check('HTML 标签被当作纯文本原样保留', xssText.includes('<img src=x') && xssText.includes('<b>危险</b>'),
    xssText.slice(0, 50));

  // ---- 3. 坐标漂移（核心） ----
  await fillBrief(page, '轻氧净澈氨基酸洁面乳', '25-35 岁混油皮女生');
  await generate(page);
  await selectAndRewrite(page, 1, '更口语一点');           // 第 2 段
  await selectAndRewrite(page, 4, '更短更利落');           // 第 5 段
  check('两条建议并存', (await page.locator('.sg-card').count()) === 2,
    'count=' + (await page.locator('.sg-card').count()));

  const before = await page.locator('.sg-pending').allTextContents();
  // 在第 1 段开头插入文字，制造位移
  await page.locator('.pm-body p').nth(0).click();
  await page.keyboard.press('Home');
  await page.keyboard.type('插入前缀');
  await page.waitForTimeout(300);

  const after = await page.locator('.sg-pending').allTextContents();
  check('插入文字后建议数不变', after.length === before.length, `${before.length}→${after.length}`);
  check('建议仍贴在原文本上（坐标未漂）',
    after.length === 2 && after[0] === before[0] && after[1] === before[1],
    JSON.stringify(after.map(t => t.slice(0, 10))));

  // ---- 4. 全部接受 ----
  await page.click('.sg-bar button:has-text("全部接受")');
  await page.waitForTimeout(500);
  const afterAll = await page.textContent('.pm-body');
  check('全部接受后建议清空', (await page.locator('.sg-card').count()) === 0);
  check('全部接受两处都改了', afterAll.includes('洗完脸绷到笑不动'));
  check('全部接受保留了新插入的前缀', afterAll.includes('插入前缀'));
  check('全部接受未丢段落', (await page.locator('.pm-body h2').count()) === 7,
    'h2=' + (await page.locator('.pm-body h2').count()));

  // ---- 5. pending 区间被用户删掉 ----
  await selectAndRewrite(page, 2, '更有画面感');
  check('新建建议成功', (await page.locator('.sg-card').count()) === 1);
  const pendingEl = page.locator('.sg-pending').first();
  await pendingEl.click({ clickCount: 3 });
  await page.keyboard.press('Delete');
  await page.waitForTimeout(400);
  check('删除 pending 原文后建议自动失效（不残留幽灵建议）',
    (await page.locator('.sg-card').count()) === 0,
    'count=' + (await page.locator('.sg-card').count()));
  check('删除后文档仍然正常', (await page.textContent('.pm-body')).length > 50);

  // ---- 6. 中断 ----
  await fillBrief(page, '__SLOW__ 慢品', '测试人群');
  await page.click('button.primary');
  await page.waitForTimeout(900);
  const stopBtn = page.locator('header button:has-text("停止")');
  check('生成中出现停止按钮', await stopBtn.count() === 1);
  await stopBtn.click();
  await page.waitForTimeout(800);
  check('中断后状态提示已停止', (await page.textContent('.pill')).includes('停止'), await page.textContent('.pill'));
  check('中断后按钮恢复可用', !(await page.isDisabled('button.primary')));

  // ---- 7. 刷新恢复 ----
  await fillBrief(page, '恢复测试品', '测试人群');
  await generate(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  check('刷新后正文恢复', (await page.textContent('.pm-body')).includes('晚上十一点'));
  check('刷新后版本数恢复', (await page.textContent('.tabs button:nth-child(2)')).includes('('));

  // ---- 8. 无选区时不误触发 ----
  await page.locator('.pm-body p').nth(0).click();
  await page.waitForTimeout(300);
  check('单击（无选区）不弹工具条', (await page.locator('.sel-toolbar').count()) === 0);

  // ---- 9. 首版标签应为「初稿」 ----
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await fillBrief(page, '标签测试品', '测试人群');
  await generate(page);
  await page.click('.tabs button:nth-child(2)');
  await page.waitForTimeout(200);
  check('首版标签为「初稿」',
    (await page.locator('.hs-item').first().locator('.vlabel').textContent()).trim() === '初稿',
    await page.locator('.hs-item').first().locator('.vlabel').textContent());
  await page.click('.tabs button:nth-child(1)');

  // ---- 10. 标题要真的存进快照 ----
  await page.click('.gp button:has-text("出 5 条标题")');
  await page.waitForTimeout(2500);
  check('生成标题后显示标题条', (await page.locator('.titles-strip').count()) === 1);
  await page.click('.tabs button:nth-child(2)');
  await page.waitForTimeout(200);
  check('加标题也存了一版',
    (await page.locator('.hs-item').first().locator('.vlabel').textContent()).includes('加标题'),
    await page.locator('.hs-item').first().locator('.vlabel').textContent());
  await page.locator('.hs-item').first().click();
  await page.waitForTimeout(300);
  check('载入该版后标题仍在（未丢）', (await page.locator('.titles-strip').count()) === 1);

  // ---- 11. 跨段落选中改写（防止换行比对丢失） ----
  await page.evaluate(() => {
    const ps = document.querySelectorAll('.pm-body p');
    const range = document.createRange();
    range.setStart(ps[0].firstChild, 0);
    range.setEnd(ps[1].firstChild, 10);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    ps[1].dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await page.waitForSelector('.sel-toolbar', { timeout: 5000 });
  await page.locator('.st-chip', { hasText: '更短更利落' }).click();
  await page.waitForSelector('.sg-card button:has-text("接受")', { timeout: 15000 });
  check('跨段落建议卡成功创建未消失', (await page.locator('.sg-card').count()) >= 1);
  await page.click('.sg-card button:has-text("接受")');
  await page.waitForTimeout(400);
  check('跨段落接受后建议已清空', (await page.locator('.sg-card').count()) === 0);

  // ---- 12. 段落内部行内局部选中改写（防止炸裂成3段） ----
  const pCountBefore = await page.locator('.pm-body p').count();
  await page.evaluate(() => {
    const ps = document.querySelectorAll('.pm-body p');
    const p = ps[2];
    const textNode = p.firstChild;
    const len = textNode.textContent.length;
    const range = document.createRange();
    range.setStart(textNode, 2);
    range.setEnd(textNode, Math.min(8, len));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await page.waitForSelector('.sel-toolbar', { timeout: 5000 });
  await page.locator('.st-chip', { hasText: '更口语一点' }).click();
  await page.waitForSelector('.sg-card button:has-text("接受")', { timeout: 15000 });
  await page.click('.sg-card button:has-text("接受")');
  await page.waitForTimeout(400);
  const pCountAfter = await page.locator('.pm-body p').count();
  check('行内改写接受后段落未被炸裂成3段', pCountAfter === pCountBefore, `${pCountBefore}段→${pCountAfter}段`);

  console.log(results.join('\n'));
  console.log('\n--- 运行时错误 ---');
  console.log(errors.length ? errors.join('\n') : '(无)');
  const bugs = results.filter(r => r.startsWith('BUG')).length;
  console.log('\n总计 ' + results.length + ' 项，发现 bug ' + bugs + ' 个');
  await browser.close();
})().catch(e => { console.error('RUNNER ERROR:', e); process.exit(1); });
