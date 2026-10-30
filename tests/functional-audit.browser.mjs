import { after, afterEach, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { launchBrowser } from './helpers/browser.mjs'
let browser
before(async()=>{browser=await launchBrowser();console.log('AUDIT_BROWSER',await browser.command('Browser.getVersion'))})
after(async()=>{await browser?.close()})
beforeEach(async()=>{await browser.reset();browser.acceptDialog=true;await browser.command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})})
afterEach(()=>assert.deepEqual(browser.errors,[],'No runtime/console errors'))
const read=()=>browser.evaluate(()=>JSON.parse(localStorage.getItem('onboardhq.workspace.v1')))
const nav=path=>browser.click(`.sidebar nav a[href="${path}"]`)
async function field(label,value) {
  const selector=await browser.evaluate(label=>{const dialog=[...document.querySelectorAll('dialog[open]')].at(-1);const field=[...dialog.querySelectorAll('label')].find(el=>el.querySelector('span')?.textContent===label);if(!field)throw Error(`Missing ${label}`);return '#'+CSS.escape(field.htmlFor)},label)
  await browser.fill(selector,value)
}
const save=()=>browser.textClick('dialog[open] form button','Save changes')
async function rowAction(text,button) {
  await browser.evaluate((text,button)=>{const row=[...document.querySelectorAll('tbody tr')].find(r=>r.textContent.includes(text));if(!row)throw Error(`Missing row ${text}`);const action=[...row.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(button));if(!action)throw Error(`Missing ${button} for ${text}`);action.click()},text,button)
  await browser.waitFor(()=>document.readyState==='complete')
}
async function metric(label) {return browser.evaluate(label=>{const card=[...document.querySelectorAll('.stat-card')].find(c=>c.querySelector('.stat-top')?.textContent.trim()===label);if(!card)throw Error(`Missing metric ${label}`);return card.querySelector('.stat-value').textContent.trim()},label)}
async function reportField(label,value) {const id=await browser.evaluate(label=>{const field=[...document.querySelectorAll('main label')].find(l=>l.querySelector('span')?.textContent===label);return '#'+CSS.escape(field.htmlFor)},label);await browser.fill(id,value)}
test('A01 access requests: create, duplicate validation, approve, revoke, reopen and reject',async()=>{
  await nav('/assets');await browser.textClick('main button','Request access')
  await field('Application name','Fictional Audit IDE');await field('Employee','EMP-001');await save()
  let record=(await read()).access.find(a=>a.item==='Fictional Audit IDE');assert.equal(record.status,'Pending')
  await browser.textClick('main button','Request access');await field('Application name','fictional audit ide');await field('Employee','EMP-001');await save()
  assert.match(await browser.evaluate(()=>[...document.querySelectorAll('dialog[open]')].at(-1).textContent),/already has a pending or approved/)
  await browser.textClick('dialog[open] form button','Cancel')
  await browser.fill('[aria-label="Demo role (UI simulation)"]','IT');await rowAction('Fictional Audit IDE','Approve')
  assert.equal((await read()).access.find(a=>a.id===record.id).status,'Approved')
  await rowAction('Fictional Audit IDE','Revoke');assert.equal((await read()).access.find(a=>a.id===record.id).status,'Revoked')
  await rowAction('Fictional Audit IDE','Reopen');await rowAction('Fictional Audit IDE','Reject');assert.equal((await read()).access.find(a=>a.id===record.id).status,'Rejected')
  await browser.command('Page.reload');await browser.waitFor(()=>document.querySelector('h1')?.textContent==='Assets & Access')
  assert.match(await browser.evaluate(()=>[...document.querySelectorAll('tbody tr')].find(r=>r.textContent.includes('Fictional Audit IDE')).textContent),/Rejected/)
})
test('A02 dashboard independently matches stored records and updates after task creation/completion',async()=>{
  const data=await read()
  const snapshot=await browser.evaluate(()=>{const data=JSON.parse(localStorage.getItem('onboardhq.workspace.v1'));const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});const end=new Date(`${today}T12:00:00`);end.setDate(end.getDate()+14);const future=end.toLocaleDateString('en-CA');return {upcoming:data.employees.filter(e=>e.joiningDate>=today&&e.joiningDate<=future).length,done:data.journeys.filter(id=>{const tasks=data.tasks.filter(t=>t.employeeId===id);return tasks.length&&tasks.every(t=>t.status==='Completed')}).length,attention:data.tasks.filter(t=>t.status!=='Completed'&&t.due<today).length+data.access.filter(a=>a.status==='Pending').length,missing:data.documents.filter(d=>d.required&&d.status==='Missing').length}})
  assert.equal(Number(await metric('Upcoming new hires')),snapshot.upcoming);assert.equal(Number(await metric('Completed onboarding')),snapshot.done);assert.equal(Number(await metric('Needs attention')),snapshot.attention)
  assert.match(await browser.evaluate(()=>document.querySelector('.document-dashboard').textContent),new RegExp(`Missing mandatory documents${snapshot.missing}`))
  await nav('/onboarding');await browser.textClick('main button','Add task')
  await field('Employee journey','EMP-005');await field('Task title','Fictional audit blocked task');await field('Task owner','Manager');await field('Due date','2000-01-01');await field('Priority','Urgent');await field('Task status','Blocked');await field('Reason (required for Blocked)','Awaiting fictional approval');await save()
  await nav('/');assert.equal(Number(await metric('Completed onboarding')),snapshot.done-1);assert.equal(Number(await metric('Needs attention')),snapshot.attention+1)
  assert.match(await browser.evaluate(()=>document.querySelector('.activity-item').textContent),/Fictional audit blocked task/)
  await nav('/reports');assert.equal(await metric('Blocked tasks'),'1');assert.equal(Number(await metric('Overdue tasks')),1)
  await nav('/onboarding');await browser.fill('[aria-label="Filter task status"]','Blocked');await rowAction('Fictional audit blocked task','Complete')
  await nav('/');assert.equal(Number(await metric('Completed onboarding')),snapshot.done);assert.equal(Number(await metric('Needs attention')),snapshot.attention)
  assert.equal((await read()).employees.length,data.employees.length)
})
test('A03 required fields, duplicate names, empty states and cancelled unsaved/deletion actions',async()=>{
  await nav('/employees');const count=(await read()).employees.length
  await browser.textClick('main button','Add employee');await save()
  assert.equal(await browser.evaluate(()=>document.querySelector('dialog[open] form').checkValidity()),false)
  await field('Full name','Avery Morgan');await field('Job role','Fictional Engineer');await field('Manager','Jordan Blake');await save()
  assert.match(await browser.evaluate(()=>document.querySelector('dialog[open]').textContent),/already exists/)
  browser.acceptDialog=false
  await browser.textClick('dialog[open] form button','Cancel');assert.equal(await browser.evaluate(()=>document.querySelectorAll('dialog[open]').length),1)
  browser.acceptDialog=true;await browser.key('Escape','Escape',27)
  assert.equal((await read()).employees.length,count)
  browser.acceptDialog=false;await rowAction('Avery Morgan','Delete');assert.equal((await read()).employees.length,count)
  await browser.fill('[aria-label="Search employees"]','does-not-exist-audit');assert.match(await browser.evaluate(()=>document.querySelector('main').textContent),/No results found/)
})
test('A04 HR document waiver, request resubmission and template application preserve task progress',async()=>{
  await nav('/employees');await rowAction('Avery Morgan','View');await browser.click('[data-tab="documents"]')
  const originalTasks=(await read()).tasks
  await browser.click('[aria-label="Review ID proof"]');await field('Review decision','Waived');await field('Remarks (required unless verifying)','Fictional audit exception');await save()
  let record=(await read()).documents.find(d=>d.id==='EMP-001:id-proof');assert.equal(record.status,'Waived')
  await browser.click('[aria-label="Review ID proof"]');await field('Review decision','Request resubmission');await field('Remarks (required unless verifying)','Please submit fictional replacement');await save()
  record=(await read()).documents.find(d=>d.id==='EMP-001:id-proof');assert.equal(record.status,'Missing');assert.equal(record.resubmissionRequested,true)
  await browser.textClick('.employee-profile-modal button','Apply checklist template');await field('Hire type','Experienced Hires');await save()
  const next=await read();assert.equal(next.documents.filter(d=>d.employeeId==='EMP-001'&&d.required).length,7);assert.deepEqual(next.tasks,originalTasks)
})
test('A05 all routes render at desktop, tablet and mobile without page-level overflow',async()=>{
  const routes=[['/','Dashboard'],['/employees','Employees'],['/onboarding','Onboarding'],['/assets','Assets & Access'],['/reports','Reports']]
  const overflows=[]
  for(const width of [320,390,768,1024,1440]) {
    await browser.command('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768})
    for(const [path,title] of routes) {
      // Programmatic link activation checks route/layout at each size; drawer pointer/keyboard behavior has separate coverage.
      await nav(path)
      assert.equal(await browser.evaluate(()=>document.querySelector('main h1').textContent),title)
      const measure=await browser.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:innerWidth}))
      if(measure.content>measure.viewport+1) overflows.push({path,width,...measure,elements:await browser.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(el).visibility!=='hidden'&&!el.closest('.table-scroll')).slice(0,8).map(el=>({tag:el.tagName,class:el.className,right:Math.round(el.getBoundingClientRect().right)})))})
    }
  }
  console.log('AUDIT_LAYOUT',JSON.stringify(overflows))
  assert.deepEqual(overflows,[],'Pages must contain horizontal scrolling within table regions')
})
test('A06 Manager/IT queues and Employee identity scopes are role-relevant and persist',async()=>{
  for(const role of ['Manager','IT']) {
    await browser.fill('[aria-label="Demo role (UI simulation)"]',role);await nav('/onboarding')
    const owners=await browser.evaluate(()=>{const table=[...document.querySelectorAll('table')].find(t=>t.caption?.textContent==='Onboarding tasks');return [...table.querySelectorAll('tbody tr')].map(r=>r.cells[2].textContent)})
    assert.ok(owners.length);assert.equal(owners.every(owner=>owner===(role==='IT'?'IT Admin':'Manager')),true)
  }
  await browser.fill('[aria-label="Demo role (UI simulation)"]','Employee');await browser.fill('[aria-label="Employee identity"]','EMP-002');await nav('/employees')
  assert.equal(await browser.evaluate(()=>document.querySelectorAll('tbody tr').length),1);assert.match(await browser.evaluate(()=>document.querySelector('tbody').textContent),/Jamie Quinn/)
  await nav('/assets');assert.doesNotMatch(await browser.evaluate(()=>document.querySelector('main').textContent),/Avery Morgan/)
  await browser.command('Page.reload');await browser.waitFor(()=>document.querySelector('h1')?.textContent==='Assets & Access')
  assert.equal(await browser.evaluate(()=>document.querySelector('[aria-label="Demo role (UI simulation)"]').value),'Employee');assert.equal(await browser.evaluate(()=>document.querySelector('[aria-label="Employee identity"]').value),'EMP-002')
})
test('A07 corrupt storage remains intact and shows read-only error feedback',async()=>{
  await browser.evaluate(()=>localStorage.setItem('onboardhq.workspace.v1','{broken'))
  await browser.command('Page.reload');await browser.waitFor(()=>!!document.querySelector('.feedback-error'))
  assert.match(await browser.evaluate(()=>document.querySelector('.feedback-error').textContent),/Changes are disabled/)
  assert.equal(await browser.evaluate(()=>localStorage.getItem('onboardhq.workspace.v1')),'{broken')
})
test('A08 reports with zero matching employees must not claim 100% document readiness',async()=>{
  await nav('/reports');await reportField('Department','Design');await reportField('Onboarding status','Completed')
  assert.equal(await metric('Employees'),'0')
  assert.notEqual(await metric('Document readiness'),'100%','No matching employees/documents should show N/A or 0%, not 100%')
})
test('A09 header user profile should follow the selected Employee demo identity',async()=>{
  await browser.fill('[aria-label="Demo role (UI simulation)"]','Employee');await browser.fill('[aria-label="Employee identity"]','EMP-002')
  await browser.click('[aria-label="View profile"]')
  assert.match(await browser.evaluate(()=>document.querySelector('.header-popover:popover-open').textContent),/Jamie Quinn/,'Your profile should not identify the selected Employee as the HR administrator')
})

