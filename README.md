# VMS Estimator — CSMS

Web application for developing cost estimates for Video Surveillance (CCTV) installations.

**Stack:** Next.js 14 App Router · Prisma ORM · MySQL 8 · Tailwind CSS · NextAuth

---

## Quick Start

```bash
npm install
# configure .env.local (see PHASE1_SETUP.md)
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev          # http://localhost:3000
```

Default login after seed: `admin@csms.local` / `Admin1234!`

---

## Key Modules

| Route | Description |
|---|---|
| `/dashboard` | Summary metrics |
| `/customers` | Customer CRUD |
| `/projects` | Project CRUD, cost summary, site linking |
| `/projects/[id]` | Project detail — costs, sites, fee summary |
| `/sites` | Site CRUD |
| `/sites/[id]` | Site detail with buildings & locations |
| `/cameras` | Camera inventory |
| `/costs` | Project cost line items |
| `/survey/[siteId]` | Field survey board |

---

## Survey Module (`/survey/[siteId]`)

The survey board (`components/SurveyBoard.tsx`) is the primary field-use screen.

### Features implemented
- **Buildings accordion** — collapsible per-building location lists, paginated 6 per page
- **Filter bar** — All / Pending / Surveyed
- **Location cards** — tap to open detail panel
- **Location detail panel (`LocationPanel`)**
  - Inline edit of area name, floor, and building (pencil icon toggles edit mode)
  - Building reassignment — PATCH updates `buildingId`; UI moves the card to the correct accordion without reload
  - Assign camera from inventory (`CameraPicker` component)
  - Photo upload — "Take Photo" (device camera) and "From Library" (photo library) via two separate `<input type="file">` elements
  - Survey notes and "Mark Surveyed" toggle
  - Delete location
- **Add Location form (`QuickAddSheet`)**
  - Fields: building, area name, floor, notes
  - **Assign Camera from inventory** — same `CameraPicker` UI; selection is held in state and applied via PATCH after location is created
  - Photo upload (Take Photo / From Library grid)
  - Voice commands: Name · Floor · Notes · Photo · Save · Next · Exit
  - Save & Next for rapid sequential entry

### File corruption pattern (known issue)
The Edit tool occasionally appends null-byte (`\x00`) lines to `SurveyBoard.tsx`. After any edit session run:
```bash
python3 -c "
lines = open('components/SurveyBoard.tsx','rb').readlines()
clean = [l for l in lines if l.strip(b'\x00') != b'']
open('components/SurveyBoard.tsx','wb').writelines(clean)
"
```
Then verify with `npx tsc --noEmit 2>&1 | grep SurveyBoard`.

### API routes (survey)
| Method | Route | Purpose |
|---|---|---|
| PATCH | `/api/survey/locations/[id]` | Update area name, floor, buildingId, notes, camera assignment, mark surveyed |
| DELETE | `/api/survey/locations/[id]` | Delete location (unlinks cameras, cascades images) |
| POST | `/api/survey/locations` | Create new location |
| POST | `/api/survey/locations/[id]/photos` | Upload site photo |
| GET | `/api/survey/cameras` | Fetch camera inventory + models for picker |

### `CameraPicker` component
- Reusable — used in both `LocationPanel` (existing locations) and `QuickAddSheet` (new locations)
- `onAssign(cameraId, cameraModelId?, camera?, model?)` — the last two optional params carry the full objects for immediate display without a reload
- Selecting an existing inventory camera links it by `cameraId`; selecting a model creates a PLANNED camera record

---

## Projects Module

### Site linking (`app/(dashboard)/projects/[id]/page.tsx`)
The project detail page has two site buttons:
- **Add Existing Site** (`components/AddSiteButton.tsx`) — opens a searchable modal listing all unattached sites; selecting one PATCHes that site's `projectId` and refreshes via `router.refresh()`
- **New Site** — navigates to `/sites/new?projectId=...`

`AddSiteButton` is a `'use client'` component; the project page remains a server component.

---

## File Corruption Mitigations

Large server-component pages (e.g. `app/(dashboard)/projects/[id]/page.tsx`) sometimes get extra `}` appended by tool operations. After edits always verify:
- `tail -5` the file and count closing braces
- `npx tsc --noEmit 2>&1 | grep "page.tsx"` to catch parse errors
- Fix with Edit tool targeting the extra `}\n}\n}` pattern

---

## Useful Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run db:migrate` | Apply schema changes |
| `npm run db:seed` | Populate sample data |
| `npm run db:studio` | Prisma Studio (visual DB editor) |
| `npx tsc --noEmit` | Type-check without building |
