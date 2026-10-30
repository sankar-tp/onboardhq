// All records and people in this prototype are fictional.
export const employees = [
  { id: 'EMP-001', name: 'Avery Morgan', initials: 'AM', role: 'Frontend Engineer', department: 'Engineering', date: 'Nov 02, 2026', status: 'In progress', progress: 75, buddy: 'Jordan Blake' },
  { id: 'EMP-002', name: 'Jamie Quinn', initials: 'JQ', role: 'Product Designer', department: 'Design', date: 'Nov 02, 2026', status: 'In progress', progress: 50, buddy: 'Riley Hart' },
  { id: 'EMP-003', name: 'Taylor Reed', initials: 'TR', role: 'Cloud Engineer', department: 'Engineering', date: 'Nov 05, 2026', status: 'Needs attention', progress: 25, buddy: 'Casey Lane' },
  { id: 'EMP-004', name: 'Sam Ellis', initials: 'SE', role: 'People Operations Associate', department: 'People', date: 'Nov 09, 2026', status: 'Not started', progress: 0, buddy: 'Alex Rivers' },
  { id: 'EMP-005', name: 'Drew Parker', initials: 'DP', role: 'QA Engineer', department: 'Engineering', date: 'Oct 19, 2026', status: 'Completed', progress: 100, buddy: 'Jordan Blake' },
  { id: 'EMP-006', name: 'Robin Hayes', initials: 'RH', role: 'Account Executive', department: 'Sales', date: 'Oct 19, 2026', status: 'Completed', progress: 100, buddy: 'Riley Hart' },
]
export const tasks = [
  { title: 'Prepare laptop & development tools', person: 'Avery Morgan', team: 'IT team', due: 'Oct 28', status: 'In progress' },
  { title: 'Approve cloud workspace access', person: 'Taylor Reed', team: 'IT team', due: 'Oct 26', status: 'Needs attention' },
  { title: 'Send welcome pack', person: 'Jamie Quinn', team: 'People team', due: 'Oct 29', status: 'Not started' },
  { title: 'Schedule a buddy introduction', person: 'Sam Ellis', team: 'People team', due: 'Oct 30', status: 'Not started' },
]
export const assets = [
  { id: 'AST-021', item: '14-inch developer laptop', type: 'Hardware', employee: 'Avery Morgan', status: 'In progress', owner: 'IT operations' },
  { id: 'AST-022', item: 'Design workstation', type: 'Hardware', employee: 'Jamie Quinn', status: 'Completed', owner: 'IT operations' },
  { id: 'ACC-014', item: 'Cloud development workspace', type: 'Access', employee: 'Taylor Reed', status: 'Needs attention', owner: 'Security team' },
  { id: 'ACC-015', item: 'Email & collaboration tools', type: 'Access', employee: 'Sam Ellis', status: 'Not started', owner: 'IT operations' },
]
export const notifications = ['Taylor Reed’s cloud access needs approval.', 'Avery Morgan starts on November 2.', 'Drew Parker completed their onboarding.']
