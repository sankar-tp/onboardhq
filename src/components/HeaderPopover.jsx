import { useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from './ui'

export default function HeaderPopover({ title, trigger, triggerClassName, triggerLabel, closeKey, children }) {
  const id = useId()
  const panel = useRef(null)
  const button = useRef(null)
  const [open,setOpen] = useState(false)
  function positionPanel() {
    const rect = button.current.getBoundingClientRect()
    const width = Math.min(360,window.innerWidth - 24)
    const below = window.innerHeight - rect.bottom - 20
    const above = rect.top - 20
    const flip = below < 180 && above > below
    Object.assign(panel.current.style,{
      width:`${width}px`,
      left:`${Math.max(12,Math.min(rect.right-width,window.innerWidth-width-12))}px`,
      top:flip ? 'auto' : `${rect.bottom+8}px`,
      bottom:flip ? `${window.innerHeight-rect.top+8}px` : 'auto',
      maxHeight:`${Math.max(80,flip ? above : below)}px`,
    })
  }
  useEffect(() => {
    if (!open) return
    window.addEventListener('resize',positionPanel)
    window.addEventListener('scroll',positionPanel,true)
    return () => { window.removeEventListener('resize',positionPanel); window.removeEventListener('scroll',positionPanel,true) }
  },[open])
  useEffect(() => {
    const element = panel.current
    return () => { element.hidePopover() }
  },[closeKey])
  return <>
    <button ref={button} type="button" className={triggerClassName} aria-label={triggerLabel} title={title} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} popoverTarget={id}>{trigger}</button>
    <div ref={panel} id={id} popover="auto" role="dialog" aria-label={title} className="header-popover" onBeforeToggle={event => { if(event.newState === 'open') positionPanel() }} onToggle={event => setOpen(event.newState === 'open')}>
      <div className="header-popover-heading"><h2>{title}</h2><Button variant="ghost" aria-label={`Close ${title.toLowerCase()}`} popoverTarget={id} popoverTargetAction="hide"><X size={18} /></Button></div>
      {children}
    </div>
  </>
}
