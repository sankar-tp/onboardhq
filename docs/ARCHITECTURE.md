# OnboardHQ architecture and workflows

This document describes the implementation in `onboardhq/src`, inspected on 27 October 2026. OnboardHQ is a browser-only React application built with Vite, React Router, CSS and Lucide React. The four selectable roles simulate different views and permitted actions inside the same local workspace. They are **not authentication or a security boundary**. There is no backend, application API, account service or document-content storage.

## Diagram set

| Diagram | Presentation export | Editable source | Purpose |
| --- | --- | --- | --- |
| Technical architecture | [SVG](technical-architecture.svg) | [Mermaid](technical-architecture.mmd) | Runtime composition, shared state, workflow modules and device persistence |
| Role-based swimlane | [SVG](role-workflow.svg) | [Mermaid](role-workflow.mmd) | Four role lanes, parallel work, handoffs and review decisions |
| Employee onboarding journey | [SVG](onboarding-journey.svg) | [Mermaid](onboarding-journey.mmd) | End-to-end progression, rework and independent readiness measures |

The architecture and journey diagrams use indigo for application actions, slate for rules, green for persistence or resolved outcomes, and amber for attention or limitations. Solid arrows show control/data flow; dotted arrows show derived displays or explanatory relationships. The swimlane uses four sequence lifelines as role lanes, with `par`, `alt` and `loop` blocks for independent work, decisions and rework. Its arrows represent changes visible in the shared UI, **not network messages or notifications sent to people**. The workflow is illustrative: the implementation does not enforce a stage order between documents, provisioning and tasks.

## Runtime and routing

[`main.jsx`](../src/main.jsx) mounts React in StrictMode. [`App.jsx`](../src/App.jsx) creates a browser router. `WorkspaceProvider` wraps `AppLayout` and its child routes, keeping one shared workspace across navigation. `AppLayout` owns the responsive sidebar, header, demo role/employee selection, notifications, profile popovers and workspace feedback. Child pages render in its `Outlet`.

| Route | Component | Responsibility |
| --- | --- | --- |
| `/` | `Dashboard` | Derived cohort metrics, upcoming arrivals, document summary, role task queue and activity |
| `/employees` | `Employees` | Employee create/edit/delete, search, filters, sort and profile dialog |
| `/onboarding` | `Onboarding` | Initiate journeys; manage task owners, due dates, priorities, status and progress |
| `/assets` | `Assets` | Equipment inventory/assignments and software access requests/decisions |
| `/reports` | `Reports` | Employee/task filters, department summaries, attention items and CSV download |
| Unknown paths | `Navigate` | Replace the location with `/` |

Employee profiles are dialogs, not separate URL routes. Their Overview, Documents, Onboarding Tasks and Assets & Access tabs reuse shared data. The task and resource tabs embed the same `Onboarding` and `Assets` pages with an `employeeId` filter and `embedded` presentation flag. All five navigation routes remain available in each demo role; data and actions vary by role.

## Component organization

| Location | Responsibility |
| --- | --- |
| [`components/ui.jsx`](../src/components/ui.jsx) | Button, Input, Select, Card, Badge, PageHeader, EmptyState, paginated Table, Modal, Avatar and Progress |
| [`components/RecordForm.jsx`](../src/components/RecordForm.jsx) | Field-driven shared forms, validation feedback and guarded dismissal |
| [`components/useUnsavedChanges.js`](../src/components/useUnsavedChanges.js) | Route blocking, discard confirmation and browser unload protection |
| [`components/EmployeeProfile.jsx`](../src/components/EmployeeProfile.jsx) | Keyboard-accessible profile tabs and independent task/document summaries |
| [`components/HeaderPopover.jsx`](../src/components/HeaderPopover.jsx) | Anchored native popovers with dismissal behavior |
| [`components/documents/`](../src/components/documents/) | Checklist/review controls and simulated file metadata selection |
| [`layouts/AppLayout.jsx`](../src/layouts/AppLayout.jsx) | Common application shell and role controls |
| [`pages/`](../src/pages/) | Route views, view-local filters and action forms |
| [`data/sampleData.js`](../src/data/sampleData.js) | Seed employee records; `model.seed()` constructs the persisted initial workspace |
| [`index.css`](../src/index.css), [`App.css`](../src/App.css) | Shared design tokens, layout, responsive behavior and reusable presentation |

