import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'
export default function useUnsavedChanges(dirty) {
  const blocker = useBlocker(() => dirty && !window.confirm('Discard unsaved form changes?'))
  useEffect(() => { if (blocker.state === 'blocked') blocker.reset() },[blocker])
  useEffect(() => {
    if (!dirty) return
    const before = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload',before)
    return () => window.removeEventListener('beforeunload',before)
  },[dirty])
  return () => !dirty || window.confirm('Discard unsaved form changes?')
}
