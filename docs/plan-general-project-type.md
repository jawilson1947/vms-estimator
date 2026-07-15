# Plan: "General" Project Type

A third `ProjectType` for projects that are neither video surveillance nor access control. Surveyors assign multiple catalog items (with per-assignment quantities) to each survey location; those items flow automatically into the cost schedule with per-project price/markup overrides, exactly like the Access Control BOM.

Decisions confirmed: quantity is per assignment (catalog holds a default); cost-schedule pricing is editable per project like the AC BOM; catalog management is admin-only.

## 1. Schema (prisma/schema.prisma + one migration)

```prisma
enum ProjectType {
  VIDEO_SURVEILLANCE @map("Video Surveillance")
  ACCESS_CONTROL     @map("Access Control")
  GENERAL            @map("General")            // new
}

// Catalog of general-purpose items (admin-managed)
model GeneralItem {
  id          Int      @id @default(autoincrement()) @map("general_item_id")
  name        String   @unique @db.VarChar(150)
  description String?  @db.VarChar(255)
  cost        Decimal  @default(0) @db.Decimal(10, 2)   // default unit cost
  defaultQty  Decimal  @default(1) @map("default_qty") @db.Decimal(10, 2)
  sortOrder   Int      @default(0) @map("sort_order")
  active      Boolean  @default(true)

  assignments LocationGeneralItem[]
  projectCosts ProjectCost[]
  @@map("general_items")
}

// Junction: items assigned to a survey location, with per-assignment quantity
model LocationGeneralItem {
  id            Int            @id @default(autoincrement())
  locationId    Int            @map("location_id")
  generalItemId Int            @map("general_item_id")
  quantity      Decimal        @default(1) @db.Decimal(10, 2)
  notes         String?        @db.Text

  location      CameraLocation @relation(fields: [locationId], references: [id], onDelete: Cascade)
  generalItem   GeneralItem    @relation(fields: [generalItemId], references: [id])

  @@unique([locationId, generalItemId])
  @@map("location_general_items")
}
```

- `CameraLocation`: add back-relation `generalItems LocationGeneralItem[]`. No new FK column — unlike accessMethod (one per location), general items are many-per-location via the junction table.
- `ProjectCost`: add `generalItemId Int? @map("general_item_id")` + relation (`onDelete: SetNull`) — the override key for the cost page, mirroring `accessMethodId`/`artifactTypeId`.
- Migration: `ALTER TABLE projects MODIFY project_type ENUM(...)` to add 'General', `CREATE TABLE general_items`, `CREATE TABLE location_general_items`, `ALTER TABLE project_costs ADD COLUMN general_item_id` + FK. Follow `20260701_add_project_access/migration.sql` style; apply via `prisma db execute` (no shadow-DB privileges).
- Seed a `General Equipment` LineItemCategory row if missing (used by override rows, like `Access Control Equipment`).

## 2. Catalog management (Settings, admin-only)

Mirror `/settings/access-methods`:

| File | Purpose |
|---|---|
| `app/(dashboard)/settings/general-items/page.tsx` | Admin check, renders manager |
| `components/settings/GeneralItemManager.tsx` | CRUD list: name, description, cost, default qty, sort, active toggle |
| `app/api/general-items/route.ts` | GET (active items, sorted) + POST (admin) |
| `app/api/general-items/[id]/route.ts` | PUT + DELETE/deactivate (admin) |
| `app/(dashboard)/settings/page.tsx` | New MENU_ITEMS tile "General Items", `adminOnly: true` |

## 3. Project form

`components/ProjectForm.tsx`: add `GENERAL` ("General") to the project-type dropdown (still immutable on edit).

## 4. Survey UI

`app/(dashboard)/survey/[projectId]/page.tsx` currently branches two ways; make it three:

```tsx
project.projectType === 'ACCESS_CONTROL' ? <AccessSurveyBoard .../>
: project.projectType === 'GENERAL'      ? <GeneralSurveyBoard .../>
: <SurveyBoard .../>
```

**`components/GeneralSurveyBoard.tsx`** — clone AccessSurveyBoard's structure (location list, add/edit, photos) but replace the single AccessMethodPicker with a multi-item panel per location:

