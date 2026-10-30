import { test } from 'node:test'
import assert from 'node:assert/strict'
import { employeeRows, seed, transition, validateData } from '../src/state/model.js'
import { documentSummary, documentTemplates, MAX_DOCUMENT_BYTES, mockFiles } from '../src/state/documents.js'
test('templates apply appropriate requirements without discarding verification or task progress', () => {
  let data=seed(); const employeeId=data.employees[0].id, id=data.documents[0].id
  data=transition(data,{type:'document-submit',value:{id,file:mockFiles('id-proof')[1]}},'HR')
  const originalTasks=structuredClone(data.tasks)
  const originalSubmission=structuredClone(data.documents[0].submissions)
  for(const template of Object.keys(documentTemplates)) {
    data=transition(data,{type:'document-template',value:{employeeId,template}},'HR')
    assert.equal(documentSummary(data,employeeId).mandatory,documentTemplates[template].length)
    assert.deepEqual(data.documents[0].submissions,originalSubmission)
    assert.deepEqual(data.tasks,originalTasks)
    assert.equal(data.employees[0].documentTemplate,template)
  }
  assert.throws(()=>transition(data,{type:'document-template',value:{employeeId,template:'Interns'}},'IT'),/Switch to HR/)
})
test('file metadata rejects oversize, empty, unsupported and fabricated names while allowing 10 MB', () => {
  const data=seed(), id=data.documents[0].id, file=mockFiles('id-proof')[0]
  for(const invalid of [{...file,sizeBytes:0},{...file,sizeBytes:MAX_DOCUMENT_BYTES+1},{...file,format:'exe'},{...file,name:'personal-document.pdf'}]) assert.throws(()=>transition(data,{type:'document-submit',value:{id,file:invalid}},'HR'),/at most 10 MB/)
  const next=transition(data,{type:'document-submit',value:{id,file:{...file,sizeBytes:MAX_DOCUMENT_BYTES,contents:'not copied'}}},'HR')
  assert.equal(next.documents[0].submissions[0].sizeBytes,MAX_DOCUMENT_BYTES)
  assert.equal(next.documents[0].submissions[0].contents,undefined)
})
test('Employee role can submit own metadata and update only own Employee tasks', () => {
  const data=seed(); data.demoEmployeeId=data.employees[0].id
  const own=data.tasks.find(t=>t.employeeId===data.demoEmployeeId && t.owner==='Employee')
  const next=transition(data,{type:'task',value:{...own,status:'In progress'}},'Employee')
  assert.equal(next.tasks.find(t=>t.id===own.id).status,'In progress')
  assert.throws(()=>transition(data,{type:'task',value:{...own,title:'Changed title'}},'Employee'),/only the status/)
  const other=data.documents.find(d=>d.employeeId!==data.demoEmployeeId)
  assert.throws(()=>transition(data,{type:'document-submit',value:{id:other.id,format:'pdf'}},'Employee'),/only their own/)
  const submitted=transition(data,{type:'document-submit',value:{id:data.documents[0].id,format:'pdf'}},'Employee')
  assert.equal(submitted.documents[0].status,'Pending Review')
  assert.throws(()=>transition(submitted,{type:'document-review',value:{id:data.documents[0].id,decision:'Verified'}},'Employee'),/Switch to HR/)
  assert.throws(()=>transition(data,{type:'access',value:{id:'bad',employeeId:data.employees[1].id,item:'Mock application',status:'Pending'}},'Employee'),/only for themselves/)
})
test('employee deletion removes dependent records and releases inventory without affecting others', () => {
  const data=seed(), id=data.employees[0].id
  assert.throws(()=>transition(data,{type:'employee-delete',value:{employeeId:id}},'IT'),/Switch to HR/)
  const next=transition(data,{type:'employee-delete',value:{employeeId:id}},'HR')
  assert.equal(next.employees.some(e=>e.id===id),false)
  for(const key of ['tasks','documents','access']) assert.equal(next[key].some(item=>item.employeeId===id),false)
  assert.equal(next.journeys.includes(id),false)
  assert.equal(next.assets.find(a=>a.id==='AST-021').employeeId,'')
  assert.equal(next.assets.length,data.assets.length)
  assert.equal(employeeRows(next).length,data.employees.length-1)
  assert.deepEqual(validateData(JSON.parse(JSON.stringify(next))),next)
})
test('older saved statuses and mock file sizes migrate without losing existing decisions', () => {
  let data=seed()
  data=transition(data,{type:'document-submit',value:{id:data.documents[0].id,format:'pdf'}},'HR')
  delete data.documents[0].submissions[0].sizeBytes
  data.documents[1].status='Not Submitted'
  delete data.employees[0].documentTemplate
  const migrated=validateData(JSON.parse(JSON.stringify(data)))
  assert.equal(migrated.documents[1].status,'Missing')
  assert.equal(migrated.documents[0].status,'Pending Review')
  assert.equal(migrated.documents[0].submissions[0].sizeBytes,128*1024)
  assert.equal(migrated.employees[0].documentTemplate,'Freshers')
})
