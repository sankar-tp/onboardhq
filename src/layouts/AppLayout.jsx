import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Bell, Building2, ChartNoAxesCombined, ChevronDown, ChevronsLeft, ChevronsRight, CircleHelp, ClipboardCheck, LayoutDashboard, Menu, Monitor, Users, X } from 'lucide-react'
import { Button, Modal, Select } from '../components/ui'
import HeaderPopover from '../components/HeaderPopover'
import { useWorkspace } from '../state/context'
import { profileIdentity } from '../state/profile'
import { roleLabel } from '../state/workflow'
import { roles } from '../state/model'

const links = [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }, { to: '/employees', label: 'Employees', icon: Users }, { to: '/onboarding', label: 'Onboarding', icon: ClipboardCheck }, { to: '/assets', label: 'Assets & Access', icon: Monitor }, { to: '/reports', label: 'Reports', icon: ChartNoAxesCombined }]
export default function AppLayout() {
  const { data, role, setRole, feedback, setFeedback, allEmployees, demoEmployeeId, setDemoEmployeeId } = useWorkspace()
  const profile = profileIdentity(role,allEmployees.find(employee => employee.id === demoEmployeeId))
  const notifications = data.access.filter(a => a.status === 'Pending').map(a => `${a.item} access needs approval.`)
  const [collapsed, setCollapsed] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [modal, setModal] = useState(null)
  const sidebar = useRef(null)
  const menuButton = useRef(null)
  const location = useLocation()
  const title = links.find(link => link.to === location.pathname)?.label || 'Dashboard'
  useEffect(() => { document.title = `${title} · OnboardHQ` }, [title])
  useEffect(() => {
    if (!drawer) return
    const trigger = menuButton.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sidebar.current.querySelector('button').focus()
    function trap(event) {
      if (event.key === 'Escape') setDrawer(false)
      if (event.key !== 'Tab') return
      const focusable = [...sidebar.current.querySelectorAll('a, button')].filter(el => el.getClientRects().length)
      const first = focusable[0], last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', trap)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', trap); trigger?.focus() }
  }, [drawer])
  return <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    {drawer && <div className="drawer-backdrop" onClick={() => setDrawer(false)} />}
    <aside ref={sidebar} id="main-sidebar" className={`sidebar ${drawer ? 'is-open' : ''}`} aria-label="Workspace navigation" role={drawer ? 'dialog' : undefined} aria-modal={drawer || undefined}>
      <div className="brand"><span className="brand-mark"><Building2 size={23} /></span><span className="sidebar-label">onboard<span className="brand-hq">HQ</span></span><Button className="mobile-close" variant="ghost" aria-label="Close navigation" onClick={() => setDrawer(false)}><X size={20} /></Button></div>
      
      <nav>{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} title={label} onClick={() => setDrawer(false)} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={19} /><span className="sidebar-label">{label}</span>{label === 'Onboarding' && <span className="nav-count sidebar-label">{data.journeys.length}</span>}</NavLink>)}</nav>
      <div className="sidebar-bottom"><Button variant="ghost" className="help-button" title="Help & resources" onClick={() => setModal('help')}><CircleHelp size={19} /><span className="sidebar-label">Help & resources</span></Button><button className="collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <ChevronsRight size={18} /> : <><ChevronsLeft size={18} /><span>Collapse sidebar</span></>}</button></div>
    </aside>
    <div className="workspace"><header className="topbar"><div className="breadcrumb"><button ref={menuButton} className="mobile-menu icon-button" onClick={() => setDrawer(true)} aria-label="Open navigation" aria-expanded={drawer} aria-controls="main-sidebar"><Menu size={21} /></button><span className="breadcrumb-company">Workspace <span>/</span></span><strong>{title}</strong></div><div className="header-actions"><Select aria-label="Demo role (UI simulation)" value={role} onChange={event => setRole(event.target.value)}>{roles.map(value => <option key={value} value={value}>Demo: {roleLabel(value)}</option>)}</Select>{role === 'Employee' && <Select aria-label="Employee identity" value={demoEmployeeId} onChange={event => setDemoEmployeeId(event.target.value)}>{!allEmployees.length && <option value="">No employees</option>}{allEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>}<HeaderPopover title="Notifications" triggerClassName="icon-button notification-button" triggerLabel={`View ${notifications.length} notifications`} closeKey={location.key} trigger={<><Bell size={19} />{notifications.length > 0 && <span className="notification-dot" />}</>}><ul className="notification-list">{!notifications.length && <li>No pending access approvals.</li>}{notifications.map((item,index) => <li key={index}><Bell size={17} /><span>{item}</span></li>)}</ul></HeaderPopover><span className="header-divider" /><HeaderPopover title="Your profile" triggerClassName="profile" triggerLabel="View profile" closeKey={location.key} trigger={<><span className="avatar profile-avatar">{profile.initials}</span><span className="profile-name"><strong>{profile.name}</strong><small>{role === 'Employee' ? profile.position : profile.department}</small></span><ChevronDown size={15} /></>}><div className="profile-details"><span className="avatar">{profile.initials}</span><h3>{profile.name}</h3><p>{profile.department ? `${profile.department} · ` : ''}{profile.position}</p>{profile.email && <p>{profile.email}</p>}<p>Demo role: {profile.demoRole}</p></div></HeaderPopover></div></header>
      <main id="main-content" tabIndex={-1} key={location.pathname}><div className="workspace-feedback" aria-live="polite">{feedback && <div className={`feedback ${feedback.error ? 'feedback-error' : 'feedback-success'}`} role={feedback.error ? 'alert' : 'status'}><span>{feedback.text}</span><Button variant="ghost" aria-label="Dismiss message" onClick={() => setFeedback(null)}><X size={16} /></Button></div>}</div><Outlet /><footer><span>© 2026 OnboardHQ</span></footer></main>
    </div>
    <Modal open={!!modal} title="Welcome to OnboardHQ" onClose={() => setModal(null)}>
      <p>Your shared starting point for welcoming people to NovaByte Technologies.</p><p>Explore employee records, onboarding journeys, equipment readiness and team reports. Changes are saved in localStorage on this device. HR manages employees and journeys, IT Admin manages equipment and access, and each team manages its assigned tasks. Employee mode shows the selected employee’s documents, tasks and resources.</p>
      <div className="modal-actions"><Button onClick={() => setModal(null)}>Got it</Button></div>
    </Modal>
  </div>
}
