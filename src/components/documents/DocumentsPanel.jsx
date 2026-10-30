import { useState } from 'react'
import { Badge, Button, Progress, Table } from '../ui'
import RecordForm from '../RecordForm'
import MockFilePicker from './MockFilePicker'
import { onboardingTypeOptions, typeLabel } from '../../state/workflow'
import { useWorkspace } from '../../state/context'
import { documentSummary, documentTypes } from '../../state/documents'

export default function DocumentsPanel({ employeeId }) {
  const { data, role, commit, feedback } = useWorkspace()
  const [picker, setPicker] = useState(null)
  const [templateForm,setTemplateForm] = useState(false)
  const employee = data.employees.find(e => e.id === employeeId)
  const [form, setForm] = useState(null)
  const summary = documentSummary(data, employeeId)
  const documents = data.documents.filter(doc => doc.employeeId === employeeId)
  function open(kind, doc) {
    const title = documentTypes.find(type => type.id === doc.typeId).label
    const value = kind === 'requirement' ? { id: doc.id, required: doc.required ? 'Required' : 'Optional' } : { id: doc.id, decision: doc.status === 'Pending Review' ? 'Verified' : 'Waived', remarks: '' }
    setForm({ kind, title, value, status: doc.status })
  }
  const fields = !form ? [] : form.kind === 'requirement' ? [{ key: 'required', label: 'Checklist requirement', options: ['Required','Optional'] }] : [
    { key: 'decision', label: 'Review decision', options: [...(form.status === 'Pending Review' ? ['Verified','Rejected'] : []), 'Waived', ...(form.status !== 'Missing' ? ['Request resubmission'] : [])] },
    { key: 'remarks', label: 'Remarks (required unless verifying)', required: false },
  ]
  return <>
    <div className="section-heading"><div><h2>Document readiness</h2><p>Separate from onboarding task completion. Optional documents do not block readiness.</p></div><Badge>{summary.ready ? 'Ready' : 'Needs attention'}</Badge></div>
    <div className="section-heading"><p>Checklist template: <strong>{typeLabel(employee.documentTemplate)}</strong> · Individual requirement overrides may apply.</p>{role === 'HR' && <Button variant="secondary" onClick={() => setTemplateForm(true)}>Apply checklist template</Button>}</div>
    <div className="document-summary" aria-label="Mandatory document readiness"><div><strong>{summary.resolved} / {summary.mandatory}</strong><span>mandatory resolved</span></div><div><strong>{summary.missing}</strong><span>missing mandatory</span></div><div><strong>{summary.pending}</strong><span>pending review</span></div><Progress value={summary.progress} label="Mandatory document readiness" /></div>
    {summary.missing > 0 && <p className="document-warning" role="status">{summary.missing} mandatory {summary.missing === 1 ? 'document requires' : 'documents require'} submission or resubmission.</p>}
    <p className="page-note">Choose a local PDF/JPG/PNG file or sample metadata (max 10 MB). Only filename and metadata are saved; no file contents are read, uploaded or stored. HR reviews each item.</p>
    <Table caption="Employee document checklist" rows={documents} columns={[
      { key: 'typeId', label: 'Document', render: doc => <div><strong>{documentTypes.find(type => type.id === doc.typeId).label}</strong><small className={doc.required && doc.status === 'Missing' ? 'overdue-text document-meta' : 'document-meta'}>{doc.required ? 'Mandatory' : 'Optional'}{doc.required && doc.status === 'Missing' ? ' · Missing' : ''}</small></div> },
      { key: 'status', label: 'Verification', render: doc => <div><Badge>{doc.status}</Badge>{doc.resubmissionRequested && <small className="document-meta">Resubmission requested</small>}</div> },
      { key: 'file', label: 'Submission', render: doc => { const file = doc.submissions.at(-1); return file ? <div><span>{file.name}</span><small className="document-meta">Mock · {(file.sizeBytes / 1024 / 1024).toFixed(2)} MB · Version {file.version}</small><small className="document-meta">{new Date(file.submittedAt).toLocaleString('en-GB', { timeZone:'Asia/Kolkata' })} IST</small>{doc.status === 'Missing' && <small className="document-meta">Previous submission; awaiting replacement</small>}</div> : 'No submission' } },
      { key: 'remarks', label: 'HR remarks', render: doc => <div className="document-remarks">{doc.remarks || '—'}{doc.reviewedBy && <small className="document-meta">{doc.reviewedBy} · {new Date(doc.reviewedAt).toLocaleDateString('en-GB')}</small>}</div> },
      { key: 'actions', label: 'Actions', render: doc => <div className="row-actions">{['HR','Employee'].includes(role) && ['Missing','Rejected'].includes(doc.status) && <Button variant="ghost" onClick={() => setPicker(doc)} aria-label={`Simulate ${documentTypes.find(t => t.id === doc.typeId).label} submission`}>{doc.submissions.length ? 'Simulate resubmission' : 'Simulate submission'}</Button>}{role === 'HR' && <><Button variant="ghost" onClick={() => open('review',doc)} aria-label={`Review ${documentTypes.find(t => t.id === doc.typeId).label}`}>Review</Button><Button variant="ghost" onClick={() => open('requirement',doc)} aria-label={`Configure ${documentTypes.find(t => t.id === doc.typeId).label} requirement`}>Configure</Button></>}</div> },
    ]} />
    {feedback && <p className={`feedback ${feedback.error ? 'feedback-error' : 'feedback-success'}`} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
    {picker && <MockFilePicker document={picker} onClose={() => setPicker(null)} />}
    {templateForm && <RecordForm title="Apply document checklist template" initial={{template:employee.documentTemplate}} fields={[{key:"template",label:"Hire type",options:onboardingTypeOptions}]} onClose={() => setTemplateForm(false)} onSave={value => window.confirm("Apply this template’s required/optional rules? Existing submissions and reviews will be preserved.") && commit({type:"document-template",value:{employeeId,template:value.template}})} />}
    {form && <RecordForm title={`${form.kind === 'submit' ? 'Simulate submission' : form.kind === 'requirement' ? 'Configure requirement' : 'HR review'}: ${form.title}`} initial={form.value} fields={fields} onClose={() => setForm(null)} onSave={value => {
      const decisionChangesReadiness = form.kind === 'requirement' || form.kind === 'review' && ['Waived','Request resubmission'].includes(value.decision)
      if (decisionChangesReadiness && !window.confirm('Apply this change to document readiness? Onboarding task progress will remain unchanged.')) return false
      return commit({ type: `document-${form.kind}`, value: form.kind === 'requirement' ? { ...value, required: value.required === 'Required' } : value })
    }} />}
  </>
}
