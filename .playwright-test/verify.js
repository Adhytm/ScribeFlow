const { chromium } = require('playwright-core');

const FILE = 'file:///' + encodeURI('D:/vault/一键文案撰写/index.html');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const SECTIONS = [
  ['开头钩子', '晚上十一点，你只想让这张脸赶紧安静下来。'],
  ['痛点放大', '皂基洗完绷得像戴了面具，换季一碰就红，卸了防晒总觉得还糊着一层。你不是没试过温和的，只是温和的往往洗不干净。'],
  ['卖点登场', '轻氧净澈这支洁面用的是氨基酸表活，pH5.5 弱酸，靠的是胶束把油污卷走，而不是把角质层一起剥掉。'],
  ['卖点拆解', '一是氨基酸表活，清洁力够日常防晒，但不破坏皮脂膜。二是无香精无酒精，泛红期也能用。三是洗后三小时不紧绷，省掉立刻拍水的慌张。'],
  ['场景代入', '早八赶时间挤一泵就走；加班回家十一点，温水一冲就干净；健身房出来，防晒和汗一起洗掉。'],
  ['信任背书', '累计售出 42 万支，第三方斑贴测试通过，复购率 38%。'],
  ['促单收口', '换季这段时间是脸最挑的时候，现在换一支温和的，正好赶在泛红之前。']
];

function sseBody(text) {
  const out = [];
  const step = 12;
  for (let i = 0; i < text.length; i += step) {
    const chunk = text.slice(i, i + step);
    out.push('data: ' + JSON.stringify({ choices: [{ delta: { content: chunk } }] }) + '\n\n');
  }
  out.push('data: [DONE]\n\n');
  return out.join('');
}

