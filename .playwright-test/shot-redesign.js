/* 重新设计后的视觉验证：初始态 + 注入内容态截图 + 控制台错误捕获 */
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // 1. 初始空态
  await page.screenshot({ path: 'redesign-1-empty.png' });

  // 2. 注入编辑器内容（仅视觉），模拟生成后的排版
  await page.evaluate(() => {
    const pm = document.querySelector('.pm-body');
    if (pm) {
      pm.innerHTML = [
        '<h2>开头钩子</h2>',
        '<p>晚上十一点半，你站在洗手台前，脸上还挂着白天防晒和灰尘混在一起的那层膜。水一冲，手指搓上去是涩的——不是干净，是屏障在报警。</p>',
        '<h2>痛点放大</h2>',
        '<p>皂基洁面洗完十分钟，两颊开始发紧，笑起来都觉得皮肤在扯。换季更惨，颧骨泛红一片，遮瑕都压不住。你以为是自己皮肤差，其实大多数时候，是清洁这一步就把防线拆了。</p>',
        '<p>还有卸防晒这件事：一遍怕洗不净，两遍怕过度清洁，每天都在两个错误之间选一个。</p>',
        '<h2>卖点登场</h2>',
        '<p>这支洁面用的是氨基酸表活，pH5.5 弱酸，和皮肤自身的酸碱环境几乎一致。清洁力够卸掉通勤防晒，但不会把皮脂膜一起带走。</p>'
      ].join('');
    }
    // 标题条
    const mid = document.querySelector('.col-mid');
    if (mid && !document.querySelector('.titles-strip')) {
      const strip = document.createElement('div');
      strip.className = 'titles-strip';
      strip.innerHTML = '<b>配套标题</b><div class="ts-list">' +
        ['洗完不紧绷的洁面，真的存在', '42 万支复购的氨基酸洁面', '加班到深夜，脸也值得被温柔对待', '无香精无酒精，敏感肌闭眼入', '换掉皂基，从今晚开始']
          .map(t => '<span class="ts-item">' + t + '</span>').join('') +
        '</div><button class="sm">复制</button>';
      mid.insertBefore(strip, mid.firstChild);
    }
    // 右侧注入两张建议卡 + 历史项（仅视觉预览样式）
    const tabBody = document.querySelector('.tab-body');
    if (tabBody) {
      tabBody.innerHTML = '<div class="sg-panel"><div class="sg-bar"><span class="sg-count">2 条建议（1 条待确认）</span><span class="sp"></span>' +
        '<button class="sm">全部接受</button><button class="sm">全部拒绝</button></div>' +
        '<div class="sg-card"><div class="sg-head"><span class="sg-tag">更有画面感</span></div>' +
        '<div class="sg-orig">皂基洁面洗完十分钟，两颊开始发紧，笑起来都觉得皮肤在扯。</div>' +
        '<div class="sg-arrow">↓</div>' +
        '<div class="sg-new">皂基洁面冲完水，你还没来得及擦脸，两颊已经开始发紧——对着镜子笑一下，皮肤像被人从两侧轻轻扯住。</div>' +
        '<div class="sg-ops"><button class="sm hot">接受</button><button class="sm">拒绝</button></div></div>' +
        '<div class="sg-card streaming"><div class="sg-head"><span class="sg-tag">更口语一点</span><span class="sg-dot"></span></div>' +
        '<div class="sg-orig">这支洁面用的是氨基酸表活，pH5.5 弱酸。</div>' +
        '<div class="sg-arrow">↓</div>' +
        '<div class="sg-new">说白了，它的清洁成分跟你皮肤自己那层弱酸环境是"一路人"…</div></div></div>';
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'redesign-2-filled.png' });

  // 3. 选中文字触发浮动工具条
  await page.evaluate(() => {
    const pm = document.querySelector('.pm-body');
    const p = pm.querySelectorAll('p')[1];
    const range = document.createRange();
    range.selectNodeContents(p);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'redesign-3-toolbar.png' });

  // 4. 展开 API 设置浮层
  await page.click('.api-box > button');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'redesign-4-api.png' });

  // 5. 窄屏断点
  await page.keyboard.press('Escape');
  await page.click('body', { position: { x: 20, y: 400 } });
  await page.setViewportSize({ width: 900, height: 900 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'redesign-5-narrow.png', fullPage: false });

  console.log('JS errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
