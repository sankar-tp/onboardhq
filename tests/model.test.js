import { test } from 'node:test'
import assert from 'node:assert/strict'
import { csvCell, employeeRows, seed, transition, validateData } from '../src/state/model.js'
test('journey progress and status derive from task completion', () => {
  const data=seed(), employeeId=data.employees[0].id
  assert.equal(employeeRows(data)[0].progress,75)
  const task=data.tasks.find(t => t.employeeId===employeeId && t.status!=='Completed')
  const next=transition(data,{type:'task',value:{...task,status:'Completed'}},'HR')
  assert.equal(employeeRows(next)[0].progress,100)
  assert.equal(employeeRows(next)[0].status,'Completed')
  assert.equal(employeeRows(data)[0].progress,75,'original state is immutable')
})
test('roles cannot change another team task, inventory, or access approvals', () => {
  const data=seed()
  assert.throws(() => transition(data,{type:'task',value:{...data.tasks.find(t=>t.owner==='IT'),status:'Completed'}},'Manager'),/only tasks/)
  assert.throws(() => transition(data,{type:'asset',value:data.assets[0]},'HR'),/Switch to IT/)
  assert.throws(() => transition(data,{type:'access',value:{...data.access[0],status:'Approved'}},'Manager'),/Only IT/)
})
test('employee editing keeps task state consistent and duplicate names are rejected', () => {
  const data=seed()
  const next=transition(data,{type:'employee',value:{...data.employees[0],status:'Completed'}},'HR')
  assert.equal(employeeRows(next)[0].progress,100)
  assert.throws(() => transition(data,{type:'employee',value:{...data.employees[0],id:'new'}},'HR'),/already exists/)
})
test('new employee journey validates links and computes progress', () => {
  let data=seed()
  data=transition(data,{type:'employee',value:{id:'new',name:'Fictional Tester',department:'Engineering',role:'Engineer',manager:'Jordan Blake',joiningDate:'2026-12-01',status:'Not started'}},'HR')
  data=transition(data,{type:'journey',value:{employeeId:'new'}},'HR')
  assert.equal(employeeRows(data).find(e=>e.id==='new').taskCount,4)
  assert.throws(()=>transition(data,{type:'journey',value:{employeeId:'new'}},'HR'),/already has/)
  assert.throws(()=>transition(data,{type:'task',value:{employeeId:'missing'}},'HR'),/existing employee/)
  const restored=validateData(JSON.parse(JSON.stringify(data)))
  assert.deepEqual(employeeRows(restored),employeeRows(data))
})
test('equipment assignment and access lifecycle preserve employee references', () => {
  const data=seed()
  const assigned=transition(data,{type:'asset',value:{...data.assets[2],employeeId:data.employees[2].id}},'IT')
  assert.equal(assigned.assets.find(a=>a.id===data.assets[2].id).employeeId,data.employees[2].id)
  const unassigned=transition(assigned,{type:'asset',value:{...data.assets[2],employeeId:''}},'IT')
  assert.equal(unassigned.assets.find(a=>a.id===data.assets[2].id).employeeId,'')
  const approved=transition(data,{type:'access',value:{...data.access[0],status:'Approved'}},'IT')
  assert.equal(approved.access.find(a=>a.id===data.access[0].id).status,'Approved')
  assert.throws(()=>transition(data,{type:'access',value:{...data.access[0],id:'duplicate'}},'HR'),/already has/)
})
test('invalid saved data and spreadsheet formulas are handled', () => {
  assert.throws(()=>validateData({version:0}),/not compatible/)
  assert.equal(csvCell('a,"b"'),'"a,""b"""')
  assert.equal(csvCell('=1+1'),'"\'=1+1"')
})
