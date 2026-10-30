import { useState } from 'react'
import { Badge, Button, Card, PageHeader, Progress, Select, Table } from '../components/ui'
import { useWorkspace } from '../state/context'
import { dateLabel, overdue, roles, statuses } from '../state/model'
import { onboardingTypeOptions, priorities, roleLabel, taskStatuses } from '../state/workflow'
import { buildReport, reportCsv } from '../state/reporting'
export default function Reports() {
  const { data,employees,visibleTasks,setFeedback } = useWorkspace()
  const [filters,setFilters] = useState({department:'All',status:'All',type:'All',owner:'All',priority:'All',taskStatus:'All'})
  const report = buildReport(data,employees,visibleTasks,filters)
  const controls = [
    ['department','Department',[...new Set(employees.map(e => e.department))]],
    ['status','Onboarding status',statuses],
    ['type','Onboarding type',onboardingTypeOptions],
    ['owner','Task owner',roles.map(value => ({value,label:roleLabel(value)}))],
    ['priority','Task priority',priorities],
    ['taskStatus','Task status',taskStatuses],
  ]
  function download() {
    try {
      const url=URL.createObjectURL(new Blob([reportCsv(report)],{type:'text/csv;charset=utf-8;'}))
      const link=document.createElement('a'); link.href=url; link.download='onboardhq-report.csv'; document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000)
      setFeedback({error:false,text:'CSV exported with matching employee, task and document rows. Task filters apply to task rows only.'})
    } catch(error) { setFeedback({error:true,text:`Export failed: ${error.message}`}) }
  }
  return <><PageHeader title="Reports" description="Employee filters apply to all metrics. Task filters refine tasks only; document readiness stays separate." action={<Button onClick={download} disabled={!report.people.length}>Export CSV</Button>} />
    <Card><div className="toolbar">{controls.map(([key,label,options]) => <Select key={key} label={label} value={filters[key]} onChange={e => setFilters({...filters,[key]:e.target.value})}><option value="All">All</option>{options.map(o => <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>{typeof o === 'string' ? o : o.label}</option>)}</Select>)}<span className="result-count" aria-live="polite">{report.people.length} employees · {report.tasks.length} tasks</span></div></Card>
    <div className="stats-grid report-metrics">{[['Employees',report.people.length],['Completed journeys',`${report.completionRate}%`],['Average task readiness',`${report.average}%`],['Overdue tasks',report.overdue],['Blocked tasks',report.blocked],['Document readiness',report.people.length ? `${report.documentMetrics.progress}%` : 'N/A'],['Missing mandatory docs',report.documentMetrics.missing],['Documents pending review',report.documentMetrics.pending]].map(([label,value]) => <Card className="stat-card" key={label}><div className="stat-top">{label}</div><strong className="stat-value">{value}</strong></Card>)}</div>
    <Card><div className="card-heading"><h2>Department overview</h2></div><Table caption="Department report" rows={report.departments} columns={[{key:'name',label:'Department'},{key:'count',label:'Employees'},{key:'completed',label:'Completed journeys'},{key:'documentReady',label:'Document-ready employees'},{key:'progress',label:'Average task readiness',render:d => <Progress value={d.progress} />}]} /></Card>
    <Card className="report-metrics"><div className="card-heading"><h2>Overdue & blocked tasks</h2></div><Table caption="Tasks needing attention" rows={report.attention} columns={[{key:'title',label:'Task'},{key:'person',label:'Employee'},{key:'owner',label:'Owner',render:t => roleLabel(t.owner)},{key:'priority',label:'Priority'},{key:'due',label:'Due date',render:t => <span className={overdue(t) ? 'overdue-text' : ''}>{dateLabel(t.due)}{overdue(t) ? ' · Overdue' : ''}</span>},{key:'status',label:'Status',render:t => <Badge>{t.status}</Badge>}]} /></Card><p className="page-note">Task metrics respect the demo role. Document readiness counts verified or waived mandatory items. CSV contains metadata only.</p>
  </>
}
