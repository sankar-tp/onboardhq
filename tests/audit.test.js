import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seed, transition, validateData } from '../src/state/model.js'
import { loadWorkspace, WORKSPACE_KEY } from '../src/state/storage.js'
test('audit: stored orphan tasks, documents, assignments and duplicate journeys are rejected',()=>{
  const base=seed()
  for(const change of [data=>{data.tasks[0].employeeId='missing'},data=>{data.documents[0].employeeId='missing'},data=>{data.assets[0].employeeId='missing'},data=>{data.journeys.push(data.journeys[0])}]) {
    const data=structuredClone(base);change(data);assert.throws(()=>validateData(data))
  }
})
test('audit: deleting all employees leaves a persistable empty workspace without reseeding',()=>{
  let data=seed()
  for(const employee of [...data.employees]) data=transition(data,{type:'employee-delete',value:{employeeId:employee.id}},'HR')
  assert.equal(data.employees.length,0);assert.equal(data.tasks.length,0);assert.equal(data.documents.length,0);assert.equal(data.access.length,0)
  assert.equal(data.assets.every(a=>!a.employeeId),true)
  let raw=JSON.stringify(data)
  const restored=loadWorkspace({getItem:key=>key===WORKSPACE_KEY?raw:null,setItem:(_key,value)=>{raw=value}})
  assert.equal(restored.data.employees.length,0)
})
test('audit: non-HR employees cannot create/delete staff or journeys; IT/Manager cannot submit documents',()=>{
  const data=seed()
  for(const role of ['Employee','IT','Manager']) {
    assert.throws(()=>transition(data,{type:'employee',value:{...data.employees[0]}},role),/Switch to HR/)
    assert.throws(()=>transition(data,{type:'employee-delete',value:{employeeId:data.employees[0].id}},role),/Switch to HR/)
    assert.throws(()=>transition(data,{type:'journey',value:{employeeId:data.employees[0].id}},role),/Switch to HR/)
  }
  for(const role of ['IT','Manager']) assert.throws(()=>transition(data,{type:'document-submit',value:{id:data.documents[0].id,format:'pdf'}},role),/HR or Employee/)
})
