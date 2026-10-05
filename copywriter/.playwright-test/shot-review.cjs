/* 产品审查截图脚本：多宽度、暗色/浅色、关键交互态 */
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 200)); });
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));

  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // 1. 1600px 暗色初始空态
  await page.screenshot({ path: 'shot-1-desktop-dark-empty.png' });

  // 填表单（不真正生成，检查表单态）
  await page.fill('input >> nth=0', '轻氧净澈氨基酸洁面乳');
  const crowdInput = page.locator('.col-left input').nth(1);
  await crowdInput.fill('25-35 岁混油皮女生');
  await page.screenshot({ path: 'shot-2-desktop-dark-form.png' });

  // 展开框架说明 details
  await page.click('details.fw > summary');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'shot-3-framework-detail.png' });
  await page.click('details.fw > summary');

  // 打开 API 设置弹层
  await page.click('.api-box > button');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'shot-4-api-popover.png' });
  await page.click('.api-box > button');
  await page.waitForTimeout(200);

  // 切换到浅色主题
  const themeBtns = page.locator('.theme-btn');
  const n = await themeBtns.count();
  for (let i = 0; i < n; i++) {
    const t = await themeBtns.nth(i).textContent();
    if (t.includes('浅')) { await themeBtns.nth(i).click(); break; }
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'shot-5-desktop-light.png' });
  // 切回深色
  for (let i = 0; i < n; i++) {
    const t = await themeBtns.nth(i).textContent();
    if (t.includes('深')) { await themeBtns.nth(i).click(); break; }
  }
  await page.waitForTimeout(300);

  // 切到历史 tab
  await page.click('.tabs button >> nth=1');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'shot-6-history-tab.png' });
  await page.click('.tabs button >> nth=0');

  // 2. 中宽度 1100px（响应式断点边界）
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'shot-7-width-1100.png' });

  // 3. 窄屏 900px
  await page.setViewportSize({ width: 900, height: 900 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'shot-8-width-900.png' });

  // 4. 超宽 2200px（检查宽屏空白）
  await page.setViewportSize({ width: 2200, height: 1000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'shot-9-width-2200.png' });

  // 5. 模拟编辑器有内容：通过 localStorage 注入一篇文档再刷新
  await page.setViewportSize({ width: 1600, height: 950 });
  await page.evaluate(() => {
    const html = '<h2>开头钩子</h2><p>凌晨一点，她第无数次对着镜子叹气。</p><p>T区油得能炒菜，两颊却干到起皮。</p><h2>痛点放大</h2><p>皂基洁面洗完整张脸绷得像戴了面具，笑一下都怕裂开。换季的时候更惨，脸颊泛红刺痒，连最温和的水乳都不敢上。</p><h2>卖点登场</h2><p>轻氧净澈氨基酸洁面乳，pH5.5 弱酸配方，和皮肤自己的酸碱度几乎一致。</p>';
    localStorage.setItem('cw.doc', JSON.stringify(html));
    localStorage.setItem('cw.titles', JSON.stringify('1. 洗后3小时不紧绷的氨基酸洁面\n2. 混油皮女生的晨间救星\n3. 无香精无酒精，敏感期也敢用\n4. 42万支销量的温和洁面\n5. 今晚洗脸，别再绷着了'));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'shot-10-with-content.png' });

  // 划词触发工具条：用 ProseMirror 选中第一段文字
  await page.evaluate(() => {
    const pm = document.querySelector('.pm-body');
    const range = document.createRange();
    const firstP = pm.querySelector('p');
    range.selectNodeContents(firstP);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'shot-11-selection-toolbar.png' });

  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
