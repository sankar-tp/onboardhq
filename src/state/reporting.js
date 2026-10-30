import { documentSummary, documentTypes } from './documents.js'
import { csvCell, overdue } from './model.js'
import { typeLabel, roleLabel } from './workflow.js'
export function buildReport(data, employees, visibleTasks, filters) {
  const match = (value,selected) => !selected || selected === 'All' || value === selected
  const people = employees.filter(e => match(e.department,filters.department) && match(e.status,filters.status) && match(e.documentTemplate,filters.type))
  const ids = new Set(people.map(e => e.id))
  const tasks = visibleTasks.filter(t => ids.has(t.employeeId) && match(t.owner,filters.owner) && match(t.priority,filters.priority) && match(t.status,filters.taskStatus))
  const documents = data.documents.filter(d => ids.has(d.employeeId))
  const documentMetrics = documentSummary({documents})
  const journeys = people.filter(e => data.journeys.includes(e.id))
  const completed = journeys.filter(e => e.status === 'Completed').length
  const departments = [...new Set(people.map(e => e.department))].map(name => {
    const list = people.filter(e => e.department === name)
    return {id:name,name,count:list.length,completed:list.filter(e => data.journeys.includes(e.id) && e.status === 'Completed').length,progress:Math.round(list.reduce((sum,e) => sum + e.progress,0)/list.length),documentReady:list.filter(e => documentSummary(data,e.id).ready).length}
  })
  const attention = tasks.filter(t => overdue(t) || t.status === 'Blocked').map(t => ({...t,person:people.find(e => e.id === t.employeeId).name}))
  return { people,tasks,documents,departments,attention,completed,completionRate:journeys.length ? Math.round(completed/journeys.length*100) : 0,average:people.length ? Math.round(people.reduce((sum,e) => sum+e.progress,0)/people.length) : 0,overdue:tasks.filter(overdue).length,blocked:tasks.filter(t => t.status === 'Blocked').length,documentMetrics }
}
export function reportCsv(report) {
  const rows = [['Record type','Employee','Department','Onboarding type','Role / item','Manager / owner','Joining / due date','Status','Progress / required','Priority / overdue'],
    ...report.people.map(e => ['Employee',e.name,e.department,typeLabel(e.documentTemplate),e.role,e.manager,e.joiningDate,e.status,`${e.progress}%`,'']),
    ...report.tasks.map(t => { const e = report.people.find(e => e.id === t.employeeId); return ['Task',e.name,e.department,typeLabel(e.documentTemplate),t.title,roleLabel(t.owner),t.due,t.status,'',`${t.priority}${overdue(t) ? ' / Overdue' : ''}`] }),
    ...report.documents.map(d => { const e = report.people.find(e => e.id === d.employeeId); return ['Document',e.name,e.department,typeLabel(e.documentTemplate),documentTypes.find(t => t.id === d.typeId).label,'HR','',d.status,d.required ? 'Required' : 'Optional',''] }),
  ]
  return '\uFEFF'+rows.map(row => row.map(csvCell).join(',')).join('\r\n')
}
