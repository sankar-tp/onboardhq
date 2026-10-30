import { useState } from 'react'
import { Avatar, Badge, Button, Card, PageHeader, Progress, Select, Table } from '../components/ui'
import RecordForm from '../components/RecordForm'
import { useWorkspace } from '../state/context'
import { dateLabel, overdue, roles, statuses, today } from '../state/model'
import { priorities, roleLabel, taskStatuses, typeLabel } from '../state/workflow'
export default function Onboarding({ employeeId, embedded = false }) {
  const { data,employees:allEmployees,role,commit,visibleTasks } = useWorkspace()
  const employees = allEmployees.filter(e => !employeeId || e.id === employeeId)
  const [status,setStatus] = useState('All statuses')
  const [taskStatus,setTaskStatus] = useState('All task statuses')
  const [priority,setPriority] = useState('All priorities')
  const [owner,setOwner] = useState('All owners')
  const [form,setForm] = useState(null)
  const people = employees.filter(e => data.journeys.includes(e.id) && (status === 'All statuses' || e.status === status))
  const candidates = employees.filter(e => !data.journeys.includes(e.id))
  const options = list => list.map(e => ({value:e.id,label:e.name}))
  const tasks = visibleTasks.filter(t => (!employeeId || t.employeeId === employeeId) && (taskStatus === 'All task statuses' || t.status === taskStatus) && (priority === 'All priorities' || t.priority === priority) && (owner === 'All owners' || t.owner === owner)).map(t => ({...t,person:employees.find(e => e.id === t.employeeId)?.name}))
  const canEdit = task => role === 'HR' || task.owner === role
  const fields = form?.kind === 'journey' ? [{key:'employeeId',label:'Employee',options:[{value:'',label:'Select employee'},...options(candidates)]}] : [
    ...(role === 'Employee' ? [] : [
      {key:'employeeId',label:'Employee journey',options:[{value:'',label:'Select employee'},...options(employees.filter(e => data.journeys.includes(e.id)))]},
      {key:'title',label:'Task title'},
      {key:'owner',label:'Task owner',options:(role === 'HR' ? roles : [role]).map(value => ({value,label:roleLabel(value)}))},
      {key:'due',label:'Due date',type:'date'},
      {key:'priority',label:'Priority',options:priorities},
    ]),
    {key:'status',label:'Task status',options:taskStatuses},
    {key:'blockedReason',label:'Reason (required for Blocked)',required:false},
  ]
  function toggle(task) {
    const nextStatus = task.status === 'Completed' ? 'In progress' : 'Completed'
    if(window.confirm(`${nextStatus === 'Completed' ? 'Complete' : 'Reopen'} “${task.title}”? Onboarding progress will update.`)) commit({type:'task',value:{...task,status:nextStatus}})
  }
  return <>
    <PageHeader title={embedded ? 'Onboarding tasks' : 'Onboarding'} description={role === 'Employee' ? 'View your checklist and update tasks assigned to Employee.' : `Manage journeys and ${roleLabel(role)} task priorities.`} action={<div className="row-actions">
      {role === 'HR' && <Button variant="secondary" disabled={!candidates.length} onClick={() => setForm({kind:'journey',value:{employeeId:employeeId || ''}})}>Initiate onboarding</Button>}
      {role !== 'Employee' && <Button disabled={!employees.some(e => data.journeys.includes(e.id))} onClick={() => setForm({kind:'task',value:{id:crypto.randomUUID(),employeeId:employeeId || '',title:'',owner:role,due:today(),priority:'Medium',status:'Not started',blockedReason:''}})}>Add task</Button>}
    </div>} />
    <div className="section-heading"><h2>Employee journeys</h2><Select aria-label="Journey status" value={status} onChange={e => setStatus(e.target.value)}>{['All statuses',...statuses].map(s => <option key={s}>{s}</option>)}</Select></div>
    <Card className="employee-journeys"><Table caption="Employee onboarding journeys" rows={people} columns={[
      {key:'name',label:'Employee',render:e => <div className="person-cell"><Avatar person={e} /><div><strong>{e.name}</strong><small>{typeLabel(e.documentTemplate)} · {e.department}</small></div></div>},
      {key:'date',label:'Joining date'},
      {key:'status',label:'Status',render:e => <Badge>{e.status}</Badge>},
      {key:'progress',label:'Readiness',render:e => <Progress value={e.progress} />},
      {key:'milestones',label:'Checklist',render:e => `${e.completed} of ${e.taskCount} completed`},
    ]} /></Card>
    <Card><div className="card-heading"><div><h2>Team task queue</h2><p>{tasks.filter(overdue).length} overdue · {tasks.filter(t => t.status === 'Blocked').length} blocked in the filtered view</p></div></div>
      <div className="toolbar"><Select aria-label="Filter task status" value={taskStatus} onChange={e => setTaskStatus(e.target.value)}>{['All task statuses',...taskStatuses].map(s => <option key={s}>{s}</option>)}</Select><Select aria-label="Filter task priority" value={priority} onChange={e => setPriority(e.target.value)}>{['All priorities',...priorities].map(s => <option key={s}>{s}</option>)}</Select><Select aria-label="Filter task owner" value={owner} onChange={e => setOwner(e.target.value)}><option>All owners</option>{roles.map(value => <option key={value} value={value}>{roleLabel(value)}</option>)}</Select></div>
      <Table caption="Onboarding tasks" rows={tasks} columns={[
        {key:'title',label:'Task',render:t => <div><strong>{t.title}</strong>{t.status === 'Blocked' && <small className="document-meta overdue-text task-reason">Blocked: {t.blockedReason}</small>}</div>},
        {key:'person',label:'Employee'},
        {key:'owner',label:'Owner',render:t => roleLabel(t.owner)},
        {key:'priority',label:'Priority',render:t => <span className={['High','Urgent'].includes(t.priority) ? 'priority-high' : ''}>{t.priority}</span>},
        {key:'due',label:'Due date',render:t => <span className={overdue(t) ? 'overdue-text' : ''}>{dateLabel(t.due)}{overdue(t) ? ' · Overdue' : ''}</span>},
        {key:'status',label:'Status',render:t => <Badge>{t.status}</Badge>},
        {key:'actions',label:'Actions',render:t => canEdit(t) ? <div className="row-actions"><Button variant="ghost" onClick={() => setForm({kind:'task',value:t})}>{role === 'Employee' ? 'Update status' : 'Edit task'}<span className="sr-only"> {t.title} for {t.person}</span></Button><Button variant="ghost" onClick={() => toggle(t)}>{t.status === 'Completed' ? 'Reopen' : 'Complete'}<span className="sr-only"> {t.title}</span></Button></div> : <span className="muted">Managed by {roleLabel(t.owner)}</span>},
      ]} />
    </Card>
    {form && <RecordForm title={form.kind === 'journey' ? 'Initiate onboarding with type-specific checklist' : 'Checklist task'} initial={form.value} fields={fields} onClose={() => setForm(null)} onSave={value => commit({type:form.kind,value})} />}
  </>
}
