const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const path = require('path');

const PORT = '5198';
const SERVER = path.join(__dirname, '../copywriter/dist-server/index.js');

(async () => {
  console.log('Starting server...');
  const server = spawn('node', [SERVER], {
    env: { ...process.env, PORT, OPENAI_API_KEY: '' },
    stdio: 'pipe'
  });

  server.stdout.on('data', d => console.log('[server]', d.toString().trim()));
  server.stderr.on('data', d => console.error('[server error]', d.toString().trim()));

  // Wait for server ready
  for (let i = 0; i < 30; i++) {
    const ok = await fetch(`http://localhost:${PORT}/`).then(r => r.ok).catch(() => false);
    if (ok) {
      console.log('Server is ready on port', PORT);
      break;
    }
    await new Promise(r => setTimeout(r, 200));
    if (i === 29) {
      server.kill();
      throw new Error('Server timed out');
    }
  }

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true
  });

  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // 1. Dark mode - empty state
  await page.screenshot({ path: path.join(__dirname, 'apple-1-dark-empty.png') });
  console.log('Captured apple-1-dark-empty.png');

  // Inject content to simulate active writing & diff suggestions
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
    // 右侧建议卡
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

  await page.waitForTimeout(400);
  // 2. Dark mode - filled state
  await page.screenshot({ path: path.join(__dirname, 'apple-2-dark-filled.png') });
  console.log('Captured apple-2-dark-filled.png');

  // 3. Switch to Light mode
  const lightBtn = page.locator('.theme-btn', { hasText: '浅色' });
  await lightBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(__dirname, 'apple-3-light-filled.png') });
  console.log('Captured apple-3-light-filled.png');

  // 4. Test Selection Toolbar appearance
  await page.evaluate(() => {
    const p = document.querySelector('.pm-body p');
    if (p) {
      const range = document.createRange();
      range.selectNodeContents(p);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(__dirname, 'apple-4-light-toolbar.png') });
  console.log('Captured apple-4-light-toolbar.png');

  // 5. Open API Settings popover
  const apiBtn = page.locator('button', { hasText: '服务' });
  if (await apiBtn.count()) {
    await apiBtn.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(__dirname, 'apple-5-api-settings.png') });
    console.log('Captured apple-5-api-settings.png');
  }

  console.log('Any page errors?', errors.length ? errors : 'None! Perfect.');

  await browser.close();
  server.kill();
  process.exit(0);
})();
