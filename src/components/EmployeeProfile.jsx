import { useId, useRef, useState } from 'react'
import { Badge, Modal, Progress } from './ui'
import Onboarding from '../pages/Onboarding'
import Assets from '../pages/Assets'
import DocumentsPanel from './documents/DocumentsPanel'
import { useWorkspace } from '../state/context'
import { typeLabel } from '../state/workflow'
import { documentSummary } from '../state/documents'
export default function EmployeeProfile({ employeeId, onClose }) {
  const { employees, data, feedback } = useWorkspace()
  const employee = employees.find(e => e.id === employeeId)
  const [tab, setTab] = useState('overview')
  const id = useId()
  const tabs = useRef(null)
  if (!employee) return null
  const sections = [['overview','Overview'],['documents','Documents'],['tasks','Onboarding Tasks'],['assets','Assets & Access']]
  const documents = documentSummary(data, employee.id)
  const selectTab = event => {
    const keys = ['ArrowLeft','ArrowRight','Home','End']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    const focusedTab = event.target.closest('[role=tab]')?.dataset.tab || tab
    const index = sections.findIndex(([value]) => value === focusedTab)
    const next = sections[event.key === 'Home' ? 0 : event.key === 'End' ? sections.length-1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + sections.length) % sections.length][0]
    setTab(next)
    tabs.current.querySelector(`[data-tab="${next}"]`).focus()
  }
  return <Modal open title={`Employee profile · ${employee.name}`} className="employee-profile-modal" onClose={onClose}>
    <div ref={tabs} className="profile-tabs" role="tablist" aria-label="Employee profile sections" onKeyDown={selectTab}>{sections.map(([value,label]) => <button key={value} type="button" role="tab" id={`${id}-${value}-tab`} data-tab={value} aria-selected={tab === value} aria-controls={`${id}-${value}-panel`} tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)}>{label}{value === 'documents' && <span className="count-pill">{documents.resolved}/{documents.mandatory}</span>}</button>)}</div>
    {feedback && tab !== 'documents' && <p className={`feedback ${feedback.error ? 'feedback-error' : 'feedback-success'}`} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
    <div role="tabpanel" id={`${id}-overview-panel`} aria-labelledby={`${id}-overview-tab`} hidden={tab !== 'overview'} tabIndex={0}>
      <h3>{employee.name}</h3><dl className="details-grid">{[['Role',employee.role],['Onboarding type',typeLabel(employee.documentTemplate)],['Department',employee.department],['Manager',employee.manager],['Joining date',employee.date]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <div className="profile-readiness"><div><h2>Onboarding tasks</h2><Badge>{employee.status}</Badge><Progress value={employee.progress} /><p>{employee.completed} of {employee.taskCount} tasks completed</p></div><div><h2>Documents</h2><p>{documents.ready ? 'Mandatory documents resolved' : `${documents.outstanding} mandatory documents outstanding`}</p><Progress value={documents.progress} label="Mandatory document readiness" /><p>{documents.verified} verified · {documents.waived} waived · {documents.pending} pending review</p></div></div>
    </div>
    <div role="tabpanel" id={`${id}-documents-panel`} aria-labelledby={`${id}-documents-tab`} hidden={tab !== 'documents'} tabIndex={0}>{tab === 'documents' && <DocumentsPanel employeeId={employee.id} />}</div>
    <div role="tabpanel" id={`${id}-tasks-panel`} aria-labelledby={`${id}-tasks-tab`} hidden={tab !== 'tasks'} tabIndex={0}>{tab === 'tasks' && <Onboarding employeeId={employee.id} embedded />}</div>
    <div role="tabpanel" id={`${id}-assets-panel`} aria-labelledby={`${id}-assets-tab`} hidden={tab !== 'assets'} tabIndex={0}>{tab === 'assets' && <Assets employeeId={employee.id} embedded />}</div>
  </Modal>
}
