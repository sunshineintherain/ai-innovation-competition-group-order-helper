// Run with Node.js, Playwright and an installed Chrome channel.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const {chromium} = require('playwright');

async function run() {
  const root = path.resolve(__dirname, '..');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'campus-import-'));
  const stateFile = path.join(temp, 'state.json');
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd:root, windowsHide:true,
    env:{...process.env, PORT:'0', CAMPUS_STATE:stateFile, CAMPUS_MODEL:''},
    stdio:['ignore','pipe','inherit'],
  });
  let browser;
  try {
    const [startup] = await once(child.stdout, 'data');
    const url = String(startup).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
    assert.ok(url, 'Server announced an ephemeral local URL');
    browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'chrome', headless:true});
    const page = await browser.newPage({viewport:{width:1100,height:820}, locale:'en-MY'});
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto(url);
    const card = page.locator('article[aria-label="Proposed group"]');
    await card.waitFor();
    const cells = async alias => card.getByRole('row', {name:new RegExp('^' + alias + ' ')}).getByRole('cell').allTextContents();
    assert.deepEqual(await cells('Aster'), ['RM12.00','RM9.82','RM2.18']);

    await page.getByRole('link', {name:'Merchant catalog'}).click();
    await page.getByLabel('Merchant JSON file').setInputFiles(path.join(root,'fixtures','needs-review.json'));
    await page.getByRole('heading', {name:'Needs review'}).waitFor();
    const activate = page.getByRole('button', {name:'Confirm and activate'});
    assert.ok(await activate.isDisabled(), 'Invalid input is blocked');
    for (const field of ['thresholdBasis','end']) {
      assert.ok(await page.getByText('$.offers[0].' + field, {exact:true}).isVisible());
    }
    await page.getByLabel('Verified threshold basis').selectOption('eligible-subtotal');
    await page.getByLabel('Verified validity end (MYT)').fill('2026-12-01T14:00');
    await page.getByRole('button', {name:'Apply corrections and recheck'}).click();
    await page.getByRole('heading', {name:'Ready for confirmation'}).waitFor();
    assert.ok(await page.locator('.ci-entry').filter({hasText:'Simulated offer · Lunch Together · group orders'}).isVisible());
    await activate.click();
    await page.getByText('Catalog activated. Matching has been recalculated.', {exact:true}).waitFor();
    console.log('PASS uploaded ambiguous JSON; both clause paths shown; activation blocked until corrected.');

    await page.getByRole('link', {name:'Board', exact:true}).click();
    const consent = card.getByRole('button', {name:'Confirm for Aster'});
    const oldKey = await consent.getAttribute('data-key');
    await consent.click();
    await card.getByText('✓ Aster confirmed', {exact:true}).waitFor();
    await page.getByRole('link', {name:'Merchant catalog'}).click();
    await page.getByRole('button', {name:'Review terms for Demo Café'}).click();
    await page.getByRole('heading', {name:'Ready for confirmation'}).waitFor();
    const editor = page.getByLabel('Editable source JSON');
    const merchant = JSON.parse(await editor.inputValue());
    merchant.items.find(item => item.id === 'lunch').price = 1400;
    await editor.fill(JSON.stringify(merchant,null,2));
    assert.ok(await activate.isDisabled(), 'Editing the JSON invalidates its preview');
    await page.getByRole('button', {name:'Check terms'}).click();
    await page.locator('.ci-entry').filter({hasText:'Lunch Set · RM14.00'}).waitFor();
    await activate.click();
    await page.getByText('Catalog activated. Matching has been recalculated.', {exact:true}).waitFor();
    await page.getByRole('link', {name:'Board', exact:true}).click();
    await consent.waitFor();
    assert.notEqual(await consent.getAttribute('data-key'), oldKey);
    assert.deepEqual(await cells('Aster'), ['RM14.00','RM11.67','RM2.33']);
    assert.deepEqual(await cells('Birch'), ['RM10.00','RM8.33','RM1.67']);
    assert.deepEqual(await cells('Total'), ['RM24.00','RM20.00','RM4.00']);
    await card.getByText('Member confirmations · 0/2', {exact:true}).waitFor();
    await page.reload();
    await consent.waitFor();
    await consent.click();
    await card.getByText('✓ Aster confirmed', {exact:true}).waitFor();
    await card.getByRole('button', {name:'Confirm for Birch'}).click();
    const final = page.locator('article[aria-label="Confirmed group summary"]');
    await final.waitFor();
    assert.match(await final.innerText(), /RM20\.00/);
    assert.equal(await final.count(), 1);
    assert.deepEqual(errors, []);
    console.log('PASS changed lunch from RM12 to RM14 after one signature; new proposal has zero signatures; RM11.67 + RM8.33 = RM20.00. Refresh and both confirmations produce one summary.');
  } finally {
    if (browser) await browser.close();
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child,'exit');
      child.kill();
      await exited;
    }
    if (fs.existsSync(stateFile)) fs.unlinkSync(stateFile);
    fs.rmdirSync(temp);
  }
}
run().catch(err => {console.error(err.message); process.exitCode = 1;});
