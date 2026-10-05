const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('cw.doc', JSON.stringify('<p>第一句话。</p>'));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const statBefore = await page.textContent('.editor-stat-bar').catch(() => '(无统计栏)');
  // 聚焦编辑器末尾并打字
  await page.click('.pm-body');
  await page.keyboard.press('End');
  await page.keyboard.type('继续输入更多文字来测试统计是否实时刷新。');
  await page.waitForTimeout(900);
  const statAfter = await page.textContent('.editor-stat-bar').catch(() => '(无统计栏)');
  console.log('输入前统计:', statBefore.replace(/\s+/g, ' '));
  console.log('输入后统计:', statAfter.replace(/\s+/g, ' '));
  console.log(statBefore === statAfter ? '>>> 结论：统计未更新（陈旧）' : '>>> 结论：统计已更新');
  // 检查是否存在"复制全文/导出当前稿"按钮
  const bodyText = await page.textContent('body');
  console.log('页面含「复制全文」:', bodyText.includes('复制全文'));
  console.log('页面含「导出 .md」按钮(历史外):', (await page.locator('button:has-text("导出")').count()));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
