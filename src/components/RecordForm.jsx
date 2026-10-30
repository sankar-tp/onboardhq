import { useState } from 'react'
import useUnsavedChanges from './useUnsavedChanges'
import { useWorkspace } from '../state/context'
import { Button, Input, Modal, Select } from './ui'
export default function RecordForm({ title, fields, initial, onSave, onClose }) {
  const { feedback } = useWorkspace()
  const [values,setValues] = useState(initial)
  const [error,setError] = useState('')
  const dirty = JSON.stringify(values) !== JSON.stringify(initial)
  const confirmClose = useUnsavedChanges(dirty)
  function close() { if(confirmClose()) onClose() }
  return <Modal open title={title} onClose={close}><form onSubmit={event => { event.preventDefault(); setError(''); if(onSave(values)) onClose(); else setError('Could not save. Check the workspace error message and your entries.') }}><div className="form-grid">{fields.map(field => field.options ? <Select key={field.key} label={field.label} required={field.required !== false} value={values[field.key] ?? ''} onChange={event => setValues({ ...values,[field.key]:event.target.value })}>{field.options.map(option => <option key={typeof option === 'string' ? option : option.value} value={typeof option === 'string' ? option : option.value}>{typeof option === 'string' ? option : option.label}</option>)}</Select> : <Input key={field.key} label={field.label} type={field.type || 'text'} required={field.required !== false} maxLength={120} value={values[field.key] ?? ''} onChange={event => setValues({ ...values,[field.key]:event.target.value })} />)}</div>{error && <p className="feedback feedback-error" role="alert">{feedback?.error ? feedback.text : error}</p>}<div className="modal-actions"><Button variant="secondary" onClick={close}>Cancel</Button><Button type="submit">Save changes</Button></div></form></Modal>
}
