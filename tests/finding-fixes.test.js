import { test } from 'node:test'
import assert from 'node:assert/strict'
import { profileIdentity } from '../src/state/profile.js'
import { seed, employeeRows } from '../src/state/model.js'
import { documentSummary } from '../src/state/documents.js'
import { buildReport } from '../src/state/reporting.js'

test('F04 profile identity follows Employee while keeping staff demo roles distinct',()=>{
  const data=seed(), employee=data.employees.find(e=>e.id==='EMP-002')
  const original=structuredClone(data)
  const profile=profileIdentity('Employee',employee)
  assert.equal(profile.name,'Jamie Quinn');assert.equal(profile.initials,'JQ')
  assert.equal(profile.department,'Design');assert.equal(profile.position,'Product Designer');assert.equal(profile.demoRole,'Employee')
  assert.equal(profileIdentity('HR',employee).demoRole,'HR')
  assert.equal(profileIdentity('HR',employee).position,'Workspace administrator')
  assert.equal(profileIdentity('IT',employee).position,'IT Admin')
  assert.equal(profileIdentity('Manager',employee).position,'Manager')
  assert.equal(profileIdentity('Employee',undefined).name,'No employee selected')
  assert.deepEqual(data,original,'Identity derivation does not modify employee/storage records')
})
test('F03 a present employee with zero mandatory documents remains fully document-ready',()=>{
  const data=seed(),employeeId=data.employees[0].id
  for(const doc of data.documents) if(doc.employeeId===employeeId) doc.required=false
  const summary=documentSummary(data,employeeId)
  assert.equal(summary.mandatory,0);assert.equal(summary.progress,100);assert.equal(summary.ready,true)
  const report=buildReport(data,employeeRows(data),data.tasks,{type:'Freshers'})
  assert.equal(report.people.length,1);assert.equal(report.documentMetrics.progress,100)
  assert.equal(report.departments[0].documentReady,1)
})
