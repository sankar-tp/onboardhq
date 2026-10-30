import { after, afterEach, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './helpers/browser.mjs'
let browser
before(async()=>{browser=await launchBrowser()})
after(async()=>{await browser?.close()})
beforeEach(async()=>{await browser.reset();browser.acceptDialog=true})
afterEach(()=>assert.deepEqual(browser.errors,[],'No browser runtime/console errors'))
const nav=path=>browser.click(`.sidebar nav a[href="${path}"]`)
async function field(label,value) {
  const selector=await browser.evaluate(label=>{const dialog=[...document.querySelectorAll('dialog[open]')].at(-1);const field=[...dialog.querySelectorAll('label')].find(el=>el.querySelector('span')?.textContent===label);if(!field)throw Error(`Missing ${label}`);return '#'+CSS.escape(field.htmlFor)},label)
  await browser.fill(selector,value)
}
async function metric(label) {return browser.evaluate(label=>[...document.querySelectorAll('.stat-card')].find(el=>el.querySelector('.stat-top')?.textContent===label)?.querySelector('.stat-value').textContent,label)}
test('F01 repeated declined Escape preserves exact form values, focus and text selection',async()=>{
  for(const selector of ['.modal-heading button','input[type=text]','select','button[type=submit]']) {
    await browser.reset();await nav('/employees');await browser.textClick('main button','Add employee')
    await field('Full name','Fictional preserved draft');await field('Job role','Fictional QA');await field('Manager','Jordan Blake')
    const before=await browser.evaluate(selector=>{
      const dialog=document.querySelector('dialog[open]'),focused=dialog.querySelector(selector);focused.dataset.focusMarker='preserved';focused.focus()
      if(focused.tagName==='INPUT') focused.setSelectionRange(3,12)
      window.escapeAnswers=[];const confirm=window.confirm;window.confirm=message=>{const result=confirm(message);window.escapeAnswers.push(result);return result}
      return {values:[...dialog.querySelectorAll('input,select')].map(el=>el.value),selection:[focused.selectionStart,focused.selectionEnd],storage:localStorage.getItem('onboardhq.workspace.v1')}
    },selector)
    browser.acceptDialog=false
    for(let attempt=1;attempt<=3;attempt++) {
      await browser.key('Escape','Escape',27);await browser.waitFor(()=>document.querySelectorAll('dialog[open]').length===1)
      const after=await browser.evaluate(()=>({open:document.querySelectorAll('dialog[open]').length,values:[...document.querySelector('dialog[open]').querySelectorAll('input,select')].map(el=>el.value),focus:document.activeElement.dataset.focusMarker,selection:[document.activeElement.selectionStart,document.activeElement.selectionEnd],answers:window.escapeAnswers,storage:localStorage.getItem('onboardhq.workspace.v1')}))
      assert.equal(after.open,1,selector);assert.deepEqual(after.values,before.values,selector);assert.equal(after.focus,'preserved',selector);assert.deepEqual(after.selection,before.selection,selector);assert.equal(after.answers.length,attempt);assert.equal(after.answers.at(-1),false);assert.equal(after.storage,before.storage)
    }
  }
})
test('F01 nested file picker retains selected metadata and focus when Escape discard is declined',async()=>{
  await nav('/employees');await browser.evaluate(()=>{const row=[...document.querySelectorAll('tbody tr')].find(el=>el.textContent.includes('Avery Morgan'));[...row.querySelectorAll('button')].find(el=>el.textContent.startsWith('View')).click()})
  await browser.click('[data-tab="documents"]');await browser.click('[aria-label="Simulate ID proof submission"]');await field('Or choose sample metadata','0')
  await browser.evaluate(()=>{const select=[...document.querySelectorAll('dialog[open]')].at(-1).querySelector('select');select.dataset.focusMarker='file-choice';select.focus()})
  browser.acceptDialog=false;await browser.key('Escape','Escape',27)
  assert.equal(await browser.evaluate(()=>document.querySelectorAll('dialog[open]').length),2)
  assert.equal(await browser.evaluate(()=>document.activeElement.dataset.focusMarker),'file-choice')
  assert.equal(await browser.evaluate(()=>[...document.querySelectorAll('dialog[open]')].at(-1).querySelector('select').value),'0')
  assert.match(await browser.evaluate(()=>[...document.querySelectorAll('dialog[open]')].at(-1).textContent),/Selected, not submitted/)
  browser.acceptDialog=true;await browser.key('Escape','Escape',27)
  await browser.waitFor(()=>document.querySelectorAll('dialog[open]').length===1)
})
test('F02 wide tables remain internally scrollable at 768 and 1024 without document scrolling',async()=>{
  for(const width of [768,1024]) {
    await browser.command('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false})
    for(const role of ['HR','Employee','IT','Manager']) {
      await browser.fill('[aria-label="Demo role (UI simulation)"]',role)
      for(const path of ['/employees','/onboarding']) {
      await nav(path)
      const result=await browser.evaluate(()=>{const region=[...document.querySelectorAll('.table-scroll')].find(el=>el.scrollWidth>el.clientWidth);if(!region)throw Error('Expected a wide scrollable table');region.scrollLeft=180;window.scrollTo(500,0);return {pageX:scrollX,rootWidth:document.documentElement.scrollWidth,viewport:innerWidth,tableX:region.scrollLeft}})
      assert.equal(result.pageX,0,`${path} ${width}`);assert.ok(result.rootWidth<=result.viewport);assert.ok(result.tableX>0)
      }
    }
  }
})
test('F03 empty reports show N/A but a saved employee with no mandatory documents stays 100% ready',async()=>{
  await browser.evaluate(()=>{const data=JSON.parse(localStorage.getItem('onboardhq.workspace.v1'));data.demoRole='Employee';data.demoEmployeeId='EMP-001';for(const doc of data.documents)if(doc.employeeId==='EMP-001')doc.required=false;localStorage.setItem('onboardhq.workspace.v1',JSON.stringify(data))})
  await browser.command('Page.reload');await browser.waitFor(()=>document.querySelector('[aria-label="Demo role (UI simulation)"]')?.value==='Employee')
  const stored=await browser.evaluate(()=>localStorage.getItem('onboardhq.workspace.v1'))
  await nav('/reports');assert.equal(await metric('Employees'),'1');assert.equal(await metric('Document readiness'),'100%')
  const statusSelector=await browser.evaluate(()=>{const label=[...document.querySelectorAll('main label')].find(el=>el.querySelector('span')?.textContent==='Onboarding status');return '#'+CSS.escape(label.htmlFor)})
  await browser.fill(statusSelector,'Completed');assert.equal(await metric('Employees'),'0');assert.equal(await metric('Document readiness'),'N/A')
  assert.equal(await browser.evaluate(()=>localStorage.getItem('onboardhq.workspace.v1')),stored)
})
test('F04 profile and trigger follow Employee identity changes while staff modes keep role labels',async()=>{
  for(const [role,label] of [['HR','HR'],['IT','IT Admin'],['Manager','Manager']]) {
    await browser.fill('[aria-label="Demo role (UI simulation)"]',role);await browser.click('[aria-label="View profile"]')
    const text=await browser.evaluate(()=>document.querySelector('.header-popover:popover-open').textContent)
    assert.match(text,/Alex Carter/);assert.ok(text.includes(`Demo role: ${label}`))
    await browser.click('[aria-label="Close your profile"]')
  }
  await browser.fill('[aria-label="Demo role (UI simulation)"]','Employee');await browser.fill('[aria-label="Employee identity"]','EMP-002');await browser.click('[aria-label="View profile"]')
  assert.match(await browser.evaluate(()=>document.querySelector('.header-popover:popover-open').textContent),/Jamie Quinn.*Design · Product Designer/)
  assert.match(await browser.evaluate(()=>document.querySelector('[aria-label="View profile"]').textContent),/Jamie Quinn/)
  assert.doesNotMatch(await browser.evaluate(()=>document.querySelector('.header-popover:popover-open').textContent),/Workspace administrator/)
  await browser.fill('[aria-label="Employee identity"]','EMP-004')
  assert.match(await browser.evaluate(()=>document.querySelector('.header-popover:popover-open').textContent),/Sam Ellis/)
  await browser.click('[aria-label="Close your profile"]')
  await browser.command('Page.reload');await browser.waitFor(()=>document.querySelector('[aria-label="Employee identity"]')?.value==='EMP-004')
  await browser.click('[aria-label="View profile"]');assert.match(await browser.evaluate(()=>document.querySelector('.header-popover:popover-open').textContent),/Sam Ellis/)
})
