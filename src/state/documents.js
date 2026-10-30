import { validPickedMetadata } from './fileMetadata.js'
export const documentTypes = [
  { id: 'id-proof', label: 'ID proof', required: true },
  { id: 'education', label: 'Educational certificates', required: true },
  { id: 'experience', label: 'Experience letter', required: false },
  { id: 'relieving', label: 'Relieving letter', required: false },
  { id: 'bank-proof', label: 'Bank proof', required: true },
  { id: 'agreement', label: 'Employment agreement', required: true },
  { id: 'photo', label: 'Photograph', required: true },
]
export const documentTemplates = {
  Freshers: ['id-proof','education','bank-proof','agreement','photo'],
  'Experienced Hires': ['id-proof','education','experience','relieving','bank-proof','agreement','photo'],
  Interns: ['id-proof','education','agreement','photo'],
}
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
export function mockFiles(typeId, version = 1) {
  return ['pdf','jpg','png'].map((format,index) => ({ name: `sample-${typeId}-v${version}.${format}`, format, sizeBytes: [128*1024,2*1024*1024,3*1024*1024][index], mock: true }))
}
export function validMockFile(file, typeId, version) {
  return file && ['sample','fictional'].some(prefix => file.name === `${prefix}-${typeId}-v${version}.${file.format}`) && ['pdf','jpg','png'].includes(file.format) && Number.isInteger(file.sizeBytes) && file.sizeBytes > 0 && file.sizeBytes <= MAX_DOCUMENT_BYTES && file.mock === true
}
export const documentStatuses = ['Missing', 'Pending Review', 'Verified', 'Rejected', 'Waived']
export function createDocuments(employeeId, template = 'Freshers') {
  return documentTypes.map(type => ({ id: `${employeeId}:${type.id}`, employeeId, typeId: type.id, required: documentTemplates[template].includes(type.id), status: 'Missing', remarks: '', submissions: [], resubmissionRequested: false }))
}
// Additive migration: existing records and task progress are never treated as verification.
export function migrateDocuments(data) {
  for (const employee of data.employees) {
    if (employee.documentTemplate === undefined) employee.documentTemplate = 'Freshers'
    if (!Object.hasOwn(documentTemplates,employee.documentTemplate)) throw Error('Choose a valid document template.')
  }
  if (data.documents === undefined) data.documents = data.employees.flatMap(employee => createDocuments(employee.id,employee.documentTemplate))
  if (Array.isArray(data.documents)) for (const doc of data.documents) {
    if (doc.status === 'Not Submitted') doc.status = 'Missing'
    for (const file of doc.submissions || []) if (file.sizeBytes === undefined && file.sizeKB !== undefined) file.sizeBytes = file.sizeKB * 1024
  }
  return data
}
export function validateDocuments(data) {
  if (!Array.isArray(data.documents)) throw Error('Stored document checklist is invalid.')
  const ids = new Set()
  for (const doc of data.documents) {
    if (!doc || ids.has(doc.id) || doc.id !== `${doc.employeeId}:${doc.typeId}` || !data.employees.some(e => e.id === doc.employeeId) || !documentTypes.some(t => t.id === doc.typeId) || typeof doc.required !== 'boolean' || !documentStatuses.includes(doc.status) || typeof doc.remarks !== 'string' || doc.remarks.length > 500 || typeof doc.resubmissionRequested !== 'boolean' || !Array.isArray(doc.submissions)) throw Error('Stored document record is invalid.')
    ids.add(doc.id)
    if (['Pending Review','Verified','Rejected'].includes(doc.status) && !doc.submissions.length) throw Error('A review requires a mock submission.')
    if (['Rejected','Waived'].includes(doc.status) && !doc.remarks.trim()) throw Error('A rejection or waiver requires remarks.')
    for (const [index, file] of doc.submissions.entries()) {
      if ((!validMockFile(file,doc.typeId,index+1) && !validPickedMetadata(file)) || file.version !== index + 1 || Number.isNaN(Date.parse(file.submittedAt))) throw Error('Invalid document metadata.')
    }
  }
  if (data.employees.some(e => documentTypes.some(t => !ids.has(`${e.id}:${t.id}`)))) throw Error('Employee document checklist is incomplete.')
}
export function documentSummary(data, employeeId) {
  const documents = data.documents.filter(doc => !employeeId || doc.employeeId === employeeId)
  const mandatory = documents.filter(doc => doc.required)
  const complete = doc => ['Verified','Waived'].includes(doc.status)
  const resolved = mandatory.filter(complete).length
  return {
    total: documents.length,
    mandatory: mandatory.length,
    resolved,
    progress: mandatory.length ? Math.round(resolved / mandatory.length * 100) : 100,
    ready: mandatory.every(complete),
    missing: mandatory.filter(doc => doc.status === 'Missing').length,
    outstanding: mandatory.filter(doc => !complete(doc)).length,
    pending: documents.filter(doc => doc.status === 'Pending Review').length,
    rejected: documents.filter(doc => doc.status === 'Rejected').length,
    verified: documents.filter(doc => doc.status === 'Verified').length,
    waived: documents.filter(doc => doc.status === 'Waived').length,
  }
}
export function documentTransition(data, action, role) {
  const value = action.value
  if (action.type === 'document-template') {
    if (role !== 'HR') throw Error('Switch to HR to configure document templates.')
    const employee = data.employees.find(e => e.id === value.employeeId)
    if (!employee || !Object.hasOwn(documentTemplates,value.template)) throw Error('Select an employee and a valid template.')
    employee.documentTemplate = value.template
    data.documents = data.documents.map(d => d.employeeId === employee.id ? { ...d, required: documentTemplates[value.template].includes(d.typeId) } : d)
    return `Applied ${value.template} checklist to ${employee.name}; submissions and reviews retained`
  }
  const doc = data.documents.find(doc => doc.id === value.id)
  if (!doc) throw Error('Select an existing employee document.')
  const type = documentTypes.find(type => type.id === doc.typeId)
  if (action.type === 'document-submit') {
    if (!['HR','Employee'].includes(role)) throw Error('Switch to HR or Employee to simulate submissions.')
    if (!['Missing','Rejected'].includes(doc.status)) throw Error('Request resubmission before replacing a reviewed document.')
    if (role === 'Employee' && doc.employeeId !== (data.demoEmployeeId || data.employees[0]?.id)) throw Error('Employees can submit only their own documents.')
    const version = doc.submissions.length + 1
    const file = value.file || { name: `sample-${doc.typeId}-v${version}.${value.format}`, format: value.format, sizeBytes: 128*1024, mock: true }
    if (!validMockFile(file,doc.typeId,version) && !validPickedMetadata(file)) throw Error('Choose a supported PDF/JPG/PNG file, greater than 0 bytes and at most 10 MB.')
    doc.submissions.push({ name:file.name,format:file.format,sizeBytes:file.sizeBytes,sizeKB:file.sizeBytes/1024,...(file.source === 'file-picker' ? {source:'file-picker',mimeType:file.mimeType} : {}),submittedAt:new Date().toISOString(),version,mock:true })
    doc.status = 'Pending Review'
    doc.resubmissionRequested = false
    // Previous HR remarks remain visible until the next review.
    return `Simulated ${type.label} submission for ${data.employees.find(e => e.id === doc.employeeId).name}`
  }
  if (role !== 'HR') throw Error('Switch to HR to configure or review documents.')
  if (action.type === 'document-requirement') {
    if (typeof value.required !== 'boolean') throw Error('Choose required or optional.')
    doc.required = value.required
    return `Set ${type.label} to ${doc.required ? 'required' : 'optional'} for ${data.employees.find(e => e.id === doc.employeeId).name}`
  }
  if (action.type !== 'document-review') throw Error('Unknown document action.')
  const remarks = String(value.remarks ?? '').trim()
  if (remarks.length > 500) throw Error('Keep review remarks within 500 characters.')
  if (!['Verified','Rejected','Waived','Request resubmission'].includes(value.decision)) throw Error('Choose a valid review decision.')
  if (value.decision !== 'Verified' && !remarks) throw Error('Add remarks for rejection, waiver or resubmission.')
  if (['Verified','Rejected'].includes(value.decision) && doc.status !== 'Pending Review') throw Error('Only pending submissions can be verified or rejected.')
  if (value.decision === 'Request resubmission' && doc.status === 'Missing') throw Error('This document is already awaiting submission.')
  doc.status = value.decision === 'Request resubmission' ? 'Missing' : value.decision
  doc.resubmissionRequested = value.decision === 'Request resubmission'
  doc.remarks = remarks
  doc.reviewedAt = new Date().toISOString()
  doc.reviewedBy = 'HR (demo)'
  return `${value.decision}: ${type.label} for ${data.employees.find(e => e.id === doc.employeeId).name}${remarks ? ` · ${remarks}` : ''}`
}
