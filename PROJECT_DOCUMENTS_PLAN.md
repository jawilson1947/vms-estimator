# Plan: Move Document Upload from Site Page to Project Page

**Date:** 2026-08-07
**Decisions (confirmed):** attach documents to **Project** (new table + migration) · migrate existing site documents **where unambiguous** · **remove** the Documents card from site pages entirely · PROJECT_VIEWER gets **view/download only**.

---

## 1. Current state

| Piece | Location | Notes |
|---|---|---|
| UI card | `components/SiteDocuments.tsx` (186 lines, client) | List + upload + delete, 5-doc cap, 25 MB, PDF/Word/Excel/PNG/JPG |
| Rendered on | `app/(dashboard)/sites/[id]/page.tsx` (line ~127) and `app/(dashboard)/sites/[id]/edit/page.tsx` (line ~43) | |
| API | `app/api/sites/[id]/documents/route.ts` (GET, POST) · `app/api/sites/[id]/documents/[docId]/route.ts` (DELETE) | Uses **raw SQL** (`$queryRaw`) against `site_documents`; auth = session-only, no role check |
| Storage | Vercel Blob, prefix `site-documents/` | `put()` on upload, best-effort `del()` on delete |
| Schema | `SiteDocument` model → `site_documents` table, FK `site_id` (cascade) | Created via loose `prisma/migrations/add_site_documents.sql` |

Key structural fact: **Site ↔ Project is many-to-many-ish** (Project → optional Building → Site), so a site can serve several projects and a project can lack a site. This is why documents must re-home onto Project directly.

---

## 2. Schema & migration

### 2a. New Prisma model

```prisma
model ProjectDocument {
  id               Int      @id @default(autoincrement()) @map("document_id")
  projectId        Int      @map("project_id")
  fileName         String   @map("file_name") @db.VarChar(255)
  originalFileName String?  @map("original_file_name") @db.VarChar(255)
  filePath         String   @map("file_path") @db.VarChar(500)
  fileUrl          String?  @map("file_url") @db.VarChar(500)
  mimeType         String?  @map("mime_type") @db.VarChar(100)
  fileSizeBytes    BigInt?  @map("file_size_bytes")
  uploadedBy       String?  @map("uploaded_by") @db.VarChar(100)
  uploadedAt       DateTime @default(now()) @map("uploaded_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@map("project_documents")
}
```

Add `documents ProjectDocument[]` to `model Project`. Keep the `SiteDocument` model and table **for now** (it holds any un-migrated rows); remove `documents SiteDocument[]` only if nothing references it — it's still referenced by the model, so leave both untouched this pass.

### 2b. Migration — `prisma/migrations/20260807_add_project_documents/migration.sql`

Proper migration folder (not a loose .sql) so `npm run db:migrate` applies it.

```sql
-- 1. New table
CREATE TABLE project_documents (
  document_id        INT AUTO_INCREMENT PRIMARY KEY,
  project_id         INT NOT NULL,
  file_name          VARCHAR(255) NOT NULL,
  original_file_name VARCHAR(255) NULL,
  file_path          VARCHAR(500) NOT NULL,
  file_url           VARCHAR(500) NULL,
  mime_type          VARCHAR(100) NULL,
  file_size_bytes    BIGINT NULL,
  uploaded_by        VARCHAR(100) NULL,
  uploaded_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_project_documents_project (project_id),
  CONSTRAINT fk_project_documents_project
    FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
);

-- 2. Migrate documents from sites linked to EXACTLY ONE project
INSERT INTO project_documents
  (project_id, file_name, original_file_name, file_path, file_url,
   mime_type, file_size_bytes, uploaded_by, uploaded_at)
SELECT one.project_id, sd.file_name, sd.original_file_name, sd.file_path,
       sd.file_url, sd.mime_type, sd.file_size_bytes, sd.uploaded_by, sd.uploaded_at
FROM site_documents sd
JOIN (
  SELECT b.site_id, MIN(p.project_id) AS project_id
  FROM projects p
  JOIN buildings b ON b.building_id = p.building_id
  GROUP BY b.site_id
  HAVING COUNT(DISTINCT p.project_id) = 1
) one ON one.site_id = sd.site_id;

-- 3. Remove the migrated rows from the old table
DELETE sd FROM site_documents sd
JOIN (
  SELECT b.site_id
  FROM projects p
  JOIN buildings b ON b.building_id = p.building_id
  GROUP BY b.site_id
  HAVING COUNT(DISTINCT p.project_id) = 1
) one ON one.site_id = sd.site_id;
```

Note the 5-doc cap: a migrated project could theoretically exceed 5 if a site already had 5 and the project gains more later — the POST route's count check handles this naturally (uploads blocked until under cap). No special handling needed.

### 2c. Flag leftovers for manual handling

After migrating, run once and report (documents on sites with 0 or 2+ linked projects stay in `site_documents`):

```sql
SELECT sd.document_id, s.site_name, sd.original_file_name, sd.file_url
FROM site_documents sd JOIN sites s ON s.site_id = sd.site_id;
```

Anything listed needs a human decision (re-upload to the right project, or delete). Blob files under `site-documents/` for migrated rows keep working — URLs are copied as-is; no blob moves required.

---

## 3. API routes (new)

