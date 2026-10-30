import { roleLabel } from './workflow.js'

export function profileIdentity(role, employee) {
  if (role === 'Employee') {
    if (!employee) return { name:'No employee selected',initials:'—',department:'',position:'Select an employee to view their profile',email:null,demoRole:'Employee' }
    return {
      name:employee.name,
      initials:employee.initials || employee.name.split(/\s+/).map(part=>part[0]).slice(0,2).join('').toUpperCase(),
      department:employee.department,
      position:employee.role,
      email:`${employee.id.toLowerCase()}@novabyte.example`,
      demoRole:'Employee',
    }
  }
  const staff = {
    HR:{department:'People Operations',position:'Workspace administrator'},
    IT:{department:'IT Operations',position:'IT Admin'},
    Manager:{department:'People Management',position:'Manager'},
  }
  return { name:'Alex Carter',initials:'AC',email:'alex.carter@novabyte.example',...staff[role],demoRole:roleLabel(role) }
}
