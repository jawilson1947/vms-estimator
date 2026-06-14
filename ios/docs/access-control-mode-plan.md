# Access Control Mode — iOS Implementation Plan

**Status:** Draft for review. No code changes yet.
**Scope:** iOS app at `/ios/CSMSSurvey` only. Windows / Next.js server changes are out of scope (the server work shipped in migration `20260612_add_access_control`); this plan only covers what iOS needs to catch up.
**Authoring date:** 2026-06-12.

---

## 1. Discovery findings

### 1.1 Project mode field — Windows source of truth

The project mode lives on the `Project` model as **`projectType`**, a Prisma enum.

`prisma/schema.prisma` lines 72, 90–93:

```
projectType  ProjectType  @default(VIDEO_SURVEILLANCE) @map("project_type")

enum ProjectType {
  VIDEO_SURVEILLANCE @map("Video Surveillance")
  ACCESS_CONTROL     @map("Access Control")
}
```

Wire format: the enum is serialized by its Prisma identifier (`"VIDEO_SURVEILLANCE"` / `"ACCESS_CONTROL"`) in JSON responses, with the human-friendly `@map` strings only relevant to the underlying SQL `enum` column.

References on the Windows side:

- `app/api/projects/route.ts` lines 68, 82 — destructured from POST body and written on create.
- `components/ProjectForm.tsx` lines 12, 32, 42–45 — UI dropdown with two options.
- Migration: `prisma/migrations/20260612_add_access_control/migration.sql` — adds the `project_type` column.

**Two gaps on the server side that block iOS** (flag these to the backend owner; do not work around them on iOS):

1. **`/api/projects/[id]` PUT route does not handle `projectType`** (lines 39–70). It is only writable on create today. This is fine if mode is locked after creation (recommended — see §9), but anyone planning to support mode changes needs to fix this first.
2. **`/api/survey/[projectId]` GET does not return `projectType`** — its `select` (lines 21–49) and normalized response (lines 68–102) omit the field entirely. iOS cannot branch on mode until the server includes it. Same route also omits `accessMethodId` / `accessMethod` on each `cameraLocations` row.

### 1.2 Access Methods — Windows source of truth

`AccessMethod` is a real database table, not an enum. Global (not org-scoped), soft-deleted via an `active` flag.

`prisma/schema.prisma` lines 290–316:

```
model AccessMethod {
  id        Int                @id @default(autoincrement())
  name      String             @unique @db.VarChar(100)
  grouping  String?            @db.VarChar(50)
  sortOrder Int                @default(0) @map("sort_order")
  active    Boolean            @default(true)
  items     AccessMethodItem[]
  locations CameraLocation[]
  costs     ProjectCost[]
  @@map("access_methods")
}
```

Seeded values (from `prisma/seed.ts` ~lines 378–420): *Internal Single Door, Internal Double Door, External Single Door, External Double Door, Sliding Door, Automatic Door, Elevator, Gate, Rim Panic Bar*. Nine entries today; each has a Bill-of-Materials chain (`AccessMethodItem`) used for costing on the Windows side — **the iOS app does not need the BOM**, only `id`, `name`, and `grouping`.

API: `GET /api/access-methods` (auth required) returns active rows sorted by `sortOrder, name`. Admin-only routes manage CRUD; iOS is read-only.

Windows UI reference: `components/survey/AccessMethodPicker.tsx` is a searchable picker that filters by `name`, `grouping`, and BOM item names. We do not need to replicate the BOM filtering on iOS, but the search-by-name + grouping pattern is worth mirroring because the list is small enough today to be flat but will grow.

### 1.3 Access Point storage — important finding

**Access points are NOT a separate table.** The Windows side reuses `CameraLocation` for both modes. The project's `projectType` is the discriminator, and the new column **`access_method_id`** (added in the 2026-06-12 migration) is what changes an interpretation of a row from "camera location" to "access point."

`prisma/schema.prisma` lines 154–173, abridged for the fields that matter per mode:

