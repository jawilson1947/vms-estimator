# Plan: Cost Item Copy Utility (Settings menu)

Goal: eliminate duplicate entry by copying selected `ProjectCost` rows from one project to another. Delivered as a standalone utility under Settings, mirroring the existing Survey Management utility (`/settings/survey-management`). Values copy as-is (unit cost, markup, cost date). Survey-linked rows (`surveyLocationId` set) are excluded — the survey copy utility already handles those. No changes to `CostEstimator.tsx`.

## 1. Settings entry

Add to `MENU_ITEMS` in `app/(dashboard)/settings/page.tsx`:

- `href: '/settings/cost-management'`, title "Cost Item Management", description "Copy cost line items between projects", icon (e.g., `CurrencyDollarIcon`), not `adminOnly` — but the page itself requires `canEdit(role)` (ADMIN / PROJECT_MANAGER / TECHNICIAN), same gating the API enforces. If the menu supports only `adminOnly`, follow the survey-management page's precedent for edit-role gating.

## 2. Page + panel (mirrors SurveyManagementPanel)

| File | Purpose |
|---|---|
| `app/(dashboard)/settings/cost-management/page.tsx` | Server page: session/role check, renders panel |
| `components/CostManagementPanel.tsx` | Client component, modeled on `components/SurveyManagementPanel.tsx` |

Panel structure (reuse SurveyManagementPanel patterns directly — ProjectPicker, action bar, modal, toasts):
1. **Source project picker** — searchable dropdown (same internal `ProjectPicker` pattern; copy it or extract to a shared component).
2. **Cost item table** — loaded via existing `GET /api/projects/[id]/costs`; columns: checkbox, Category, Description, Qty, Unit Cost, Markup, Line Total, Vendor. Header select-all. Search input filters by description/vendor; optional category filter dropdown. Survey-linked rows (`surveyLocationId != null`) are hidden (or shown grayed with a "survey item" badge and no checkbox — pick hidden for simplicity). Rows with `quantity = 0` (soft-deleted) also hidden.
3. **Action bar** — appears when ≥1 selected: "Copy to…" button + selection count and summed total.
4. **Copy modal** — target project picker (excludes source), summary ("Copy 5 items · $2,340.00"), Copy button.
5. **Toast** — success/error, auto-dismiss 4s, e.g., "5 items copied to Acme HQ".

## 3. API — `POST /api/project-costs/copy`

New file `app/api/project-costs/copy/route.ts`. Payload mirrors the survey management API shape:

```json
{ "sourceProjectId": 12, "targetProjectId": 34, "costIds": [101, 105, 110] }
```

1. Auth: `getServerSession` + `readSessionInfo`; require `canEdit(role)`. PROJECT_VIEWER rejected (403).
2. Validate: both projects exist, `sourceProjectId !== targetProjectId`, `costIds` non-empty.
3. Fetch: `prisma.projectCost.findMany({ where: { id: { in: costIds }, projectId: sourceProjectId, surveyLocationId: null, quantity: { gt: 0 } } })` — drops foreign IDs and survey rows server-side as a backstop.
4. Create copies in `prisma.$transaction`: copy `categoryId, cameraModelId, description, quantity, unitCost, markupPercent, vendor, url, costDate, billable, notes, artifactTypeId, artifactModelId, accessMethodId`; set `projectId = targetProjectId`, `surveyLocationId = null`; **omit** `lineTotal` (DB-computed); no catalog re-pricing — values copy as-is.
5. Audit: `auditFromRequest()` with source/target ids and count.
6. Response: `{ copied: n, skipped: s }`.

Project list for pickers: reuse whatever endpoint SurveyManagementPanel uses to load its project options; add one only if none exists.

## 4. No schema changes

`ProjectCost` already supports everything needed; no migration.

## 5. Edge cases

- Duplicate copies allowed (no unique constraint) — toast states rows added; re-running adds again.
- Camera/artifact catalog FKs copy directly (global tables, not project-scoped).
- Empty selection / same source and target: disable Copy client-side, reject server-side.
- Changing the source project clears the current selection.

## 6. Verification

1. `npx tsc --noEmit` — compare against known pre-existing errors only.
2. Manual: copy 3 items between projects → values identical on target's Cost page, totals recompute; survey rows never appear in the picker table; forced survey/foreign IDs in the payload are skipped (`skipped` count returned).
3. Settings menu shows the new tile; PROJECT_VIEWER can't see it and the endpoint returns 403.
4. Audit log entry recorded with source/target/count.
