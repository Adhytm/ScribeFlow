const { chromium } = require('playwright-core');
const FILE = 'file:///' + encodeURI('D:/vault/一键文案撰写/index.html');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage();
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  const r = await page.evaluate(async () => {
    const out = { protocol: location.protocol, has: typeof window.showDirectoryPicker };
    if (window.showDirectoryPicker) {
      try { await window.showDirectoryPicker(); out.err = '(no error, picker opened)'; }
      catch (e) { out.err = e.name + ': ' + e.message; }
    }
    return out;
  });
  console.log(JSON.stringify(r, null, 2));
  await browser.close();
})();
