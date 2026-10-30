import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seed, transition, employeeRows } from '../src/state/model.js'
import { fileMetadata, MAX_FILE_BYTES } from '../src/state/fileMetadata.js'
import { sortEmployees } from '../src/state/workflow.js'
import { loadWorkspace, saveWorkspace, WORKSPACE_KEY } from '../src/state/storage.js'
import { buildReport, reportCsv } from '../src/state/reporting.js'
const fakeStorage = () => { const map=new Map(); return { getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>map.set(key,value) } }
test('real picker metadata validates filename, size and MIME without carrying file contents',()=>{
  for(const file of [{name:'proof.exe',size:1,type:''},{name:'bad/name.pdf',size:1,type:''},{name:'proof.pdf',size:0,type:''},{name:'proof.pdf',size:MAX_FILE_BYTES+1,type:''},{name:'proof.png',size:1,type:'application/pdf'}]) assert.throws(()=>fileMetadata(file))
  const file=fileMetadata({name:'fictional-ID.JPEG',size:MAX_FILE_BYTES,type:'image/jpeg',contents:'never copied',arrayBuffer(){throw Error('Never called')}})
  assert.equal(file.format,'jpg'); assert.equal(file.contents,undefined)
  const data=seed(); const next=transition(data,{type:'document-submit',value:{id:data.documents[0].id,file}},'HR')
  assert.equal(next.documents[0].submissions[0].name,'fictional-ID.JPEG')
  assert.equal(JSON.stringify(next).includes('never copied'),false)
})
test('type changes and initiation build role-owned checklists while preserving other records',()=>{
  let data=seed()
  data=transition(data,{type:'employee',value:{id:'new-intern',name:'Fictional Intern',role:'Intern Engineer',manager:'Jordan Blake',department:'Engineering',joiningDate:'2026-11-01',status:'Not started',documentTemplate:'Interns'}},'HR')
  data=transition(data,{type:'journey',value:{employeeId:'new-intern'}},'HR')
  const tasks=data.tasks.filter(t=>t.employeeId==='new-intern')
  assert.deepEqual(new Set(tasks.map(t=>t.owner)),new Set(['HR','IT','Manager','Employee']))
  assert.equal(tasks.some(t=>t.title.includes('internship')),true)
  assert.equal(data.documents.filter(d=>d.employeeId==='new-intern' && d.required).length,4)
  data=transition(data,{type:'employee',value:{...data.employees.find(e=>e.id==='new-intern'),documentTemplate:'Experienced Hires'}},'HR')
  assert.equal(data.documents.filter(d=>d.employeeId==='new-intern' && d.required).length,7)
  assert.equal(data.tasks.filter(t=>t.employeeId==='new-intern').length,4)
})
test('blocked, complete and reopen states update onboarding progress and preserve priority',()=>{
  const data=seed(), task=data.tasks.find(t=>t.employeeId==='EMP-001' && t.status!=='Completed')
  assert.throws(()=>transition(data,{type:'task',value:{...task,status:'Blocked',blockedReason:''}},'HR'),/Add a reason/)
  let next=transition(data,{type:'task',value:{...task,status:'Blocked',blockedReason:'Waiting for fictional approval',priority:'Urgent'}},'HR')
  assert.equal(employeeRows(next)[0].status,'Needs attention')
  next=transition(next,{type:'task',value:{...next.tasks.find(t=>t.id===task.id),status:'Completed'}},'HR')
  assert.equal(employeeRows(next)[0].progress,100)
  next=transition(next,{type:'task',value:{...next.tasks.find(t=>t.id===task.id),status:'In progress'}},'HR')
  assert.equal(employeeRows(next)[0].progress,75)
  assert.equal(next.tasks.find(t=>t.id===task.id).priority,'Urgent')
})
test('occupied assets cannot be assigned again; unassignment and unique tags are enforced',()=>{
  const data=seed(), asset=data.assets[0]
  assert.throws(()=>transition(data,{type:'asset',value:{...asset,employeeId:data.employees[1].id}},'IT'),/unavailable/)
  let next=transition(data,{type:'asset',value:{...asset,employeeId:''}},'IT')
  next=transition(next,{type:'asset',value:{...asset,employeeId:data.employees[1].id}},'IT')
  assert.equal(next.assets.find(a=>a.id===asset.id).employeeId,data.employees[1].id)
  assert.throws(()=>transition(data,{type:'asset',value:{id:'duplicate-tag',item:'Accessory',tag:asset.tag,category:'Accessory',employeeId:''}},'IT'),/already exists/)
})
test('first launch is seeded once and stale-tab or failed writes do not overwrite saved records',()=>{
  const storage=fakeStorage(), first=loadWorkspace(storage)
  assert.ok(storage.getItem(WORKSPACE_KEY))
  assert.deepEqual(loadWorkspace(storage).data,first.data)
  const next=transition(first.data,{type:'asset',value:{id:'test-asset',item:'Fictional headset',category:'Accessory',tag:'TEST-01',employeeId:''}},'IT')
  const updated=saveWorkspace(storage,first.serialized,next)
  assert.throws(()=>saveWorkspace(storage,first.serialized,first.data),/another tab/)
  assert.equal(storage.getItem(WORKSPACE_KEY),updated)
  const failing={getItem:storage.getItem,setItem(){throw Error('Quota exceeded')}}
  assert.throws(()=>saveWorkspace(failing,updated,first.data),/Quota exceeded/)
  assert.equal(storage.getItem(WORKSPACE_KEY),updated)
})
test('sorting and filtered reporting match CSV rows and shared readiness metrics',()=>{
  const data=seed(), employees=employeeRows(data)
  const sorted=sortEmployees(employees,'name-desc')
  assert.equal(sorted[0].name,'Taylor Reed'); assert.equal(employees[0].name,'Avery Morgan')
  const report=buildReport(data,employees,data.tasks,{department:'Engineering',priority:'Medium'})
  assert.equal(report.people.every(e=>e.department==='Engineering'),true)
  assert.equal(report.tasks.every(t=>t.priority==='Medium'),true)
  const csv=reportCsv(report)
  assert.match(csv,/"Document"/); assert.doesNotMatch(csv,/Jamie Quinn/)
  const empty=buildReport(data,employees,data.tasks,{department:'Unknown'})
  assert.equal(empty.people.length,0); assert.equal(empty.completionRate,0)
})