Tables paginate internally and scroll horizontally within their containers. Native dialogs manage modal focus, including nested dialogs; Escape dismissal runs through the unsaved-change guard. Profile tabs use arrow keys, Home and End. Draft form values and filters are view-local rather than automatically persisted drafts.

## Shared state and mutation pipeline

[`WorkspaceProvider.jsx`](../src/state/WorkspaceProvider.jsx) publishes workspace data through [`context.js`](../src/state/context.js) and `useWorkspace()`. Its public value includes `data`, derived `employees`, `allEmployees`, `visibleTasks`, `role`, role/identity setters, `commit` and feedback controls.

1. A page or reusable form calls `commit({ type, value })`.
2. `transition()` in [`model.js`](../src/state/model.js) clones and validates the latest workspace, checks the simulated role and applies the action. Document actions delegate to `documentTransition()`.
3. Successful domain actions prepend an activity entry and retain the latest 100 entries. The resulting workspace is validated again.
4. `saveWorkspace()` compares the current storage value against the provider's last serialized value, validates the new data and writes JSON.
5. Only after a successful write does the provider publish the next React state and show success feedback. Validation, stale writes and storage failures show errors without publishing the proposed change.

`latest` and `serialized` refs avoid applying mutations to stale React render data and retain the optimistic storage comparison token. Role and selected-employee changes use the same save path, but do not create domain activity entries. This is synchronous local persistence, not asynchronous server state or a cross-device event bus.

### Workspace relationships

| Collection / field | Relationship and rules |
| --- | --- |
| `employees` | Stable string IDs; employee details, joining date, stored status and document template |
| `journeys` | Unique employee IDs; every journey must reference an existing employee |
| `tasks` | Stable ID, `employeeId`, owner role, due date, priority, status and blocked reason; must belong to an existing journey |
| `documents` | One item per employee/document type; deterministic ID `employeeId:typeId`; required flag, status, remarks, review fields and versioned metadata |
| `assets` | Unique ID and case-insensitive inventory tag; Laptop or Accessory; empty `employeeId` means available |
| `access` | Existing employee, application name and Pending/Approved/Rejected/Revoked state |
| `activity` | Timestamped recent domain actions, with role and employee association where the action supplies it |
| `demoRole`, `demoEmployeeId` | Persisted simulation controls; IT Admin is represented internally as `IT` |

Deleting an employee removes their journey, tasks, documents and access requests, releases their assets and adjusts the selected demo identity. Historical activity is retained, including any historical employee association. Validation prevents duplicate IDs, orphaned active relationships, duplicate journeys and invalid dates/statuses. New interactive records generally use `crypto.randomUUID()`; seed data retains stable predefined identifiers.

## Role-based interaction model

| Action | HR | Employee | IT Admin | Manager |
| --- | --- | --- | --- | --- |
| Employee CRUD and journey initiation | Yes | No | No | No |
| Configure document template/requirements; review/waive | Yes | No | No | No |
| Simulate document submission | Any employee | Selected self only | No | No |
| Add/edit task definition | Any owner | No | IT-owned only | Manager-owned only |
| Complete/reopen or update task status | Any task | Own Employee-owned tasks | IT-owned only | Manager-owned only |
| Inventory and equipment assignment | No | No | Yes | No |
| Create Pending application access request | Yes | Selected self only | Yes | Yes |
| Approve/reject/revoke/reopen access | No | No | Yes | No |
| Dashboard and report views | Workspace | Selected self | Workspace; IT task queue | Workspace; Manager task queue |

In Employee mode the provider filters employees, journeys, tasks, documents, assets, access and employee-associated activity to the selected identity. `allEmployees` remains available to the identity selector. HR and Employee task views include all tasks within their data scope; IT and Manager task queues include only tasks owned by that role. Employee action checks are stricter than visibility: employees can change only their own Employee-owned task status/blocked reason, not its title, owner, due date, priority or employee association.

These checks are in client code and localStorage is user-editable. They demonstrate behavior, not authorization. IT and Manager views are role queues, not manager-specific reporting hierarchies. The displayed manager name is employee metadata, not an authenticated manager account.

## Employee and onboarding workflows