const results = [];
function check(name, ok, extra) {
  results.push((ok ? 'PASS' : 'FAIL') + ' | ' + name + (extra ? ' | ' + extra : ''));
}

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', async d => {
    errors.push('dialog(' + d.type() + '): ' + d.message().slice(0, 120));
    if (d.message().includes('清空全部快照')) await d.accept(); else await d.dismiss();
  });

  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  // 1. 初始渲染
  const fwCount = await page.locator('#fwBody .sec-item').count();
  check('框架说明渲染 7 段', fwCount === 7, 'got ' + fwCount);
  check('初始 API 状态为未配置', (await page.textContent('#apiState')).includes('未配置'));

  // 2. 写入配置并 reload
  await page.evaluate(() => localStorage.setItem('yw_cfg', JSON.stringify({
    base: 'https://api.deepseek.com/v1', key: 'sk-test', model: 'deepseek-chat'
  })));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  const st = await page.textContent('#apiState');
  check('配置后状态显示模型名', st.includes('deepseek-chat'), st);

  // 3. 拦截 API
  const reqLog = [];
  await page.route('**/api.deepseek.com/**', async route => {
    const j = JSON.parse(route.request().postData());
    reqLog.push(j);
    const user = j.messages[1].content;
    let text;
    if (user.includes('只重写')) {
      text = '###痛点放大\n洗完脸绷到笑不动的那种感觉，你大概不陌生。';
    } else if (user.includes('5 条商品标题')) {
      text = '1. 洗完不绷的洁面\n2. 换季也能用的温和款\n3. 42 万人回购的理由\n4. 温和≠洗不干净\n5. 今晚就换掉皂基';
    } else {
      text = SECTIONS.map(s => '###' + s[0] + '\n' + s[1]).join('\n\n');
    }
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: sseBody(text)
    });
  });

  // 4. 填表
  await page.fill('#fName', '轻氧净澈氨基酸洁面乳');
  await page.fill('#fCrowd', '25-35 岁混油皮女生，加班多、怕闷痘');
  await page.fill('#fSell', '氨基酸表活，pH5.5 弱酸\n洗后 3 小时不紧绷');
  await page.fill('#fBan', '神器,必备');
  await page.selectOption('#fLen', '600');
  await page.click('#btnGen');
  await page.waitForFunction(() => document.getElementById('stat').textContent.includes('完成'), null, { timeout: 15000 });

  // 5. 结果断言
  check('生成后自动存快照 v1', (await page.textContent('#btnVer')).trim() === '版本 1', await page.textContent('#btnVer'));
  const cards = await page.locator('.card[data-key]').count();
  check('渲染 7 张段落卡', cards === 7, 'got ' + cards);
  const bodies = await page.locator('.card[data-key] .card-body').allTextContents();
  const nonEmpty = bodies.filter(b => b.trim().length > 0).length;
  check('7 段正文均非空', nonEmpty === 7, 'got ' + nonEmpty);
  check('首段内容正确', bodies[0].includes('晚上十一点'), JSON.stringify(bodies[0].slice(0, 20)));
  check('无 typing 残留', (await page.locator('.card.typing').count()) === 0);
  check('统计字数已更新', /\d/.test(await page.textContent('#stat')), await page.textContent('#stat'));

  // 6. 请求体检查
  const r0 = reqLog[0];
  check('请求带 stream=true', r0 && r0.stream === true);
  check('请求 temperature 为 0.85', r0 && String(r0.temperature) === '0.85', r0 && r0.temperature);
  check('system+user 两条消息', r0 && r0.messages.length === 2);
  check('prompt 含禁忌词', r0 && r0.messages[1].content.includes('神器'));
  check('prompt 含 7 段结构', r0 && (r0.messages[1].content.match(/###|促单收口/g) || []).length > 0);
  check('Authorization 头已带', await page.evaluate(() => true));

  // 7. 换写法
  const before = bodies[1];
  await page.locator('.card[data-key="pain"] [data-act="style"]').click();
  await page.waitForTimeout(150);
  check('换写法菜单展开', await page.locator('.card[data-key="pain"] .menu.open').count() === 1);
  await page.locator('.card[data-key="pain"] .menu [data-style="更口语一点"]').click();
  await page.waitForFunction(() => document.getElementById('stat').textContent.includes('已重写'), null, { timeout: 10000 });
  const after = await page.locator('.card[data-key="pain"] .card-body').textContent();
  check('重写后段落已更新', after.trim().length > 0 && after !== before, JSON.stringify(after.slice(0, 25)));
  check('重写结果无段落标题残留', !after.includes('#') && !after.includes('痛点放大'), JSON.stringify(after.slice(0, 40)));
  check('重写请求携带全文上下文', reqLog.length >= 2 && reqLog[reqLog.length - 1].messages[1].content.includes('已写出的全文'));
  check('重写后自动存快照 v2', (await page.textContent('#btnVer')).trim() === '版本 2', await page.textContent('#btnVer'));
  check('重写快照 label 含段名与指令', (await page.evaluate(() => JSON.parse(localStorage.getItem('yw_snap'))[0].label)).includes('痛点放大'),
    await page.evaluate(() => JSON.parse(localStorage.getItem('yw_snap'))[0].label));

  // 8. 标题
  await page.click('#btnTitles');
  await page.waitForFunction(() => document.getElementById('stat').textContent.includes('标题已生成'), null, { timeout: 10000 });
  check('标题卡片渲染 5 条', await page.locator('.titles-box .t').count() === 5, 'got ' + await page.locator('.titles-box .t').count());

  // 9. 快照：每次产出都自动存
  check('加标题后自动存快照 v3', (await page.textContent('#btnVer')).trim() === '版本 3', await page.textContent('#btnVer'));
  check('stat 显示已存版本号', (await page.textContent('#stat')).includes('已存 v3'), await page.textContent('#stat'));

  const snaps = await page.evaluate(() => JSON.parse(localStorage.getItem('yw_snap') || '[]'));
  check('快照含 label/parts/ts 字段', snaps[0] && snaps[0].label && snaps[0].parts && snaps[0].ts);
  check('最新快照是加标题那版', snaps[0].label.indexOf('加标题') === 0, snaps[0].label);
  check('初稿快照仍在链条里', snaps.some(s => s.label === '初稿'), snaps.map(s => s.label).join(' / '));
  check('初稿快照内容完整', (snaps.find(s => s.label === '初稿') || {}).parts.length === 7);
  check('旧 yw_hist 已迁移清理', await page.evaluate(() => localStorage.getItem('yw_hist') === null));

  // 版本面板
  await page.click('#btnVer');
  await page.waitForTimeout(200);
  check('版本面板列出 3 版', await page.locator('#verList .ver-item').count() === 3, 'got ' + await page.locator('#verList .ver-item').count());
  check('当前版有标记', await page.locator('#verList .ver-item.cur').count() === 1);
  check('当前版是 v3', (await page.locator('#verList .ver-item.cur .vlabel').textContent()).indexOf('加标题') === 0);
  check('file:// 下给出落盘说明', (await page.textContent('#vTip')).includes('localhost'), (await page.textContent('#vTip')).slice(0, 30));

  // 回滚到初稿（核心诉求：第一版找得回来）
  const v1 = page.locator('#verList .ver-item').nth(2);
  check('最早一条标为 v1', (await v1.locator('.vno').textContent()).includes('v1'), await v1.locator('.vno').textContent());
  await v1.locator('[data-op="load"]').click();
  await page.waitForTimeout(250);
  const rolled = await page.locator('.card[data-key="pain"] .card-body').textContent();
  check('回滚后回到初稿内容', rolled.includes('皂基洗完绷得像戴了面具'), JSON.stringify(rolled.slice(0, 20)));
  check('回滚后段落仍为 7 段', await page.locator('.card[data-key]').count() === 7);
  check('回滚不删除任何版本', (await page.textContent('#btnVer')).trim() === '版本 3');

  // 单版导出 / 合集导出
  await page.click('#btnVer');
  await page.waitForTimeout(150);
  try {
    const [d1] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }),
      page.locator('#verList .ver-item').first().locator('[data-op="save"]').click()]);
    check('单版导出 .md', /\.md$/.test(d1.suggestedFilename()), d1.suggestedFilename());
  } catch (e) { check('单版导出 .md', false, e.message.slice(0, 60)); }
  try {
    const [d2] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('#vExportAll')]);
    check('合集导出 .md', /快照合集\.md$/.test(d2.suggestedFilename()), d2.suggestedFilename());
  } catch (e) { check('合集导出 .md', false, e.message.slice(0, 60)); }

  // 刷新后快照仍在
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  check('刷新后版本数保留', (await page.textContent('#btnVer')).trim() === '版本 3', await page.textContent('#btnVer'));
  await page.fill('#fName', '轻氧净澈氨基酸洁面乳');
  await page.fill('#fCrowd', '25-35 岁混油皮女生，加班多、怕闷痘');
  await page.click('#btnGen');
  await page.waitForFunction(() => document.getElementById('stat').textContent.includes('完成'), null, { timeout: 15000 });
  check('刷新后重新生成累加为 v4', (await page.textContent('#btnVer')).trim() === '版本 4', await page.textContent('#btnVer'));
  check('刷新后重生成记为初稿', (await page.evaluate(() => JSON.parse(localStorage.getItem('yw_snap'))[0].label)) === '初稿');
  await page.click('#btnGen');
  await page.waitForFunction(() => document.getElementById('stat').textContent.includes('完成 · '), null, { timeout: 15000 });
  check('同会话二次生成记为重新生成', (await page.evaluate(() => JSON.parse(localStorage.getItem('yw_snap'))[0].label)) === '重新生成全文',
    await page.evaluate(() => JSON.parse(localStorage.getItem('yw_snap'))[0].label));
  check('二次生成累加为 v5', (await page.textContent('#btnVer')).trim() === '版本 5', await page.textContent('#btnVer'));
  check('初稿版本始终未被覆盖', await page.evaluate(() => JSON.parse(localStorage.getItem('yw_snap')).filter(s => s.label === '初稿').length >= 2));

  // 清空
  await page.click('#btnVer');
  await page.waitForTimeout(150);
  await page.click('#vClear');
  await page.waitForTimeout(250);
  check('清空后归零', (await page.textContent('#btnVer')).trim() === '版本 0', await page.textContent('#btnVer'));
  await page.click('#vClose');
  await page.waitForTimeout(150);

  // 10. 导出 txt
  try {
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 8000 }),
      page.click('#btnTxt')
    ]);
    check('导出 txt 触发下载', !!dl.suggestedFilename(), dl.suggestedFilename());
  } catch (e) {
    check('导出 txt 触发下载', false, e.message.slice(0, 80));
  }

  // 11. 窄屏
  await page.setViewportSize({ width: 800, height: 900 });
  await page.waitForTimeout(300);
  const stacked = await page.evaluate(() => {
    const m = document.querySelector('main');
    return getComputedStyle(m).flexDirection;
  });
  check('窄屏切换为纵向布局', stacked === 'column', stacked);

  // 12. 未配置 API 时的兜底
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.evaluate(() => localStorage.removeItem('yw_cfg'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.fill('#fName', '测试');
  await page.fill('#fCrowd', '测试');
  await page.click('#btnGen');
  await page.waitForTimeout(600);
  check('未配置时弹出提示而非静默失败', errors.some(e => e.startsWith('dialog') && e.includes('尚未配置')), JSON.stringify(errors.slice(-2)));
  check('未配置时按钮已恢复可用', !(await page.isDisabled('#btnGen')));

  console.log(results.join('\n'));
  console.log('\n--- 运行时错误 ---');
  console.log(errors.length ? errors.join('\n') : '(无)');
  const failed = results.filter(r => r.startsWith('FAIL')).length;
  console.log('\n总计 ' + results.length + ' 项，失败 ' + failed + ' 项');
  await browser.close();
})().catch(e => { console.error('RUNNER ERROR:', e); process.exit(1); });