```
model CameraLocation {
  id                Int           @id @default(autoincrement()) @map("location_id")
  projectId         Int?          @map("project_id")
  cameraModelId    Int?          @map("camera_model_id")   // camera mode
  accessMethodId   Int?          @map("access_method_id")  // access-control mode
  floor             String?
  areaName          String?       @map("area_name")
  mountingLocation  String?       @map("mounting_location") // camera-only
  coveragePurpose   String?       @map("coverage_purpose")  // camera-only
  notes             String?
  surveyNotes       String?       @map("survey_notes")
  surveyedAt        DateTime?     @map("surveyed_at")
  accessMethod      AccessMethod? @relation(...)
  cameraModel       CameraModel?  @relation(...)
  images            CameraLocationImage[]
  @@map("camera_locations")
}
```

In access-control mode, `cameraModelId`, `mountingLocation`, and `coveragePurpose` are left null. In camera mode, `accessMethodId` is left null. Photos use the same `CameraLocationImage` table either way (no polymorphic owner; the relation is a direct FK on `location_id`).

API endpoints already accept both modes:

- `POST /api/survey/locations` — accepts `accessMethodId` in the body alongside the existing `areaName` / `floor` / `surveyNotes` fields. No new endpoint needed.
- `PATCH /api/survey/locations/[id]` — same.
- `POST /api/survey/locations/[id]/photos` — unchanged; works for both.

**Implication for iOS:** The wire format is unified. We do **not** need a separate iOS API client function, nor a separate `AccessPoint` server endpoint. We do, however, want the iOS *Swift type system* and *UI layer* to model the two as distinct things — see §6.

### 1.4 iOS state today (touch-point catalog)

| Concern | File | Notes |
|---|---|---|
| Project model | `CSMSSurvey/Models/Site.swift` lines 23–29 (`ProjectSummary`), 56–68 (`SurveyProject`) | No `projectType` field. |
| Location model | `CSMSSurvey/Models/SurveyLocation.swift` lines 3–28 | No `accessMethodId` or `accessMethod` field. |
| Photo model | `CSMSSurvey/Models/SurveyPhoto.swift` lines 3–10 | Reusable as-is. |
| Add-Location sheet | `CSMSSurvey/Views/Survey/AddLocationSheet.swift` | Template for `AddAccessPointSheet`. See line 26 (`maxPhotos = 5`), 60–86 (fields), 104–156 (photo section), 176–192 (toolbar / save). |
| Survey board "Add Location" button | `CSMSSurvey/Views/Survey/SurveyBoardView.swift` lines 98–111 | The branching point for showing "Add Access Point" instead. |
| Voice interview | `CSMSSurvey/Voice/VoiceInterviewManager.swift` lines 46–54 (regexes), 107–162 (script flow) | Question script is hard-coded for camera mode. |
| API client | `CSMSSurvey/Services/APIClient.swift` lines 42 (`fetchSitesList`), 54 (`fetchProject`), 60 (`createLocation`), 72–91 (`uploadPhoto`) | Already targets the right endpoints. Needs request-body shape updates only. |
| Report generation | n/a | Reports are generated server-side. iOS does no report generation. (Grep for `report` / `pdf` / `export` in Swift returns only speech-recognition flags.) |
| Project create flow | n/a | Projects are created server-side; iOS only reads. |
| Existing AC references | n/a | Zero matches across the iOS codebase for `AccessControl`, `AccessMethod`, `AccessPoint`. |

**Photo pattern caveat — needs user confirmation.** The brief specifies "5 Live Photos, 5 Library Photos" per access point. The existing camera-mode `AddLocationSheet` uses a **single combined 5-photo bucket** (`maxPhotos = 5` at line 26; `pendingPhotos` is one `[UIImage]` array at line 17, fed by both camera capture and PhotosPicker). So either (a) the brief is wrong about camera mode and access-control will follow the same single-5 pattern, or (b) the team genuinely wants 5+5 for access points (and possibly retro-update camera mode). See §9 open questions.

---

## 2. Mode picker

Two entry points where the picker must appear:

**A. New project creation.** Project creation is server-side today; iOS doesn't create projects. **No change required on iOS** for this branch — the existing Windows `ProjectForm.tsx` dropdown already handles it. If/when iOS gains a create-project flow, the mode picker must be embedded in it; until then it's a non-iOS concern.

**B. Legacy project without a mode (force-pick).** This is the only path iOS owns. When the user opens a project whose `projectType` is null or missing from the server payload, the survey board cannot render either button — we don't know which to show. The flow:

