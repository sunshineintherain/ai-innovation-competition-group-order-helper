/* Run from the project root. npm install --no-save playwright is optional if the bundled runtime is present. */
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
function getBrowser(){
  const bundled=path.resolve(path.dirname(process.execPath),'../node_modules/playwright');
  for(const name of ['playwright',bundled,path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')]){
    try{return require(name).chromium;}catch(e){if(e.code!=='MODULE_NOT_FOUND') throw e;}
  }
  throw Error('Install Playwright or use the bundled workspace runtime.');
}
async function run(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'campus-e2e-'));
  const proc=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',CAMPUS_STATE:path.join(dir,'state.json')},stdio:['ignore','pipe','inherit']});
  let browser;
  try {
    const [message]=await once(proc.stdout,'data');const url=message.toString().trim().split(' ').at(-1);
    const executablePath=[process.env.CHROME_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&fs.existsSync(p));
    browser=await getBrowser().launch({executablePath,headless:true});
    for(const width of [1366,390]){
      const page=await browser.newPage({viewport:{width,height:880},locale:'en-GB'});
      page.setDefaultTimeout(6000);
      const issues=[];page.on('pageerror',e=>issues.push(e.message));
      const click=async(name)=>page.getByRole('button',{name,exact:true}).click();
      const link=async(name)=>page.getByRole('link',{name,exact:true}).click();
      async function screen(name){
        assert.equal(await page.locator('html').getAttribute('lang'),'en');
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
        assert.equal(overflow,false,'Viewport overflow on '+name);
        assert.doesNotMatch(await page.locator('body').innerText(),/[\u3400-\u9fff]/);
      }
      await page.goto(url);
      await link('Demo controls');await click('Reset demo');
      const card=page.getByRole('article',{name:'Proposed group'});
      await card.waitFor();
      for(const v of ['RM9.82','RM8.18','RM18.00','12:35–12:50','12:25']) assert.ok((await card.innerText()).includes(v));
      await screen('Board');
      if(process.env.CAMPUS_SCREENSHOTS){
        fs.mkdirSync(process.env.CAMPUS_SCREENSHOTS,{recursive:true});
        await page.screenshot({path:path.join(process.env.CAMPUS_SCREENSHOTS,'board-'+width+'.png')});
      }
      await click('Confirm for Aster');await click('Confirm for Birch');
      const summary=page.getByRole('article',{name:'Confirmed group summary'});
      await summary.waitFor();await page.reload();await summary.waitFor();
      await click('Edit Birch');await page.locator('[name=earliest]').fill('12:55');
      await click('Save changes');await page.getByText('Your pickup windows do not overlap.',{exact:true}).first().waitFor();
      assert.equal(await card.count(),0);
      await page.getByRole('button',{name:/^New request/}).click();
      await page.locator('#intent').fill('I want the RM10 rice bowl from Demo Café. I can pick it up between 12:35 and 12:50 today.');
      await click('Read my request');await page.waitForFunction(()=>document.querySelector('[name=item]').value==='bowl');
      assert.equal(await page.locator('[name=earliest]').inputValue(),'12:35');
      assert.equal(await page.locator('[name=alias]').inputValue(),'Clover');
      await screen('English draft');
      await click('Publish request');await card.waitFor();
      assert.match(await card.innerText(),/Clover/);assert.doesNotMatch(await card.innerText(),/Birch/);
      await click('Confirm for Clover');await click('Confirm for Aster');await summary.waitFor();await screen('Summary');
      await click('Edit Clover');await click('Withdraw request');
      await page.getByText('Your pickup windows do not overlap.',{exact:true}).first().waitFor();
      await link('Merchant catalog');await page.getByRole('heading',{name:'Merchant catalog',exact:true}).waitFor();await screen('Catalog');
      assert.deepEqual(issues,[]);await page.close();
      console.log(width+' px: reset, price split, joint confirmation, reload, time conflict, English draft, new pairing, summary, withdrawal, catalog and layout passed.');
    }
  } finally {
    if(browser) await browser.close();
    if(proc.exitCode===null){const exit=once(proc,'exit');proc.kill();await exit;}
    fs.rmSync(dir,{recursive:true,force:true});
  }
}
run().catch(e=>{console.error(e);process.exitCode=1;});

