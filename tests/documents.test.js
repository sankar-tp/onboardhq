import { test } from 'node:test'
import assert from 'node:assert/strict'
import { employeeRows, seed, transition, validateData } from '../src/state/model.js'
import { documentSummary, documentTypes } from '../src/state/documents.js'
const action = (data,type,id,extra={},role='HR') => transition(data,{type:`document-${type}`,value:{id,...extra}},role)
test('legacy workspaces receive a separate document checklist without losing existing data', () => {
  const data=seed(); delete data.documents
  const original=structuredClone(data)
  const migrated=validateData(JSON.parse(JSON.stringify(data)))
  assert.equal(migrated.documents.length,data.employees.length*documentTypes.length)
  assert.deepEqual(migrated.tasks,original.tasks)
  assert.deepEqual(migrated.activity,original.activity)
  assert.deepEqual(migrated.employees,original.employees)
  assert.equal(documentSummary(migrated,data.employees[0].id).missing,5)
  assert.equal(migrated.documents.every(d=>d.status==='Missing'),true)
  assert.deepEqual(validateData(JSON.parse(JSON.stringify(migrated))),migrated)
})
test('simulated submissions generate metadata only and require HR verification', () => {
  const data=seed(), doc=data.documents[0]
  const submitted=action(data,'submit',doc.id,{format:'pdf',name:'real-file.pdf',content:'ignored'},'Employee')
  const record=submitted.documents[0]
  assert.equal(record.status,'Pending Review')
  assert.equal(record.submissions[0].name,'sample-id-proof-v1.pdf')
  assert.equal(record.submissions[0].mock,true)
  assert.equal(record.submissions[0].content,undefined)
  assert.equal(documentSummary(submitted,doc.employeeId).progress,0)
  const verified=action(submitted,'review',doc.id,{decision:'Verified',remarks:''})
  assert.equal(documentSummary(verified,doc.employeeId).progress,20)
  assert.deepEqual(employeeRows(verified),employeeRows(data),'document changes never change task progress')
  assert.deepEqual(verified.tasks,data.tasks)
  assert.equal(data.documents[0].status,'Missing','source state is immutable')
})
test('rejection remarks, resubmission request and replacement versions persist', () => {
  let data=seed(); const id=data.documents[0].id
  data=action(data,'submit',id,{format:'pdf'})
  assert.throws(()=>action(data,'review',id,{decision:'Rejected',remarks:'  '}),/Add remarks/)
  data=action(data,'review',id,{decision:'Rejected',remarks:'Fictional scan is incomplete.'})
  assert.equal(data.documents[0].status,'Rejected')
  data=action(data,'review',id,{decision:'Request resubmission',remarks:'Please replace the fictional scan.'})
  assert.equal(data.documents[0].status,'Missing')
  assert.equal(data.documents[0].resubmissionRequested,true)
  data=action(data,'submit',id,{format:'png'},'Employee')
  assert.equal(data.documents[0].status,'Pending Review')
  assert.equal(data.documents[0].resubmissionRequested,false)
  assert.equal(data.documents[0].submissions.length,2)
  assert.equal(data.documents[0].submissions[1].name,'sample-id-proof-v2.png')
  assert.deepEqual(validateData(JSON.parse(JSON.stringify(data))),data)
})
test('waivers and optional checklist requirements affect only document readiness', () => {
  let data=seed(); const employeeId=data.employees[0].id
  const originalTasks=structuredClone(data.tasks)
  const optional=data.documents.find(d=>d.employeeId===employeeId && !d.required)
  data=action(data,'submit',optional.id,{format:'pdf'})
  for(const doc of data.documents.filter(d=>d.employeeId===employeeId && d.required)) data=action(data,'review',doc.id,{decision:'Waived',remarks:'Fictional demo exception approved.'})
  assert.equal(documentSummary(data,employeeId).ready,true)
  assert.equal(documentSummary(data,employeeId).progress,100)
  data=action(data,'requirement',optional.id,{required:true})
  assert.equal(documentSummary(data,employeeId).ready,false)
  assert.equal(documentSummary(data,employeeId).mandatory,6)
  assert.deepEqual(data.tasks,originalTasks)
})
test('invalid review transitions and unauthorized role decisions are rejected', () => {
  const data=seed(), id=data.documents[0].id
  assert.throws(()=>action(data,'review',id,{decision:'Verified'}),/Only pending/)
  assert.throws(()=>action(data,'review',id,{decision:'Waived',remarks:'Demo'},'IT'),/Switch to HR/)
  assert.throws(()=>action(data,'requirement',id,{required:false},'Manager'),/Switch to HR/)
  assert.throws(()=>action(data,'submit',id,{format:'exe'}),/supported PDF/)
  assert.throws(()=>action(data,'review',id,{decision:'Waived',remarks:''}),/Add remarks/)
  const pending=action(data,'submit',id,{format:'pdf'})
  assert.throws(()=>action(pending,'submit',id,{format:'pdf'}),/Request resubmission/)
  assert.throws(()=>action(data,'requirement','missing',{required:true}),/existing employee document/)
})
test('new employees get document checklists and invalid stored metadata is rejected', () => {
  const data=transition(seed(),{type:'employee',value:{id:'DOC-NEW',name:'Fictional Example',role:'Engineer',department:'Engineering',manager:'Jordan Blake',joiningDate:'2026-12-01',status:'Not started'}},'HR')
  assert.equal(data.documents.filter(d=>d.employeeId==='DOC-NEW').length,7)
  const submitted=action(data,'submit',data.documents[0].id,{format:'pdf'})
  submitted.documents[0].submissions[0].name='unexpected.pdf'
  assert.throws(()=>validateData(submitted),/Invalid document metadata/)
})

 test('legacy sample filenames remain valid and new samples use neutral names', () => {
  const data=seed(), id=data.documents[0].id
  const submitted=action(data,'submit',id,{format:'pdf'})
  assert.equal(submitted.documents[0].submissions[0].name,'sample-id-proof-v1.pdf')
  submitted.documents[0].submissions[0].name='fictional-id-proof-v1.pdf'
  assert.deepEqual(validateData(JSON.parse(JSON.stringify(submitted))),submitted)
})