1. `SurveyBoardView` checks `project.projectType` on appear.
2. If `nil`, present a non-dismissible sheet (`isModalInPresentation = true` and no `dismiss()` path from inside the sheet) that asks "What kind of survey is this project?" with two large buttons: Camera Survey / Access Control Survey.
3. On selection, PATCH the project (route: `/api/projects/[id]` — **note the server gap in §1.1; the PUT route must be extended to accept `projectType` first**). On success, mutate the in-memory project and dismiss the sheet.
4. If the PATCH fails, keep the sheet up and surface the error inline.

The picker should explain the consequence in one line: *"This choice determines what data is collected and cannot be changed once survey work begins."* (See §9 open questions about whether the lock is hard or soft.)

A legacy backfill on the server side (set `projectType = VIDEO_SURVEILLANCE` for every existing project) would eliminate the need for the picker entirely — see §8.

---

## 3. Survey screen branching

`SurveyBoardView` becomes mode-aware:

- Read `project.projectType` once at view-load.
- The "Add Location" button (lines 98–111) becomes a conditional: render "Add Location" when mode is `videoSurveillance`, "Add Access Point" when mode is `accessControl`. Only one is visible.
- The list of recorded items on the board is data-driven. The server returns one array (`locations`), but the UI label and the per-row presentation differ — for camera-mode rows, show camera model / mounting; for access-mode rows, show access method / floor. The list view should accept a `ProjectMode` parameter and pick the row renderer accordingly.
- The existing camera flow is untouched for camera-mode projects. The new sheet (§4) is wired only on the access-control branch.
- The voice interview toolbar button is unchanged in placement but routes to the right script (§5).

For an unset mode (`nil`), the survey board hides both buttons and the list and shows the modal picker described in §2.

---

## 4. AddAccessPointSheet (new file)

Proposed location: `CSMSSurvey/Views/Survey/AddAccessPointSheet.swift`. Structural parallel to `AddLocationSheet.swift` so reviewers can diff the two side by side.

Form sections, top to bottom:

- **Location** — Area / Door name (TextField, required), Floor (TextField, optional). Same controls as the camera sheet (lines 60–67 of AddLocationSheet).
- **Access Method** — A picker that opens a searchable list backed by `AccessMethod` records fetched from `GET /api/access-methods`. Required. The picker shows `name`, optionally subtitle on `grouping`. List today is small (~9 entries) but plan for search by name + grouping to mirror the Windows picker.
- **Notes** — TextEditor (optional). Identical control to the camera sheet's survey-notes section.
- **Photos** — Same component the camera sheet uses (`CameraCapture` + `PhotosPicker`) so we don't drift. Whether this is 5 total or 5+5 is an open question; see §9.

Toolbar: Cancel / Voice Interview / Save (or Save & Next), identical to AddLocationSheet.

Save action: `APIClient.createAccessPoint(body)` → on success, upload each photo via the existing `uploadPhoto(locationId:imageData:mimeType:)`. Under the hood `createAccessPoint` POSTs to `/api/survey/locations` with `accessMethodId` populated (the same endpoint camera-mode uses today — see §6).

State variables to mirror from AddLocationSheet:
- `@State areaName`, `@State floor`, `@State notes` → already familiar.
- `@State accessMethodId: Int?` and `@State accessMethods: [AccessMethod]` (loaded on appear).
- Photo / save / error state — identical names so the two sheets stay isomorphic.

---

## 5. Voice interview script per mode

`VoiceInterviewManager.swift` currently hard-codes the camera script (regex patterns at lines 46–54: `areaRegex`, `floorRegex`, `notesRegex`; command handling at lines 139–162). For mode-branching:

