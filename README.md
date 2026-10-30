# OnboardHQ

An interactive React + Vite onboarding prototype. All seed employees, company details and inventory are fictional. The existing pages, profile tabs, shared components and responsive enterprise styling are retained. There is no backend, authentication, real provisioning or real document upload/storage.

## Run and validate

- `npm run dev`: Vite development server.
- `npm run lint`: source checks.
- `npm test`: 24 model, validation, persistence and workflow regression tests.
- `npm run build`: production output in `dist/`.
- `npm run preview`: local production preview.
- `npm run test:browser`: build and run five headless browser workflow tests using an installed Edge/Chrome/Chromium. Set `ONBOARDHQ_BROWSER_PATH` if the browser is in a custom location. No browser package is installed.

On Windows, use `npm.cmd` if PowerShell blocks npm.ps1. Production hosting must rewrite non-file routes to `index.html` to support direct links and refreshes.

## Employee workflows

Employees supports add, edit, view, confirmed deletion, search by name/role/manager, department/status/type filters, and sorting by name, joining date or department. Each profile has Overview, Documents, Onboarding Tasks and Assets & Access tabs with Arrow/Home/End keyboard navigation. Task and resource tabs reuse the existing workflows scoped to that employee.

Choose an onboarding type when adding/editing employees: **Fresher, Experienced Hire or Intern**. These labels map to the existing persisted templates (`Freshers`, `Experienced Hires`, `Interns`) for compatibility. HR can initiate onboarding from the directory or Onboarding page. It creates a type-specific checklist assigned to HR, IT Admin, Manager and Employee, with stable task IDs, priorities and joining-date due dates. Repeated initiation is rejected.

Changing employee type updates document requirements while preserving submissions, review decisions and existing tasks. Changing overall onboarding status requires confirmation and updates journey tasks. Deletion removes dependent tasks, journey, documents and access requests and returns assigned equipment to available inventory, preserving other employees.

## Documents and real file input

All seven items are supported: ID proof, educational certificates, experience letter, relieving letter, bank proof, agreement and photograph.

| Onboarding type | Required | Optional |
| --- | --- | --- |
| Fresher | ID, education, bank, agreement, photograph | Experience and relieving letters |
| Experienced Hire | All seven | None |
| Intern | ID, education, agreement, photograph | Bank, experience and relieving letters |

These are fictional demo policies. HR can apply a template or override individual requirements.

The submission dialog now includes a **real native file picker**, restricted to PDF/JPG/JPEG/PNG, plus the existing fictional sample-metadata choices. Use fictional test documents. It displays the selected filename, exact size, format and not-yet-submitted state. Validation checks filename length/characters, supported extension, declared MIME consistency and size greater than 0 bytes and at most **10 MB**.

The app extracts an explicit metadata allowlist from `File.name`, `File.size` and `File.type`. It never reads file contents, retains File objects in application state, creates document previews, sends network uploads or stores binary/base64 file data. Only metadata and simulated review states persist in localStorage. A simulated submission going to Pending Review is not a real upload. Since contents are never read, file signatures/content authenticity are not checked.

Statuses are Missing, Pending Review, Verified, Rejected and Waived. HR verifies or rejects pending submissions, adds fictional remarks and requests resubmission. Rejection, waiver and resubmission require remarks. Rejected documents can be selected again, creating a new metadata version. Only Verified/Waived mandatory documents count toward document readiness. Optional items never block readiness, and document readiness is separate from task progress.

## Tasks

Tasks have owner, employee, due date, Low/Medium/High/Urgent priority, status and optional blocked reason. HR can assign across roles; IT Admin and Manager manage their assigned tasks. Employee can update the status of their own Employee-owned tasks. Tasks can be added, edited, completed and reopened. Blocked tasks require a reason. Filter by task status, priority and owner. Overdue tasks and blocked reasons are highlighted. Completion/reopening updates derived employee status, progress, Dashboard and Reports immediately.

## Assets and access

IT Admin manages laptops and accessories with unique inventory tags. Each item is either available or assigned to one employee. A currently assigned asset cannot be assigned to a different employee: unassign it first. Inventory tags cannot be duplicated, including by case. Equipment can be managed from the main page or employee profile.

Software access requests support Pending, Approved, Rejected and Revoked, with reopening. Requests retain their original employee/application. Duplicate active requests are rejected. IT Admin approves/rejects/revokes; Employee can request only for their simulated identity.

## Role simulation

The header exposes **HR, Employee, IT Admin and Manager**. IT Admin retains the internal value `IT` to preserve existing saved roles and tasks. This is a UI simulation, not authentication or a security boundary.

Employee mode selects a fictional identity and scopes records, documents, tasks, inventory, access requests, activity, dashboard metrics and exported reports to that employee. HR sees all tasks; IT Admin and Manager task queues follow their role. Profile tabs, notifications and actions use the shared data and role rules. No placeholder action claims to provision an actual resource.

## Dashboard and Reports

Dashboard calculates upcoming starters within 14 days, cohort completion, pending tasks, blocked task counts, overdue items, pending access, document readiness and recent activity from shared records. Reports filters department, onboarding status/type, task owner, task priority and task status. Employee filters apply to all sections; task filters affect task metrics/rows only. CSV export includes matching employee, task and document rows, with CSV escaping and spreadsheet-formula protection. Completion metrics and document readiness use separate calculations.

## Persistence and safeguards

The workspace is seeded and saved **only when the storage key is absent**. Empty employee lists do not trigger reseeding. The key is `onboardhq.workspace.v1`. Existing data migrates additively: old statuses/file sizes remain compatible; tasks receive default priorities/reasons, assets receive category/tag defaults, and previous checklist overrides and reviews remain intact.

Writes succeed before UI records update. Read/write failures display errors without overwriting stored data. A stale-tab check rejects writes when another tab changed the workspace; reload to continue. Corrupt stored data is not silently reset. Back up/remove the key in browser developer tools to recover the initial fictional demo.

Forms/file selections warn before close, route navigation or refresh. Native dialogs contain focus and Escape closes only the active nested dialog. Sidebar drawer, profile tabs, tables, filters and inputs support keyboard use and visible focus. Dates/overdue calculations use the India calendar date. Recent activity keeps the latest 100 events.

## Structure and tests

- `src/state/model.js`: relational validation and core workflow transitions.
- `src/state/documents.js`, `fileMetadata.js`: document templates, review/readiness and metadata-only file validation.
- `src/state/workflow.js`: onboarding checklist generation, sorting and role/type labels.
- `src/state/storage.js`, `WorkspaceProvider.jsx`: first-launch persistence, stale-tab protection and shared/role-scoped data.
- `src/state/reporting.js`: filter-aware metrics and CSV rows.
- `src/components/`: existing UI components, forms, profile and document views.
- `src/pages/`: the existing five routes.
- `tests/*.test.js`: practical model, migration, role, file, date, priority, blocked/reopen, assignment, deletion, report and persistence tests.
- `tests/browser.test.mjs`: employee CRUD/type/initiation/sorting/refresh; real file input and review/resubmission; profile/mobile keyboard behavior; task blocked/complete/reopen; asset availability and filtered CSV export. Uses the existing project's dependency-free browser harness pattern and a temporary browser profile.

## Limitations

All workflow actions are browser-local simulations. There is no real authentication, cross-device sharing, multi-user backend or resource provisioning. Browser storage can be cleared or reach quota. Documents persist as metadata only; there are no retrievable stored file contents. Access approvals/document decisions do not automatically complete tasks. Inter loads from Google Fonts with system fallbacks.
