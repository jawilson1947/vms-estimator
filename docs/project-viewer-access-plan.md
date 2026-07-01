# Plan: Restricted "Project Viewer" Access

## Goal

Let an admin grant a specific user access to one or more **individual projects** (add/remove at will). Such a user:

- can only use the **Projects** subsystem;
- sees only their assigned projects as active — all other projects appear **grayed out**;
- within an assigned project may **view existing proposals** and **print/download existing invoices and labels** (no creating, no cost editing);
- sees **every other menu item grayed out** (disabled, still visible).

Decisions locked in: a **dedicated `PROJECT_VIEWER` role** plus a **`ProjectAccess` join table**; **view/print existing only** (no generating new proposals/invoices).

---

## 1. Data model (`prisma/schema.prisma` + migration)

Add a role and a user↔project join table (there is no User↔Project link today).

```prisma
enum UserRole {
  ADMIN           @map("Administrator")
  PROJECT_MANAGER @map("Project Manager")
  TECHNICIAN      @map("Technician")
  VIEWER          @map("Viewer")
  PROJECT_VIEWER  @map("Project Viewer")   // NEW
}

model ProjectAccess {
  id        Int      @id @default(autoincrement()) @map("access_id")
  userId    Int      @map("user_id")
  projectId Int      @map("project_id")
  createdAt DateTime @default(now()) @map("created_at")

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([userId, projectId])
  @@map("project_access")
}
```

Add back-relations: `projectAccess ProjectAccess[]` on both `User` and `Project`.

**Migration:** hand-write `prisma/migrations/<ts>_add_project_access/migration.sql` (new enum value + table). Per the project's Prisma-v6 pinning, the sandbox can't reach the DB/engine — **you must run `npm run db:migrate` + `npm run db:generate` locally** before the `prisma.projectAccess` types resolve.

---

## 2. Access-control helpers

**`lib/auth.ts`** — add:

```ts
export function isProjectViewer(role: UserRole) { return role === UserRole.PROJECT_VIEWER; }
```

**New `lib/project-access.ts`** (server-only, uses prisma):

```ts
// null  => unrestricted (see everything)
// Set   => restricted to exactly these project ids
export async function accessibleProjectIds(userId: number, role: UserRole): Promise<Set<number> | null>
export async function canViewProject(userId: number, role: UserRole, projectId: number): Promise<boolean>
```

Unrestricted roles return `null`; `PROJECT_VIEWER` returns the id set from `ProjectAccess`.

---

## 3. Enforcement (defense in depth)

Middleware runs on the edge and only has the JWT (role) — **not** a DB connection — so it does **subsystem** gating; **per-project** gating happens in server components / route handlers where prisma is available.

**a. `middleware.ts`** — expand `matcher` to cover dashboard pages + project APIs. For a `PROJECT_VIEWER` token:
- allow page routes under `/projects` only → redirect any other dashboard page to `/projects`;
- allow project **read/export** APIs, block everything else with 403:
  - allow: `GET /api/projects/[id]/proposals` + `.../proposals/[pid]/pdf|docx`, `GET /api/projects/[id]/invoices` + `.../invoices/[iid]/pdf|docx`, `GET /api/projects/[id]/location-labels`;
  - block: proposal/invoice **create** `POST /api/projects/[id]/proposals` and `.../invoices`, all cost/edit/survey/admin APIs.

**b. `/projects` list page** — filter the query by `accessibleProjectIds` (see §4 for the grayed-out variant).

**c. `/projects/[id]` page** — call `canViewProject`; if false → `notFound()`. For `PROJECT_VIEWER`, render the **stripped view** (see §5).

**d. Project API routes** — in each allowed route, re-check `canViewProject` for the id before returning data; reject POST/create + cost mutations for the role. This backstops middleware.

---

## 4. Navigation graying (`components/Sidebar.tsx` + `app/(dashboard)/layout.tsx`)

Layout already has the session — pass `role` into `<Sidebar role={...} />`. In `Sidebar`, when `isProjectViewer(role)`, render every item **except Projects** as a disabled `<span>` (muted color, `cursor-not-allowed`, `aria-disabled`, no `href`) instead of a `<Link>`. Projects stays a normal link.

**Projects list graying:** the request is that non-accessible projects appear grayed out (visible but disabled). Implement the `/projects` list to render assigned projects normally and non-assigned ones as grayed, non-clickable rows.
> ⚠️ Trade-off: this reveals the *names* of projects the user can't open. If that's not acceptable, the alternative is to hide them entirely (filter them out). Flagging so you can pick — default in this plan is grayed-out per your wording.

---

## 5. Stripped project detail for PROJECT_VIEWER (`app/(dashboard)/projects/[id]/page.tsx`)

Conditionally hide: Edit button, cost summary/editing, survey locations, and the **create** actions. Keep only:
- **Proposals** — read-only list of existing proposals with view + PDF/DOCX download (reuse existing history/preview; hide "Prepare Proposal").
- **Invoices** — existing invoices with Print/PDF/DOCX (hide "Prepare Invoice").
- **Labels** — the existing `ProjectLocationLabelsButton` (GET docx), which is inherently print-only.

Proposals/invoices inherently show dollar totals — acceptable since the user is entitled to those documents.

---

## 6. Admin: assign / remove projects per user

**New API `app/api/admin/users/[id]/projects/route.ts`** (auto-gated by existing `/api/admin/*` middleware):
- `GET` → `{ assigned: Project[], available: Project[] }`
- `PUT` → set the full assigned list (replace), or `POST`/`DELETE` for single add/remove.

**UI in `components/admin/UserManager.tsx`** — when the edited user's role is `PROJECT_VIEWER`, show a **project assignment panel**: searchable list with checkboxes / add-remove chips, saving via the API above. Hidden for other roles.

---

## 7. Files touched

| Area | File | Change |
|------|------|--------|
| Schema | `prisma/schema.prisma` + new migration | enum value, `ProjectAccess`, back-relations |
| Helpers | `lib/auth.ts`, new `lib/project-access.ts` | role + access helpers |
| Middleware | `middleware.ts` | subsystem gating, matcher expansion |
| Nav | `components/Sidebar.tsx`, `app/(dashboard)/layout.tsx` | gray non-Projects items |
| List | `app/(dashboard)/projects/page.tsx` | gray/filter non-assigned |
| Detail | `app/(dashboard)/projects/[id]/page.tsx` | access check + stripped view |
| Project APIs | `proposals`, `invoices`, `location-labels` route.ts | per-project + role checks; block create |
| Admin | new `app/api/admin/users/[id]/projects/route.ts`, `components/admin/UserManager.tsx` | assignment API + UI |
| Types | `types/next-auth.d.ts` | (role already present) |

---

## 8. Verification

- esbuild transpile-check each edited TSX/TS (sandbox `tsc` is unreliable here); strip null bytes after edits per project rules.
- Manual: create a `PROJECT_VIEWER`, assign one project. Confirm: only Projects nav is active; only the assigned project is clickable; can view an existing proposal and print invoice + labels; cannot open another project; direct-URL to `/costs`, `/customers`, another `/projects/[id]`, or a create/edit API is redirected/403; create buttons absent.
- Confirm existing `VIEWER`/other roles are unchanged.

---

## 9. Rollout notes

- Run `npm run db:migrate` + `npm run db:generate` **locally** (sandbox can't reach MySQL/engine); `prisma.projectAccess` types won't resolve until then.
- Middleware = edge (role only, no DB) → subsystem gate; per-project gate lives in server components/routes.
- Consider an audit-log entry when project access is granted/revoked (there's an existing `AuditLog`).