- Add a `mode: ProjectMode` parameter to whatever entry point starts the interview (probably the function called from the sheet's toolbar button — already accepts a project context).
- Extract the question script into a small struct: an ordered list of "ask this prompt; expect this regex; bind to this field." Camera mode has `areaName → floor → notes`. Access-control mode has `areaName → floor → accessMethod → notes`.
- For the **Access Method** prompt specifically, the script must read the list of allowable values aloud (or at least the groupings) and accept loose spoken matches against `AccessMethod.name`. Use a fuzzy-match pass: lowercase + strip punctuation, then `contains` against each candidate; if zero or multiple matches, re-prompt with a clarification.
- Commands ("save and next", "review survey", "finish") are mode-agnostic and stay where they are.
- The Access Method list must be fetched/cached before the interview starts so the script has it offline.

---

## 6. Data model + sync

### iOS Swift types

Three changes to `CSMSSurvey/Models`:

1. **New `ProjectMode` enum** matching the server enum exactly:

   ```swift
   enum ProjectMode: String, Codable {
       case videoSurveillance = "VIDEO_SURVEILLANCE"
       case accessControl     = "ACCESS_CONTROL"
   }
   ```

2. **`SurveyProject` gains `projectType: ProjectMode?`** — optional because legacy projects may arrive without it until the backfill runs. `SurveyLocation` and `ProjectSummary` likely don't need it; only the full project does.

3. **`SurveyLocation` gains `accessMethodId: Int?` and `accessMethod: AccessMethodSummary?`** — the wire payload is unified, so the existing struct just grows two optional fields. UI code decides which fields are relevant based on mode.

4. **New `AccessMethod` model** in `CSMSSurvey/Models/AccessMethod.swift`:

   ```swift
   struct AccessMethod: Codable, Identifiable, Hashable {
       let id: Int
       let name: String
       let grouping: String?
       let sortOrder: Int
   }
   ```

   Plus a `AccessMethodSummary` (just `id` + `name`) for the embedded reference inside `SurveyLocation`.

**Naming note.** We are deliberately NOT introducing a separate `AccessPoint` Swift struct, because the wire format and storage are unified — adding a parallel type would require synchronizing two decoders against one payload. The "AccessPoint" concept lives in the *view layer* (sheet name, button label, voice script) but not in the data layer. The plan's title and button labels read "Access Point" everywhere user-facing; the underlying type is still `SurveyLocation`.

### Sync paths

- `APIClient.fetchProject(_ id)` already pulls the project payload. The server-side response must be extended to include `projectType` and the `accessMethod` relation on each location (server gap flagged in §1.1).
- New `APIClient.fetchAccessMethods()` → `GET /api/access-methods`, returns `[AccessMethod]`. Cached in memory at app launch (after login). Refresh on pull-to-refresh of the survey board, in case the admin added one.
- New `APIClient.createAccessPoint(_ body)` is a thin wrapper around the existing `createLocation` POST that just populates `accessMethodId` instead of camera fields. Could equivalently extend `createLocation` to take an optional `accessMethodId` and skip the new function entirely; the wrapper is purely for readability of call sites. Recommend: extend `createLocation` with `accessMethodId: Int?` — one function, one endpoint, no duplication.
- `uploadPhoto` is unchanged.

### Mode-change implications

If we lock mode after creation (recommended — see §9), there's nothing to do. If we allow mode change, we must (a) decide what happens to existing rows with the wrong discriminator populated, and (b) get the server PUT route fixed to accept `projectType` (§1.1). Strongly recommend not opening this door for v1.

---

## 7. Reports

Reports are generated **server-side** — no iOS reporting code exists today (grep for `report` / `pdf` / `export` in Swift returns nothing relevant). Identifying the server-side report changes is therefore out of scope for the iOS plan; the iOS team's responsibility is to make sure the data the server needs (the populated `accessMethodId`, the photos, etc.) flows correctly through the iOS write path. The Windows report generator is the team that owns the access-control report variant.

**Action for iOS:** none today, beyond verifying that the server's existing report endpoint(s) accept a project in either mode and route to the right template. Confirm with the report owner once iOS write-path is in place.

---

## 8. Migration / backfill

**Existing projects.** The 2026-06-12 server migration adds `project_type` with a default of `VIDEO_SURVEILLANCE`, so every existing project should already have a mode after the migration runs. **Needs verification** — please confirm with the backend owner that the migration actually applies the default to existing rows (some Postgres `ADD COLUMN ... DEFAULT ...` paths backfill, others don't, depending on Prisma's exact SQL). If the migration leaves existing rows null, the iOS app will hit the force-pick modal (§2) on every legacy project until the server is patched.

**iOS does not write a backfill value.** If the field comes back null, the user picks; we then PATCH the server. iOS never invents a mode for an unmoded project on its own.

---

## 9. Open questions (recommendations included)

1. **Can mode be changed after creation?** Recommend **no**. Rationale: avoids orphaning camera-mode rows under an access-control discriminator (and vice versa). The server PUT route doesn't even handle `projectType` today (§1.1), so "no" is the path of least resistance. UX: the picker (§2) is one-shot; once set, the project metadata shows the mode read-only.
2. **What happens to a project with existing survey data if mode is later set to access control?** Moot if #1 is "no." If #1 becomes "yes" later, recommend blocking the change once any `CameraLocation` rows exist for the project (server-side validation).
3. **Is Access Method required, or can it be left blank pending later input?** Recommend **required at save time** in access-control mode — a "door survey" with no access method recorded is not useful, and the field is the only thing that distinguishes the row from a half-filled camera location. Voice interview should re-prompt until a match is found rather than letting the user skip.
4. **Should the access methods list be filterable / searchable in the picker?** Recommend **yes**, mirroring the Windows picker's search-by-name + grouping behavior. Today the list is short (~9 entries) but the BOM table strongly implies it will grow.
5. **Photo split — 5 Live + 5 Library, or 5 total?** The brief says 5+5; the existing camera sheet does 5 total. Recommend **matching the existing camera pattern (5 total)** for v1 unless the team explicitly wants to diverge; if 5+5 is intentional, decide whether camera mode should also change so the two sheets stay isomorphic. **Awaiting decision before AddAccessPointSheet is built.**
6. **Where does the Access Method picker get its data from when offline?** Recommend caching the list in `UserDefaults` (or a small disk cache) after the first successful fetch, so a survey can be completed without connectivity. Refresh on next online opportunity.
7. **Does the project list view need a mode badge?** Recommend a small chip next to each project name showing "Camera" or "Access Control" so users browsing the list can tell at a glance, especially after mixed-mode portfolios become common.

---

## 10. Out of scope

- **Backend / Windows-side changes.** The schema, the `projectType` enum, the `AccessMethod` table, and the `/api/survey/locations` shape are already shipped. Two server gaps are flagged in §1.1 and §8 (PUT route doesn't accept `projectType`; `/api/survey/[projectId]` doesn't return `projectType` or `accessMethod`) — these are server tasks, not iOS tasks, but iOS work cannot complete without them.
- **Report layouts.** Identifying the structural difference is the server team's job; iOS does no report generation.
- **Create-project flow on iOS.** Not in scope; projects are server-created.
- **AccessMethod admin (create / edit / delete).** Admin-only Windows UI exists; iOS is read-only.
- **BOM / costing on iOS.** The Windows `AccessMethodItem` table is for costing; iOS doesn't surface costs.
- **Anything not directly required for adding the second mode.**

---

## 11. Test plan

Six scenarios, each manual + one regression sweep:

1. **Legacy project, no mode.** Open a project where the server returns `projectType: null` (or omits the field). Verify the force-pick modal blocks navigation, both options PATCH successfully, and the survey board renders the correct button afterward.
2. **Camera-mode project (regression).** Open an existing camera-mode project; verify the survey board is byte-for-byte unchanged: "Add Location" button, AddLocationSheet, camera voice script, photos, save.
3. **Access-control-mode project.** Open an access-control project; verify "Add Access Point" appears (not "Add Location"), AddAccessPointSheet opens with the four fields + photo section, Access Method picker loads `[AccessMethod]` from the server, save persists with a populated `accessMethodId`.
4. **Mode lock.** Confirm that an access-control project's survey board never shows "Add Location" and a camera project's never shows "Add Access Point." Confirm there is no UI surface to change `projectType` after creation.
5. **Voice interview branching.** Run the voice interview on each mode. Camera mode asks area → floor → notes (unchanged). Access mode asks area → floor → access method → notes, recognizes a spoken access-method match, and re-prompts on ambiguity.
6. **Mixed list & report sanity.** With one camera project and one access project, browse the project list, verify per-project mode display (chip if implemented), and trigger server-side report generation for each to confirm the right template is produced.

Plus: unit tests for `ProjectMode` Codable round-trip (`"VIDEO_SURVEILLANCE"` ↔ enum case), the same for `AccessMethod`, and a snapshot test of AddAccessPointSheet at minimum and maximum content states.
