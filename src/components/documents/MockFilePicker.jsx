import { useState } from 'react'
import { Button, Input, Modal, Select } from '../ui'
import useUnsavedChanges from '../useUnsavedChanges'
import { useWorkspace } from '../../state/context'
import { mockFiles } from '../../state/documents'
import { fileMetadata } from '../../state/fileMetadata'
export default function MockFilePicker({ document, onClose }) {
  const { commit, feedback } = useWorkspace()
  const [selected,setSelected] = useState(null)
  const [error,setError] = useState('')
  const [sample,setSample] = useState('')
  const [failedSave,setFailedSave] = useState(false)
  const confirmClose = useUnsavedChanges(Boolean(selected))
  const version = document.submissions.length + 1
  const files = mockFiles(document.typeId,version)
  function close() { if(confirmClose()) onClose() }
  return <Modal open title="Simulate document submission" onClose={close}><form onSubmit={event => {
    event.preventDefault()
    if (!selected) { setError('Select sample metadata or choose a local file.'); return }
    setFailedSave(false)
    if(commit({type:'document-submit',value:{id:document.id,file:selected}})) onClose()
    else { setFailedSave(true); setError('Submission failed. No changes were saved.') }
  }}><p>Choose a file. Only its filename, size and format are saved locally. Contents are never read, uploaded or stored. “Pending Review” simulates submission; it does not mean an upload occurred.</p><Input label="Choose local demo file · PDF/JPG/PNG · max 10 MB" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={event => {
    setSample(''); setSelected(null); setError(''); setFailedSave(false)
    const file = event.target.files?.[0]
    if (!file) return
    try { setSelected(fileMetadata(file)) } catch(error) { setError(error.message); event.target.value = '' }
  }} /><Select label="Or choose sample metadata" value={sample} onChange={event => { setSample(event.target.value); setSelected(event.target.value === '' ? null : files[Number(event.target.value)]); setError(''); setFailedSave(false) }}><option value="">No sample selected</option>{files.map((file,index) => <option key={file.name} value={index}>{file.name} · {(file.sizeBytes/1024).toFixed(0)} KB</option>)}</Select>{selected && <div className="feedback" role="status"><div><strong className="document-filename">{selected.name}</strong><p>{selected.sizeBytes.toLocaleString()} bytes · {(selected.sizeBytes/1024/1024).toFixed(2)} MB · {selected.format.toUpperCase()} · Selected, not submitted</p></div></div>}{error && <p className="feedback feedback-error" role="alert">{failedSave && feedback?.error ? feedback.text : error}</p>}<div className="modal-actions"><Button variant="secondary" onClick={close}>Cancel</Button><Button type="submit" disabled={!selected}>Simulate submission</Button></div></form></Modal>
}