test('A10 inventory create/category/assign validation and Employee request creation',async()=>{
  await browser.fill('[aria-label="Demo role (UI simulation)"]','IT');await nav('/assets')
  await browser.textClick('main button','Add equipment');await field('Equipment name','Fictional audit headset');await field('Unique inventory tag','AUDIT-HEADSET');await field('Asset category','Accessory');await save()
  const asset=(await read()).assets.find(a=>a.tag==='AUDIT-HEADSET');assert.equal(asset.category,'Accessory');assert.equal(asset.employeeId,'')
  await browser.textClick('main button','Add equipment');await field('Equipment name','Fictional duplicate headset');await field('Unique inventory tag','audit-headset');await save()
  assert.match(await browser.evaluate(()=>document.querySelector('dialog[open]').textContent),/already exists/)
  await browser.textClick('dialog[open] form button','Cancel')
  await rowAction('AUDIT-HEADSET','Manage');await field('Employee','EMP-003');await save()
  assert.equal((await read()).assets.find(a=>a.id===asset.id).employeeId,'EMP-003')
  await browser.fill('[aria-label="Demo role (UI simulation)"]','Employee');await browser.fill('[aria-label="Employee identity"]','EMP-003')
  await browser.textClick('main button','Request access');await field('Application name','Fictional self-service audit app');await save()
  assert.equal((await read()).access.find(a=>a.item==='Fictional self-service audit app').employeeId,'EMP-003')
})
test('A11 keyboard Escape cancel preserves dirty forms; modal focus remains contained',async()=>{
  await nav('/employees');await browser.textClick('main button','Add employee');await field('Full name','Fictional Unsaved Audit')
  await browser.evaluate(()=>{window.auditConfirms=[];const original=window.confirm;window.confirm=(message)=>{const result=original(message);window.auditConfirms.push({message,result});return result}})
  for(let i=0;i<12;i++) await browser.key('Tab','Tab',9)
  assert.equal(await browser.evaluate(()=>!!document.activeElement.closest('dialog[open]')),true)
  browser.acceptDialog=false;await browser.key('Escape','Escape',27)
  console.log('AUDIT_ESCAPE',await browser.evaluate(()=>({confirms:window.auditConfirms,open:document.querySelectorAll('dialog[open]').length})))
  assert.equal(await browser.evaluate(()=>document.querySelectorAll('dialog[open]').length),1,'Declining discard on Escape must leave the form open')
  for(let i=0;i<12;i++) await browser.key('Tab','Tab',9)
  assert.equal(await browser.evaluate(()=>!!document.activeElement.closest('dialog[open]')),true)
})

