import { checklistTasks, priorities, taskStatuses } from './workflow.js'
import { createDocuments, documentTemplates, documentTransition, migrateDocuments, validateDocuments } from './documents.js'
import { employees as seedEmployees } from '../data/sampleData.js'
export const statuses = ['Not started', 'In progress', 'Needs attention', 'Completed']
export const roles = ['HR', 'Employee', 'IT', 'Manager']
export function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value }
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
export function dateLabel(value) { return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
export function seed() {
  const employees = seedEmployees.map((e,index) => ({ ...e, documentTemplate:index === 0 ? 'Freshers' : index === 3 ? 'Interns' : 'Experienced Hires', joiningDate: new Date(e.date).toLocaleDateString('en-CA'), manager: 'Jordan Blake' }))
  const tasks = employees.flatMap((e, i) => ['Complete employee documents', 'Prepare equipment', 'Introduce team', 'Review first week'].map((title, j) => ({ id: `T-${i}-${j}`, employeeId: e.id, title, owner: ['Employee','IT','Manager','Manager'][j], due: e.joiningDate, status: j < e.progress / 25 ? 'Completed' : e.status === 'Needs attention' ? 'Needs attention' : 'Not started' })))
  return validateData({ version: 1, employees, journeys: employees.map(e => e.id), tasks, assets: [{ id: 'AST-021', item: '14-inch developer laptop', employeeId: 'EMP-001' }, { id: 'AST-022', item: 'Design workstation', employeeId: 'EMP-002' }, { id: 'AST-023', item: 'Developer laptop', employeeId: '' }, { id:'AST-024',item:'Wireless keyboard and mouse',employeeId:'',category:'Accessory',tag:'NB-ACC-024' }], access: [{ id: 'ACC-014', item: 'Cloud development workspace', employeeId: 'EMP-003', status: 'Pending' }, { id: 'ACC-015', item: 'Email & collaboration tools', employeeId: 'EMP-004', status: 'Pending' }], activity: [{ id: 'ACT-0', text: 'Demo workspace initialized', at: new Date().toISOString() }] })
}
export function employeeRows(data) {
  return data.employees.map(e => {
    const tasks = data.tasks.filter(t => t.employeeId === e.id)
    const completed = tasks.filter(t => t.status === 'Completed').length
    const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0
    const status = !data.journeys.includes(e.id) ? e.status : tasks.length && completed === tasks.length ? 'Completed' : tasks.some(t => ['Needs attention','Blocked'].includes(t.status)) ? 'Needs attention' : tasks.some(t => t.status !== 'Not started') ? 'In progress' : 'Not started'
    return { ...e, status, progress, completed, taskCount: tasks.length, date: dateLabel(e.joiningDate) }
  })
}
export const overdue = task => task.status !== 'Completed' && task.due < today()
export function validateData(data) {
  if (data?.version !== 1 || !['employees','journeys','tasks','assets','access','activity'].every(key => Array.isArray(data[key]))) throw Error('Stored demo data is not compatible. Export or clear the OnboardHQ storage key before reloading.')
  if (data.demoRole === 'IT Admin') data.demoRole = 'IT'
  for (const task of data.tasks) {
    if (task.priority === undefined) task.priority = 'Medium'
    if (task.blockedReason === undefined) task.blockedReason = ''
    if (task.owner === 'IT Admin') task.owner = 'IT'
  }
  for (const asset of data.assets) {
    if (asset.category === undefined) asset.category = 'Laptop'
    if (asset.tag === undefined) asset.tag = asset.id
  }
  if (data.demoRole && !roles.includes(data.demoRole)) throw Error('Stored demo role is invalid.')
  for (const key of ['employees','tasks','assets','access','activity']) {
    if (data[key].some(item => !item || typeof item.id !== 'string') || new Set(data[key].map(item => item.id)).size !== data[key].length) throw Error('Stored records contain invalid or duplicate identifiers.')
  }
  const ids = new Set(data.employees.map(e => e.id))
  if (ids.size !== data.employees.length || data.employees.some(e => ['name','role','department','manager'].some(key => typeof e[key] !== 'string' || !e[key].trim()) || !validDate(e.joiningDate) || !statuses.includes(e.status))) throw Error('Stored employee data is invalid.')
  if (data.tasks.some(t => !ids.has(t.employeeId) || !taskStatuses.includes(t.status) || !priorities.includes(t.priority) || typeof t.blockedReason !== 'string' || (t.status === 'Blocked' && !t.blockedReason.trim()) || !roles.includes(t.owner) || !validDate(t.due) || typeof t.title !== 'string' || !t.title.trim()) || data.journeys.some(id => !ids.has(id))) throw Error('Stored onboarding data is invalid.')
  if (new Set(data.journeys).size !== data.journeys.length || data.tasks.some(t => !data.journeys.includes(t.employeeId))) throw Error('Every task must belong to an existing unique employee journey.')
  if (new Set(data.assets.map(a => a.tag.toLowerCase())).size !== data.assets.length || data.assets.some(a => !['Laptop','Accessory'].includes(a.category) || typeof a.tag !== 'string' || !a.tag.trim())) throw Error('Asset tags must be unique and categories valid.')
  if ([...data.assets,...data.access].some(a => a.employeeId && !ids.has(a.employeeId))) throw Error('Stored assignments are invalid.')
  if (data.assets.some(a => typeof a.item !== 'string' || !a.item.trim()) || data.access.some(a => !ids.has(a.employeeId) || typeof a.item !== 'string' || !a.item.trim() || !['Pending','Approved','Rejected','Revoked'].includes(a.status))) throw Error('Stored resource data is invalid.')
  migrateDocuments(data)
  validateDocuments(data)
  return data
}
export function transition(data, action, role) {
  if (role === 'IT Admin') role = 'IT'
  if (!roles.includes(role)) throw Error('Choose a valid demo role.')
  const next = validateData(structuredClone(data))
  const v = action.value
  const employee = id => { if (!data.employees.some(e => e.id === id)) throw Error('Select an existing employee.') }
  const required = (...values) => { if (values.some(x => !String(x ?? '').trim())) throw Error('Complete all required fields.') }
  let text
  if (action.type.startsWith('document-')) {
    text = documentTransition(next,action,role)
  } else if (action.type === 'employee') {
    if (role !== 'HR') throw Error('Switch to HR to manage employee records.')
    required(v.name,v.role,v.department,v.manager,v.joiningDate)
    if (!statuses.includes(v.status) || !validDate(v.joiningDate)) throw Error('Enter a valid joining date and status.')
    if (data.employees.some(e => e.id !== v.id && e.name.toLowerCase() === v.name.trim().toLowerCase())) throw Error('An employee with this name already exists.')
    if (v.documentTemplate && !Object.hasOwn(documentTemplates,v.documentTemplate)) throw Error('Choose a valid document template.')
    const record = { documentTemplate: 'Freshers', ...v, name: v.name.trim(), initials: v.name.trim().split(/\s+/).map(n => n[0]).slice(0,2).join('').toUpperCase() }
    next.employees = next.employees.some(e => e.id === v.id) ? next.employees.map(e => e.id === v.id ? record : e) : [...next.employees, record]
    // A manual status change updates the checklist as well, keeping both pages consistent.
    const previous = data.employees.find(e => e.id === v.id)
    if (!previous) next.documents.push(...createDocuments(v.id,record.documentTemplate))
    else if (previous.documentTemplate !== record.documentTemplate) documentTransition(next,{type:'document-template',value:{employeeId:v.id,template:record.documentTemplate}},role)
    if (previous && employeeRows(data).find(e => e.id === v.id).status !== v.status) next.tasks = next.tasks.map(t => t.employeeId === v.id ? { ...t, status: v.status } : t)
    text = `${previous ? 'Updated' : 'Added'} employee ${record.name}`
  } else if (action.type === 'employee-delete') {
    if (role !== 'HR') throw Error('Switch to HR to delete employees.')
    employee(v.employeeId)
    const removed = next.employees.find(e => e.id === v.employeeId)
    next.employees = next.employees.filter(e => e.id !== v.employeeId)
    next.journeys = next.journeys.filter(id => id !== v.employeeId)
    next.tasks = next.tasks.filter(t => t.employeeId !== v.employeeId)
    next.documents = next.documents.filter(d => d.employeeId !== v.employeeId)
    next.access = next.access.filter(a => a.employeeId !== v.employeeId)
    next.assets = next.assets.map(a => a.employeeId === v.employeeId ? { ...a, employeeId: '' } : a)
    if (next.demoEmployeeId === v.employeeId) next.demoEmployeeId = next.employees[0]?.id || ''
    text = `Deleted employee ${removed.name}; equipment returned to inventory`
  } else if (action.type === 'journey') {
    if (role !== 'HR') throw Error('Switch to HR to create journeys.')
    employee(v.employeeId)
    if (next.journeys.includes(v.employeeId)) throw Error('This employee already has a journey.')
    next.journeys.push(v.employeeId)
    next.tasks.push(...checklistTasks(next.employees.find(e => e.id === v.employeeId)))
    text = 'Created employee onboarding journey'
  } else if (action.type === 'task') {
    employee(v.employeeId); required(v.title,v.due)
    if (!next.journeys.includes(v.employeeId)) throw Error('Create a journey before adding tasks.')
    if (!roles.includes(v.owner) || !taskStatuses.includes(v.status) || !validDate(v.due)) throw Error('Choose a valid owner, due date and status.')
    if (!priorities.includes(v.priority || 'Medium')) throw Error('Choose a valid task priority.')
    if (v.status === 'Blocked' && !String(v.blockedReason || '').trim()) throw Error('Add a reason for blocked tasks.')
    const existing = next.tasks.find(t => t.id === v.id)
    if (role === 'Employee' && (!existing || existing.employeeId !== (data.demoEmployeeId || data.employees[0]?.id) || existing.owner !== 'Employee' || ['employeeId','title','owner','due','priority'].some(key => existing[key] !== v[key]))) throw Error('Employees may update only the status of their own assigned tasks.')
    if (role !== 'HR' && (v.owner !== role || existing && existing.owner !== role)) throw Error('You can manage only tasks assigned to your demo role.')
    next.tasks = [...next.tasks.filter(t => t.id !== v.id), { ...v, priority:v.priority || 'Medium',blockedReason:v.status === 'Blocked' ? String(v.blockedReason).trim() : '', title: v.title.trim() }]
    text = `${existing ? 'Updated' : 'Added'} task: ${v.title.trim()}`
  } else if (action.type === 'asset') {
    if (role !== 'IT') throw Error('Switch to IT to manage inventory.')
    required(v.item)
    if (v.employeeId) employee(v.employeeId)
    const existing = next.assets.find(a => a.id === v.id)
    if (existing?.employeeId && v.employeeId && existing.employeeId !== v.employeeId) throw Error('This asset is unavailable. Unassign it before assigning it to another employee.')
    const record = { ...v, category:v.category || existing?.category || 'Laptop', tag:(v.tag || existing?.tag || v.id).trim() }
    if (next.assets.some(a => a.id !== v.id && a.tag.toLowerCase() === record.tag.toLowerCase())) throw Error('This inventory tag already exists.')
    next.assets = [...next.assets.filter(a => a.id !== v.id),record]
    text = `Updated equipment: ${v.item}`
  } else if (action.type === 'access') {
    employee(v.employeeId); required(v.item)
    if (role === 'Employee' && v.employeeId !== (data.demoEmployeeId || data.employees[0]?.id)) throw Error('Employees may request access only for themselves.')
    const existing = next.access.find(a => a.id === v.id)
    if (next.access.some(a => a.id !== v.id && a.employeeId === v.employeeId && a.item.trim().toLowerCase() === v.item.trim().toLowerCase() && ['Pending','Approved'].includes(a.status))) throw Error('This employee already has a pending or approved request for this application.')
    if (!['Pending','Approved','Rejected','Revoked'].includes(v.status)) throw Error('Choose a valid approval status.')
    if (existing && (existing.employeeId !== v.employeeId || existing.item !== v.item)) throw Error('An access decision cannot change the original request or employee.')
    if (role !== 'IT' && (existing || v.status !== 'Pending')) throw Error('Only IT can decide access requests.')
    next.access = [...next.access.filter(a => a.id !== v.id),v]
    text = `${v.status} access: ${v.item}`
  } else throw Error('Unknown action.')
  next.activity.unshift({ id: crypto.randomUUID(), text, at: new Date().toISOString(), role, employeeId: v.employeeId || next.documents.find(d => d.id === v.id)?.employeeId || (action.type === 'employee' ? v.id : undefined) })
  next.activity = next.activity.slice(0,100)
  return validateData(next)
}
export function csvCell(value) { return `"${String(value ?? '').replace(/^\s*[=+@-]|^[\t\r\n]/, "'$&").replaceAll('"','""')}"` }