Mirror the invoices-route pattern (`app/api/projects/[id]/...`), and reuse the role guards from `lib/project-access.ts`.

### `app/api/projects/[id]/documents/route.ts`

- **GET** — list documents for the project, ordered by `uploaded_at ASC`.
  Auth: `guardProjectRead(projectId)` — viewers may list only granted projects.
- **POST** — multipart `file` upload.
  Auth: session required **and** `readSessionInfo(...).role !== 'PROJECT_VIEWER'` → else 403.
  Validation (unchanged from site version): allowed MIME/ext (PDF, doc/x, xls/x, PNG, JPG), 25 MB max, **5 docs per project** cap.
  Blob: `put('project-documents/doc-${projectId}-${Date.now()}.${ext}', ...)` — new prefix keeps old and new blobs distinguishable.
  Insert into `project_documents`, return the normalised row (201).

### `app/api/projects/[id]/documents/[docId]/route.ts`

- **DELETE** — same as today's site version: look up `file_url`, best-effort `del()` from Blob, delete row. Auth: session + not PROJECT_VIEWER (403). Also verify the doc's `project_id` matches the route's `[id]` (the old route skipped this check — fix it here).

**Implementation choice:** write these with the **Prisma client** (`prisma.projectDocument.*`) rather than raw SQL. The raw SQL in the site routes existed because the client hadn't been regenerated; since this change ships a migration anyway, `npm run db:generate` runs regardless. (Sandbox caveat: `prisma.projectDocument` types won't resolve until Jim runs `db:migrate` + `db:generate` locally — same situation as the Invoice feature. If red squiggles during development are a problem, fall back to `$queryRaw` exactly like the site routes.)

---

## 4. Component — `components/ProjectDocuments.tsx`

New file, adapted from `SiteDocuments.tsx` (copy, don't edit in place):

- Props: `{ projectId: number; readOnly?: boolean }`
- Fetch/POST/DELETE against `/api/projects/${projectId}/documents...`
- `readOnly` (PROJECT_VIEWER): render the list with open-in-new-tab links, but hide the Upload button, the file input, the per-row delete button, and the "x / 5" cap hint. Empty state for viewers: "No documents." (no upload prompt).
- Everything else (types, cap, 25 MB hint, spinners, error text) carries over; change "per site" copy to "per project".

Then **delete `components/SiteDocuments.tsx`** once nothing imports it.

---

## 5. Page changes

### `app/(dashboard)/projects/[id]/page.tsx`
- Import `ProjectDocuments`.
- Render `<ProjectDocuments projectId={project.id} readOnly={isViewer} />` inside a `mb-4` wrapper, **between the Building card and `<ProjectScopePanel>`** (matches the site page's old placement rhythm: info cards → documents → main content).

### `app/(dashboard)/sites/[id]/page.tsx`
- Remove the `SiteDocuments` import and the `{/* Documents */}` block (lines ~125–128).

### `app/(dashboard)/sites/[id]/edit/page.tsx`
- Remove the `SiteDocuments` import and `<SiteDocuments siteId={site.id} />` (line ~43).

### Old API routes
- Delete `app/api/sites/[id]/documents/route.ts` and `.../[docId]/route.ts` **after** confirming the leftover-report (2c) is empty or the leftovers have been handled — otherwise keep them one release so leftover files remain downloadable/deletable, then remove.

---

## 6. Order of work

1. Schema: add `ProjectDocument` model + `Project.documents` relation; write migration SQL.
2. New API routes (GET/POST/DELETE) with role guards.
3. New `ProjectDocuments.tsx` component.
4. Wire into project page; remove from both site pages.
5. **Jim, on the dev machine:** `npm run db:migrate` then `npm run db:generate` (sandbox can't reach the MySQL DB or Prisma engine downloads).
6. Run the leftover-report query; handle stragglers; then delete `SiteDocuments.tsx` and the old site-document API routes.

## 7. Verification checklist

- File-integrity: sha256-compare committed files against sandbox copies (null-byte corruption guard per house rules); `npx tsc --noEmit 2>&1 | grep -E "ProjectDocuments|documents/route|projects/\[id\]/page|sites/\[id\]"` — ignore the known pre-existing errors (`.next/types`, `VoiceContext`, `useSpeak`).
- Manual: upload/delete on a project as admin; confirm 6th upload blocked; open a migrated document (old blob URL); log in as a PROJECT_VIEWER → sees list + can download, no upload/delete buttons, POST/DELETE return 403 via curl; viewer on a non-granted project → GET 403.
- Site page + site edit page render clean with the card gone; project with **no building** can still upload documents.

## 8. Files touched (summary)

| Action | File |
|---|---|
| edit | `prisma/schema.prisma` |
| new | `prisma/migrations/20260807_add_project_documents/migration.sql` |
| new | `app/api/projects/[id]/documents/route.ts` |
| new | `app/api/projects/[id]/documents/[docId]/route.ts` |
| new | `components/ProjectDocuments.tsx` |
| edit | `app/(dashboard)/projects/[id]/page.tsx` |
| edit | `app/(dashboard)/sites/[id]/page.tsx` |
| edit | `app/(dashboard)/sites/[id]/edit/page.tsx` |
| delete (step 6) | `components/SiteDocuments.tsx`, `app/api/sites/[id]/documents/**` |
