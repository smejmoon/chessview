// Browser proof for an isolated visual experiment, not ChessView production integration.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');
const captures = join(__dirname, 'screenshots');
mkdirSync(captures, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage']
  });
  const failures = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => failures.push('pageerror: ' + error.message));
  page.on('console', msg => { if (msg.type() === 'error') failures.push('console: ' + msg.text()); });
  try {
    await page.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
    await page.waitForFunction(() => Number(document.querySelector('#count-positions')?.textContent) > 10, { timeout: 15000 });
    await page.waitForTimeout(900);
    const initial = await page.evaluate(() => ({
      count: Number(document.querySelector('#count-positions').textContent),
      moves: Number(document.querySelector('#count-moves').textContent),
      merges: Number(document.querySelector('#count-merges').textContent),
      canvas: !!document.querySelector('#stage canvas'),
      gl: !!document.querySelector('#stage canvas')?.getContext('webgl2'),
      mode: document.querySelector('#twohalf').classList.contains('active')
    }));
    console.log('2.5D state:', JSON.stringify(initial));
    assert(initial.count > 10, 'Legal opening graph should contain positions');
    assert(initial.moves >= initial.count - 1, 'Graph must be connected through legal moves');
    assert(initial.merges > 0, 'Fixture must contain a real canonical merge');
    assert(initial.canvas && initial.gl && initial.mode, 'WebGL must initialize in 2.5D mode');
    await page.screenshot({ path: join(captures, '2-point-5d.png'), fullPage: true });
    await page.locator('#three').click();
    await page.waitForTimeout(700);
    assert(await page.locator('#three').evaluate(el => el.classList.contains('active')), '3D mode should activate');
    const mode3d = await page.locator('#mode-label').textContent();
    assert(mode3d.includes('FULL 3D'), '3D instructions should appear');
    await page.screenshot({ path: join(captures, '3d.png'), fullPage: true });
    await page.locator('#twohalf').click();
    assert(await page.locator('#twohalf').evaluate(el => el.classList.contains('active')), '2.5D mode should re-activate');
    assert.deepEqual(failures, [], 'Unexpected browser exceptions');
    console.log('PASS: WebGL initialized, legal graph + convergence displayed, 2.5D/3D mode switching and screenshots completed.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
