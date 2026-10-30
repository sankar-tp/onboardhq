import { useRef, useState } from 'react'
import { WorkspaceContext } from './context'
import { employeeRows, roles, seed, transition } from './model'
import { loadWorkspace, saveWorkspace } from './storage'
import { roleLabel } from './workflow'
function load() {
  try { return { ...loadWorkspace(localStorage), error: '' } }
  catch (error) { return { data: seed(), error: `Could not load saved workspace: ${error.message} Changes are disabled to protect stored data.` } }
}
export default function WorkspaceProvider({ children }) {
  const [initial] = useState(load)
  const latest = useRef(initial.data)
  const serialized = useRef(initial.serialized)
  const [workspace, setWorkspace] = useState(initial.data)
  const [feedback, setFeedback] = useState(initial.error ? { error: true, text: initial.error } : null)
  const role = workspace.demoRole || 'HR'
  const demoEmployeeId = workspace.employees.some(e => e.id === workspace.demoEmployeeId) ? workspace.demoEmployeeId : workspace.employees[0]?.id || ''
  function save(next, message) {
    if (initial.error) throw Error(initial.error)
    serialized.current = saveWorkspace(localStorage,serialized.current,next)
    latest.current = next
    setWorkspace(next)
    setFeedback({ error:false, text:message })
  }
  function setRole(value) {
    try {
      if (!roles.includes(value)) throw Error('Choose a valid demo role.')
      save({ ...latest.current,demoRole:value,demoEmployeeId },`Demo role changed to ${roleLabel(value)}. This is UI simulation, not authentication.`)
    } catch(error) { setFeedback({error:true,text:`Could not save demo role: ${error.message}`}) }
  }
  function setDemoEmployeeId(value) {
    try {
      if (!workspace.employees.some(e => e.id === value)) throw Error('Choose an existing employee.')
      save({ ...latest.current,demoEmployeeId:value },'Employee demo identity updated.')
    } catch(error) { setFeedback({error:true,text:error.message}) }
  }
  function commit(action) {
    try {
      const next = transition({ ...latest.current,demoEmployeeId },action,role)
      save(next,'Changes saved on this device.'); return true
    } catch(error) { setFeedback({error:true,text:`Changes were not saved. ${error.message}`}); return false }
  }
  const data = role === 'Employee' ? { ...workspace,
    employees:workspace.employees.filter(e => e.id === demoEmployeeId),
    journeys:workspace.journeys.filter(id => id === demoEmployeeId),
    tasks:workspace.tasks.filter(t => t.employeeId === demoEmployeeId),
    documents:workspace.documents.filter(d => d.employeeId === demoEmployeeId),
    assets:workspace.assets.filter(a => a.employeeId === demoEmployeeId),
    access:workspace.access.filter(a => a.employeeId === demoEmployeeId),
    activity:workspace.activity.filter(a => a.employeeId === demoEmployeeId),
  } : workspace
  const employees = employeeRows(data)
  const allEmployees = employeeRows(workspace)
  const visibleTasks = data.tasks.filter(t => ['HR','Employee'].includes(role) || t.owner === role)
  return <WorkspaceContext.Provider value={{ data, employees, allEmployees, role, setRole, demoEmployeeId, setDemoEmployeeId, commit, feedback, setFeedback, visibleTasks }}>{children}</WorkspaceContext.Provider>
}