- "Items" section on each location card: rows of item name + quantity stepper + remove; "Add item…" opens a searchable picker of active GeneralItems; quantity defaults to the item's `defaultQty`.
- API: `app/api/survey/locations/[id]/general-items/route.ts` — PUT with `{ items: [{ generalItemId, quantity, notes? }] }` replaces the location's assignment set (delete + createMany in a transaction). Simpler and safer than per-row endpoints.
- `GET /api/survey/[projectId]` (and the location PATCH route's return shape): include `generalItems: { include: { generalItem: true } }`.

## 5. Cost schedule integration (the auto-apply)

Mirror the AC BOM flow end-to-end:

**a. Aggregate assignments → "general BOM" (costs page)**
`app/(dashboard)/costs/[projectId]/page.tsx`: when `projectType === 'GENERAL'`, build `generalItems[]` by summing `LocationGeneralItem.quantity` per `generalItemId` across the project's locations (also carry locationCount for context). Load overrides from ProjectCost rows where `generalItemId != null` keyed by `generalItemId`.

**b. CostEstimator rows**
`components/CostEstimator.tsx`: new props `generalItems` / `generalOverrides`, rendered as an editable section like the BOM table: description (item name), aggregated qty (editable), unit cost (defaults from catalog `cost`, editable), markup % (editable), remove/restore. Saving calls the new route below. Reuse the BOM row-state pattern (`bomKey` → `generalItemId` as key).

**c. Persist overrides**
`app/api/projects/[id]/general-bom/route.ts` — PUT mirroring `access-bom/route.ts`: upsert a ProjectCost row keyed by `(projectId, generalItemId)` with category `General Equipment`, `quantity`, `unitCost`, `markupPercent`, description; `removed` → quantity-0 marker row.

**d. buildCostSchedule**
No change needed for the totals: override rows are plain ProjectCost rows (`surveyLocationId` null, qty > 0) and already flow into groups/directTotal — same as AC. But add a default path so items appear before any override is saved: like the AC page does, the costs page seeds unsaved rows into the estimator UI from the aggregation (display-only until saved). Proposal/invoice always read saved ProjectCost rows, so the flow is: survey assigns → cost page shows defaults → saving materializes ProjectCost rows → schedule/proposal/invoice pick them up automatically.

*(Alternative considered: teach buildCostSchedule to read assignments directly like survey cameras. Rejected — the AC precedent keeps proposals/invoices driven purely by ProjectCost rows, and per-project price edits need those rows anyway.)*

**e. Copy utility note**
Cost Item Management already copies rows with `surveyLocationId == null`; general override rows qualify. Copied rows keep `generalItemId` (global catalog FK) — fine, matches camera/artifact behavior.

## 6. Display touches

- `components/ProjectScopePanel.tsx`: third mode for `GENERAL` — section "Survey Locations" with columns Area / Floor / Items (item names × qty, comma-joined); hide camera unit-cost column (same pattern as the ACCESS_CONTROL mode just added).
- `app/(dashboard)/survey/page.tsx`: type badge/icon for General.
- Location labels / proposal content: no change — they read ProjectCost rows and location names.

## 7. Sequencing

1. Schema + migration + `prisma generate` (user runs `db execute` — no shadow DB)
2. Catalog settings page + API
3. ProjectForm dropdown
4. GeneralSurveyBoard + assignment API
5. Costs page aggregation + CostEstimator section + general-bom API
6. ProjectScopePanel + survey landing badges
7. Verify: tsc via user's `npm run build` (sandbox mount unreliable), manual walkthrough — create General project → assign 2 items across 2 locations → costs page shows aggregated defaults → edit price/markup, save → proposal + invoice show the rows

## 8. Risks / notes

- ENUM alter on MySQL rewrites the column definition — safe, but run during low usage.
- Deactivating a catalog item leaves existing assignments/overrides intact (FK preserved); pickers only list `active` items.
- If a location is deleted, assignments cascade-delete; saved ProjectCost override rows persist (they're project-level aggregates) — consistent with AC behavior.