HR creates an employee with department, role, manager, joining date and onboarding type. A seven-item document checklist is created immediately, before journey initiation. Initiating a journey adds the employee ID to `journeys` and creates four tasks through [`workflow.js`](../src/state/workflow.js): welcome handbook (Employee), document collection/review (HR), equipment/access preparation (IT), and orientation/handover/mentor planning (Manager). Titles vary by onboarding type, and initial due dates match the joining date. Seeded journeys use a separate prepopulated task set.

Tasks support Not started, In progress, Blocked, Needs attention and Completed; priorities are Low, Medium, High and Urgent. Blocked tasks require a nonempty reason. Complete and Reopen actions confirm the change; reopening sets In progress. An incomplete task is overdue when its due date is before `today()`, which uses the Asia/Kolkata calendar date.

`employeeRows()` calculates task progress as completed tasks divided by all employee tasks, rounded to a whole percentage; no tasks means 0%. For an initiated journey, all tasks completed yields Completed; otherwise Blocked/Needs attention takes precedence, followed by In progress when any task has moved beyond Not started. Overdue alone does not change the employee status. Without a journey the stored employee status is displayed. HR manual employee-status changes can update the employee's tasks to that status, keeping the task-derived view consistent.

**There is no combined readiness gate or final approval action.** The task named for reviewing documents does not automatically verify documents. Equipment allocation and access approval do not automatically complete IT tasks. Journey completion follows task statuses even if documents are missing or access is pending. The diagrams show these independent tracks instead of inventing an enforced all-ready completion gate.

## Document collection and verification

[`documents.js`](../src/state/documents.js) defines the seven document types and three templates. All items exist in every checklist; the template controls mandatory flags.

| Document | Fresher | Experienced Hire | Intern |
| --- | --- | --- | --- |
| ID proof | Required | Required | Required |
| Educational certificates | Required | Required | Required |
| Experience letter | Optional | Required | Optional |
| Relieving letter | Optional | Required | Optional |
| Bank proof | Required | Required | Optional |
| Employment agreement | Required | Required | Required |
| Photograph | Required | Required | Required |

HR can override individual requirements or reapply a template. Reapplying resets the required flags to that template while retaining submissions, reviews and tasks.

- Missing or Rejected items may receive a simulated submission. Valid metadata is appended as the next version and the status becomes Pending Review.
- Only HR can verify or reject, and those decisions require Pending Review. Verification remarks are optional; rejection remarks are required.
- HR may waive an item with remarks, including an item without a submission.
- HR may request resubmission of a non-Missing item with remarks. The item becomes Missing and keeps earlier versions; a Missing item is already awaiting submission.
- Remarks are trimmed and limited to 500 characters. Previous remarks remain until the next review.
- Document readiness is the percentage of **mandatory** items that are Verified or Waived. Optional items do not block readiness. An employee with zero mandatory items is 100% ready.

The real browser file input accepts PDF, JPG/JPEG and PNG. [`fileMetadata.js`](../src/state/fileMetadata.js) validates a nonempty filename up to 180 characters, disallows paths/control characters/leading dots, checks extension and supplied MIME consistency, and enforces a positive integer size of at most 10 MiB (labelled 10 MB in the UI). It extracts only an explicit metadata allowlist. Generated sample metadata is an alternative. No file bytes are read, uploaded, persisted or downloadable; type checks are metadata checks, not file-content inspection. Stored versions retain filename, format, size, timestamp and version plus metadata source/MIME for picked files. Historical generated filenames remain valid for compatibility.

## Provisioning workflows

Only IT Admin creates/edits equipment or changes assignments. An available item can be assigned to one employee. An item assigned to another employee must first be unassigned, preventing direct duplicate assignment. Unassignment returns the item to inventory. Inventory tags are case-insensitively unique.

All roles may request application access; Employee requests are limited to the selected self. A second Pending or Approved request for the same employee and case-insensitive application name is rejected. IT Admin approves/rejects Pending requests, revokes Approved access and reopens Rejected/Revoked records to Pending. Decisions retain the original application and employee. These are status simulations: no devices or external accounts are actually provisioned.

## Dashboard, reporting and exports