test('A12 tablet overflow probe checks actual document scroll and table clipping',async()=>{
  await browser.command('Emulation.setDeviceMetricsOverride',{width:768,height:1000,deviceScaleFactor:1,mobile:false});await nav('/employees')
  const measurement=await browser.evaluate(()=>{
    window.scrollTo(500,0)
    return {scrollX,innerWidth,rootClientWidth:document.documentElement.clientWidth,rootScrollWidth:document.documentElement.scrollWidth,bodyScrollWidth:document.body.scrollWidth,regions:[...document.querySelectorAll('.table-scroll')].map(el=>({client:el.clientWidth,scroll:el.scrollWidth,overflowX:getComputedStyle(el).overflowX,overflowY:getComputedStyle(el).overflowY,right:el.getBoundingClientRect().right})),cards:[...document.querySelectorAll('.card')].map(el=>({right:el.getBoundingClientRect().right,overflow:getComputedStyle(el).overflow}))}
  })
  console.log('AUDIT_TABLET_SCROLL',JSON.stringify(measurement))
  assert.equal(measurement.scrollX,0,'Wide table content must not move the entire document horizontally')
})
test('A13 real file input rejects zero/oversized/mismatched files without persisting submissions',async()=>{
  await nav('/employees');await rowAction('Avery Morgan','View');await browser.click('[data-tab="documents"]');await browser.click('[aria-label="Simulate ID proof submission"]')
  for(const file of [{name:'fictional-empty.pdf',type:'application/pdf',size:0},{name:'fictional-large.pdf',type:'application/pdf',size:11*1024*1024},{name:'fictional-mismatch.png',type:'application/pdf',size:20}]) {
    await browser.evaluate(file=>{const transfer=new DataTransfer();transfer.items.add(new File([new Uint8Array(file.size)],file.name,{type:file.type}));const input=document.querySelector('input[type=file]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}))},file)
    await browser.waitFor(()=>!![...document.querySelectorAll('dialog[open]')].at(-1).querySelector('[role=alert]'))
    assert.equal((await read()).documents.find(d=>d.id==='EMP-001:id-proof').status,'Missing')
    assert.equal(await browser.evaluate(()=>[...document.querySelectorAll('dialog[open]')].at(-1).querySelector('button[type=submit]').disabled),true)
  }
})
test('A14 every route loads directly and unknown paths recover to Dashboard',async()=>{
  const origin=await browser.evaluate(()=>location.origin)
  for(const [path,title] of [['/employees','Employees'],['/onboarding','Onboarding'],['/assets','Assets & Access'],['/reports','Reports'],['/audit-unknown-route','Dashboard']]) {
    await browser.command('Page.navigate',{url:origin+path})
    await browser.waitFor(()=>document.readyState==='complete' && !!document.querySelector('main h1'))
    assert.equal(await browser.evaluate(()=>document.querySelector('main h1').textContent),title)
  }
})
test('A15 navigation guard rejects browser-back discard and retains the draft',async()=>{
  await nav('/employees');await browser.textClick('main button','Add employee');await field('Full name','Fictional back-navigation draft')
  browser.acceptDialog=false
  await browser.evaluate(()=>{window.auditBackConfirms=[];const original=window.confirm;window.confirm=message=>{const result=original(message);window.auditBackConfirms.push(result);return result};history.back()})
  await browser.waitFor(()=>location.pathname==='/employees' && window.auditBackConfirms.length>0)
  assert.equal(await browser.evaluate(()=>window.auditBackConfirms[0]),false)
  assert.equal(await browser.evaluate(()=>document.querySelector('dialog[open] input')?.value),'Fictional back-navigation draft')
})

test('A16 declining Escape discard must retain draft regardless of focused control',async()=>{
  const results=[]
  for(const selector of ['dialog[open] .modal-heading button','dialog[open] input','dialog[open] button[type=submit]']) {
    await browser.reset();await nav('/employees');await browser.textClick('main button','Add employee');await field('Full name','Fictional focus-dependent draft')
    await browser.evaluate(selector=>{document.querySelector(selector).focus();window.auditConfirms=[];const original=window.confirm;window.confirm=message=>{const result=original(message);window.auditConfirms.push({message,result});return result}},selector)
    browser.acceptDialog=false;await browser.key('Escape','Escape',27)
    results.push({selector,...await browser.evaluate(()=>({open:document.querySelectorAll('dialog[open]').length,confirms:window.auditConfirms,active:document.activeElement.tagName}))})
  }
  console.log('AUDIT_ESCAPE_FOCUS',JSON.stringify(results))
  assert.equal(results.every(result=>result.open===1),true,'Rejecting discard must not close the form for any focused control')
})
test('A17 help and sidebar collapse/expand buttons perform their visible actions',async()=>{
  const initial=await browser.evaluate(()=>document.querySelector('.sidebar').getBoundingClientRect().width)
  await browser.click('[aria-label="Collapse sidebar"]');const collapsed=await browser.evaluate(()=>document.querySelector('.sidebar').getBoundingClientRect().width)
  assert.ok(collapsed<initial)
  await browser.click('[aria-label="Expand sidebar"]');assert.equal(await browser.evaluate(()=>document.querySelector('.sidebar').getBoundingClientRect().width),initial)
  await browser.click('[title="Help & resources"]');assert.match(await browser.evaluate(()=>document.querySelector('dialog[open]').textContent),/Welcome to OnboardHQ/)
  await browser.textClick('dialog[open] button','Got it');assert.equal(await browser.evaluate(()=>document.querySelectorAll('dialog[open]').length),0)
})

test('A18 employee-profile resource tab assigns inventory and approves access in shared state',async()=>{
  await browser.fill('[aria-label="Demo role (UI simulation)"]','IT');await nav('/employees');await rowAction('Taylor Reed','View');await browser.click('[data-tab="assets"]')
  await browser.textClick('.employee-profile-modal button','Assign equipment');await field('Available equipment','AST-023');await save()
  assert.equal((await read()).assets.find(a=>a.id==='AST-023').employeeId,'EMP-003')
  await browser.textClick('.employee-profile-modal button','Request access');await field('Application name','Fictional profile audit workspace');await save()
  await rowAction('Fictional profile audit workspace','Approve')
  assert.equal((await read()).access.find(a=>a.item==='Fictional profile audit workspace').status,'Approved')
  await browser.key('Escape','Escape',27);await nav('/assets')
  assert.match(await browser.evaluate(()=>[...document.querySelectorAll('tbody tr')].find(r=>r.textContent.includes('AST-023')).textContent),/Taylor Reed/)
})
test('A19 Employee completes/reopens own task and submits own document; HR requirement override works',async()=>{
  await browser.fill('[aria-label="Demo role (UI simulation)"]','Employee');await browser.fill('[aria-label="Employee identity"]','EMP-004');await nav('/onboarding')
  await rowAction('Complete employee documents','Complete');assert.equal((await read()).tasks.find(t=>t.id==='T-3-0').status,'Completed')
  await rowAction('Complete employee documents','Reopen');assert.equal((await read()).tasks.find(t=>t.id==='T-3-0').status,'In progress')
  await nav('/employees');await rowAction('Sam Ellis','View');await browser.click('[data-tab="documents"]');await browser.click('[aria-label="Simulate ID proof submission"]');await field('Or choose sample metadata','0');await browser.textClick('dialog[open] form button','Simulate submission')
  assert.equal((await read()).documents.find(d=>d.id==='EMP-004:id-proof').status,'Pending Review')
  await browser.key('Escape','Escape',27);await browser.fill('[aria-label="Demo role (UI simulation)"]','HR');await rowAction('Sam Ellis','View');await browser.click('[data-tab="documents"]');await browser.click('[aria-label="Configure ID proof requirement"]');await field('Checklist requirement','Optional');await save()
  assert.equal((await read()).documents.find(d=>d.id==='EMP-004:id-proof').required,false)
})

test('A20 employee search/type/department/status/sort and all report filter controls affect results',async()=>{
  await nav('/employees')
  await browser.fill('[aria-label="Department"]','Engineering');assert.equal(await browser.evaluate(()=>document.querySelectorAll('tbody tr').length),3)
  await browser.fill('[aria-label="Onboarding status"]','Completed');assert.match(await browser.evaluate(()=>document.querySelector('tbody').textContent),/Drew Parker/)
  await browser.fill('[aria-label="Onboarding type"]','Freshers');assert.match(await browser.evaluate(()=>document.querySelector('main').textContent),/No results found/)
  await browser.fill('[aria-label="Onboarding status"]','All statuses');assert.match(await browser.evaluate(()=>document.querySelector('tbody').textContent),/Avery Morgan/)
  await browser.fill('[aria-label="Department"]','All departments');await browser.fill('[aria-label="Onboarding type"]','All types')
  await browser.fill('[aria-label="Search employees"]','Cloud Engineer');assert.match(await browser.evaluate(()=>document.querySelector('tbody').textContent),/Taylor Reed/)
  await browser.fill('[aria-label="Search employees"]','Jordan Blake');assert.equal(await browser.evaluate(()=>document.querySelectorAll('tbody tr').length),6)
  await browser.fill('[aria-label="Search employees"]','');await browser.fill('[aria-label="Sort employees"]','joiningDate-desc');assert.match(await browser.evaluate(()=>document.querySelector('tbody tr').textContent),/Sam Ellis/)
  await nav('/reports');await reportField('Department','Engineering');await reportField('Onboarding status','In progress');await reportField('Onboarding type','Freshers');await reportField('Task owner','Employee');await reportField('Task priority','Medium');await reportField('Task status','Completed')
  assert.equal(await metric('Employees'),'1');assert.equal(await metric('Average task readiness'),'75%');assert.match(await browser.evaluate(()=>document.querySelector('.result-count').textContent),/1 employees · 1 tasks/)
})
