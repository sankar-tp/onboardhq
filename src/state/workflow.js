export const onboardingTypeOptions = [
  { value:'Freshers', label:'Fresher' },
  { value:'Experienced Hires', label:'Experienced Hire' },
  { value:'Interns', label:'Intern' },
]
export const typeLabel = value => onboardingTypeOptions.find(option => option.value === value)?.label || value
export const roleLabel = role => role === 'IT' ? 'IT Admin' : role
export const priorities = ['Low','Medium','High','Urgent']
export const taskStatuses = ['Not started','In progress','Blocked','Needs attention','Completed']
export const sortOptions = [
  {value:'name-asc',label:'Name A–Z'}, {value:'name-desc',label:'Name Z–A'},
  {value:'joiningDate-asc',label:'Joining date: earliest'}, {value:'joiningDate-desc',label:'Joining date: latest'},
  {value:'department-asc',label:'Department A–Z'},
]
export function sortEmployees(employees, sort) {
  const [key,direction] = sort.split('-')
  if (!['name','joiningDate','department'].includes(key)) return [...employees]
  return [...employees].sort((a,b) => (String(a[key]).localeCompare(String(b[key])) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)) * (direction === 'desc' ? -1 : 1))
}
export function checklistTasks(employee) {
  const items = [
    ['Review welcome handbook','Employee','Medium'],
    ['Collect and review onboarding documents','HR','High'],
    [employee.documentTemplate === 'Interns' ? 'Prepare internship tools and access' : 'Prepare laptop and software access','IT','High'],
    [employee.documentTemplate === 'Experienced Hires' ? 'Plan role handover and team introduction' : employee.documentTemplate === 'Interns' ? 'Assign internship mentor and learning plan' : 'Schedule orientation and onboarding buddy','Manager','Medium'],
  ]
  return items.map(([title,owner,priority]) => ({ id:crypto.randomUUID(),employeeId:employee.id,title,owner,priority,due:employee.joiningDate,status:'Not started',blockedReason:'' }))
}