Dashboard metrics derive from the provider's scoped workspace: upcoming employees joining today through 14 days ahead, journey counts/status distribution, pending role tasks ordered by due date, document counts and recent activity. Its Needs attention KPI combines overdue visible tasks with pending access requests for HR/IT; Manager/Employee see the overdue-task count. The cohort chart is a current status distribution, not a historical analytics series.

[`reporting.js`](../src/state/reporting.js) applies department, onboarding status and onboarding type filters to employees, then scopes tasks/documents to those employee IDs. Owner, priority and task-status filters refine only task rows and task attention metrics; they do not redefine the employee progress average or document readiness. Completion rate uses initiated journeys; average task readiness uses matched employees. Reports show N/A document readiness for zero matching employees, while preserving 100% for a matched employee with zero mandatory items.

CSV export uses `reportCsv()` to generate employee, task and document-status rows for the active filters. It quotes/escapes cells, neutralizes spreadsheet-formula prefixes and includes a UTF-8 BOM. Reports creates a browser Blob download and revokes its object URL. Export is disabled for zero matched employees. There is no export API and no file content in the CSV.

## Persistence, recovery and boundaries

[`storage.js`](../src/state/storage.js) stores one version-1 JSON workspace under `onboardhq.workspace.v1`. Missing storage seeds once; a valid empty workspace remains empty. Load validation performs additive compatibility migrations (document checklists/templates, old statuses/sizes, task defaults, inventory defaults and IT role aliases).

Before each save, the serialized value must match the provider's expected previous value. A different tab's write causes a reload-required error rather than overwriting it. There is no automatic cross-tab merge or live synchronization. If initial storage is corrupt or incompatible, the UI falls back to seed data with an error and disables writes to preserve the original stored value. Storage quota/access failures surface as feedback. Clearing browser data removes persistence; this is not durable server storage.

## Design decisions and practical limits

- Shared context keeps pages consistent without adding a state-management dependency. Domain transitions and derived queries remain outside JSX for focused unit testing.
- Reusing embedded pages and common controls keeps profile and route behavior aligned; filters/drafts remain local to the view.
- Document readiness is deliberately calculated independently from task progress. The UI exposes both rather than claiming a broader completion guarantee.
- Stable identifiers and validation preserve active relationships; employee deletion explicitly cascades dependent records and releases equipment.
- Local persistence and role controls make the prototype self-contained. There are no authenticated users, server-enforced permissions, actual file verification, email delivery, equipment integrations or software provisioning.

## Editing and validating the artifacts

Edit the `.mmd` files and regenerate the matching `.svg` files with Mermaid CLI. Exports were generated with Mermaid CLI 12.0.0 and a headless local Edge browser; the renderer is a temporary documentation tool, not an application dependency. Both flowcharts use the base theme with indigo/slate/green/amber classes; the sequence diagram uses matching role headers and pale phase backgrounds. SVG labels use SVG text rather than HTML foreign objects for portability. The exports include accessible titles/descriptions and self-contained styling.

The shared [renderer configuration](mermaid.config.json) preserves font, spacing and theme settings. Example regeneration with an installed Mermaid CLI (run from the application directory; use `-p` with a Puppeteer executable configuration if required by your browser installation):

```text
mmdc -i docs/technical-architecture.mmd -o docs/technical-architecture.svg -c docs/mermaid.config.json -b white
mmdc -i docs/role-workflow.mmd -o docs/role-workflow.svg -c docs/mermaid.config.json -b white
mmdc -i docs/onboarding-journey.mmd -o docs/onboarding-journey.svg -c docs/mermaid.config.json -b white
```

Mermaid 12 includes unused neo-theme CSS in sequence exports that references an absent `my-svg-gradient`. In the delivered swimlane SVG, those unused gradient references were normalized to the solid indigo `#6366f1`, keeping all fragment references valid without changing the visible diagram. Apply the same normalization if this renderer emits them again.

The delivered SVGs were checked for XML validity, finite nonempty view boxes, local fragment references and browser rendering. Edge confirmed that all 193 SVG text elements have nonempty bounds and remain inside their respective SVG canvases. The rendered previews were also inspected visually. Markdown-relative paths were checked against the workspace. These documentation checks do not replace application workflow tests. Existing test suites live in [`tests/`](../tests/); no application code or dependencies were changed for this documentation task.
