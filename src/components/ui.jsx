import { useEffect, useId, useRef, useState } from 'react'
import { Inbox, X } from 'lucide-react'
export function Button({ variant = 'primary', className = '', type = 'button', children, ...props }) {
  return <button type={type} className={`button button-${variant} ${className}`} {...props}>{children}</button>
}
export function Input({ label, id, className = '', ...props }) {
  const generatedId = useId()
  return <label className={`field ${className}`} htmlFor={id || generatedId}>{label && <span>{label}</span>}<input id={id || generatedId} {...props} /></label>
}
export function Select({ label, id, children, ...props }) {
  const generatedId = useId()
  return <label className="field" htmlFor={id || generatedId}>{label && <span>{label}</span>}<select id={id || generatedId} {...props}>{children}</select></label>
}
export function Card({ children, className = '', ...props }) { return <section className={`card ${className}`} {...props}>{children}</section> }
export function Badge({ children }) {
  const tone = { Completed: 'green', 'In progress': 'indigo', 'Needs attention': 'amber', Blocked: 'amber', 'Not started': 'gray', Approved: 'green', Assigned: 'indigo', Pending: 'amber', Rejected: 'amber', Revoked: 'gray', Available: 'green', 'Not Submitted': 'gray', Missing: 'gray', 'Pending Review': 'amber', Verified: 'green', Ready: 'green', Waived: 'gray' }[children] || 'gray'
  return <span className={`badge badge-${tone}`}><span />{children}</span>
}
export function PageHeader({ eyebrow, title, description, action }) {
  return <div className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1><p>{description}</p></div>{action && <div className="page-actions">{action}</div>}</div>
}
export function EmptyState({ title = 'No results found', description = 'Try adjusting your search or filters.' }) {
  return <div className="empty-state"><Inbox size={30} /><h3>{title}</h3><p>{description}</p></div>
}
export function Table({ columns, rows, caption }) {
  if (!rows.length) return <EmptyState />
  // Reset the current page when filtering, sorting, adding or removing records.
  return <PaginatedTable key={JSON.stringify(rows.map(row => row.id))} columns={columns} rows={rows} caption={caption} />
}
function PaginatedTable({ columns, rows, caption }) {
  const [page,setPage] = useState(0)
  const [pageSize,setPageSize] = useState(10)
  const tableId = useId()
  const pageCount = Math.ceil(rows.length / pageSize)
  const start = page * pageSize
  const visibleRows = rows.slice(start,start + pageSize)
  return <>
    <div className="table-scroll" role="region" aria-label={caption} tabIndex={0}><table id={tableId}><caption className="sr-only">{caption}</caption><thead><tr>{columns.map(column => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead><tbody>{visibleRows.map(row => <tr key={row.id}>{columns.map(column => <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>)}</tr>)}</tbody></table></div>
    {rows.length > 10 && <nav className="table-pagination" aria-label={caption + ' pagination'}>
      <span className="pagination-summary" role="status">{start + 1}–{Math.min(start + pageSize,rows.length)} of {rows.length}</span>
      <Select label="Rows per page" aria-controls={tableId} value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(0) }}>{[10,25,50].map(size => <option key={size} value={size}>{size}</option>)}</Select>
      <div className="pagination-actions"><Button variant="secondary" aria-controls={tableId} disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</Button><span>Page {page + 1} of {pageCount}</span><Button variant="secondary" aria-controls={tableId} disabled={page + 1 >= pageCount} onClick={() => setPage(value => value + 1)}>Next</Button></div>
    </nav>}
  </>
}
export function Modal({ open, onClose, title, children, className = '' }) {
  const ref = useRef(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const dialog = ref.current
    dialog.showModal()
    return () => { dialog.close(); previous?.focus() }
  }, [open])
  useEffect(() => {
    if (!open) return
    const dialog = ref.current
    let pendingClose
    function cancel(event) {
      // Cancel the browser close synchronously. A blocking confirmation must run
      // after the native cancel event finishes, not inside its default action.
      event.preventDefault()
      event.stopPropagation()
      const focused = document.activeElement
      const selectionStart = focused?.selectionStart
      const selectionEnd = focused?.selectionEnd
      clearTimeout(pendingClose)
      pendingClose = setTimeout(() => {
        onClose()
        if (dialog.open && focused?.isConnected) {
          focused.focus({ preventScroll: true })
          if (selectionStart != null && selectionEnd != null) focused.setSelectionRange(selectionStart,selectionEnd)
        }
      },0)
    }
    function escape(event) {
      if (event.key !== 'Escape' || event.target.closest('dialog') !== dialog) return
      event.preventDefault()
      event.stopPropagation()
      if (event.type === 'keydown' && !event.repeat) cancel(event)
    }
    dialog.addEventListener('cancel',cancel)
    dialog.addEventListener('keydown',escape,true)
    dialog.addEventListener('keyup',escape,true)
    return () => {
      clearTimeout(pendingClose)
      dialog.removeEventListener('cancel',cancel)
      dialog.removeEventListener('keydown',escape,true)
      dialog.removeEventListener('keyup',escape,true)
    }
  }, [open,onClose])
  return <dialog ref={ref} closedby="none" className={`modal ${className}`} aria-labelledby={titleId} onClick={event => { if (event.target === event.currentTarget) onClose() }}><div className="modal-heading"><h2 id={titleId}>{title}</h2><Button variant="ghost" aria-label="Close dialog" onClick={onClose}><X size={20} /></Button></div>{children}</dialog>
}
export function Avatar({ person }) { return <span className="avatar" aria-hidden="true">{person.initials}</span> }
export function Progress({ value, label = 'Onboarding completion' }) { return <div className="progress-wrap"><div className="progress" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${value}%` }} /></div><span>{value}%</span></div> }
