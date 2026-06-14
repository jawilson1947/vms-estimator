# Explicit Survey Navigation Re-architecture — Plan

> **OBSOLETE (decided 2026-06-14).** A project has exactly **one** survey, and
> "survey" is an *abstract* term for that project's set of `CameraLocation`
> records — it is **not** a database entity. There will be no `Survey` model, no
> `survey_id` migration, and no `SurveyListView`. The current **4-level**
> navigation stands: **Site → Building → Project → SurveyBoard**, with the board
> fetching at the project level via `GET /api/survey/[projectId]`. The §0 backend
> work and the 5th-level target architecture below are **dropped** and retained
> only for historical context. `projectType` stays on `Project` (one project =
> one survey of one type). `SurveyBoardView` mounting + `fetchProject` firing on
> the third tap is **correct behavior**, not the eager-load bug.
>
> The data-retrieval fix that followed this decision lives in
> `app/api/survey/[projectId]/route.ts` (response re-shaped to match the iOS
> Codable models).

---

Status: ~~planning only — no code changes yet~~ **superseded — see banner above.** Contains one hard blocker (§0) that has to be resolved on the Windows side before the full target architecture can land.

User's directive, verbatim:

> When site is tapped, display all the buildings for the site or indicate that there are none. If a building is selected, display all the projects for the building or indicate that there are none. If a project is selected, display all the surveys for it or indicate that there are none.

~~The user has since clarified that "surveys" is **literally plural** — a project owns multiple Survey records, locations/access-points live under a Survey, not directly under a Project.~~ **Reversed:** the user has since clarified that a project has exactly one survey, used as an abstract label for its location records. The "literally plural" interpretation below is no longer operative.

---

## §0 — Backend reality check (blocker)

I read the canonical schema at `vms-estimator/prisma/schema.prisma` end-to-end and walked the `app/api/survey/**` route handlers. **There is no `Survey` model on the Windows side today.** The current shape is:

- `Site` → `Building[]` (schema.prisma lines 106–132)
- `Building` → `Project[]` (line 129)
- `Project` → `CameraLocation[]` (line 85). `Project` carries `projectType` (`VIDEO_SURVEILLANCE` / `ACCESS_CONTROL`) at line 72.
- `CameraLocation` has `projectId` as a direct FK (line 156). The recent migration `20260609_survey_to_project` is misleadingly named — it just relinked `camera_locations` from `building_id` to `project_id`; it did **not** introduce a `Survey` entity.

API surface today:

- `GET /api/survey/sites-list` (`app/api/survey/sites-list/route.ts`) — returns `Site → Building → Project (id+name only)` tree. No survey concept.
- `GET /api/survey/[projectId]` (`app/api/survey/[projectId]/route.ts`) — returns the project with `cameraLocations` flattened into a `locations` array. The iOS `SurveyProject` model decodes this 1:1.
- No `GET /api/survey/projects/{id}/surveys` route exists. No file under `app/api/survey/` references a Survey entity.

**Conclusion.** The user's "a project has multiple surveys" model is **ahead of the database**. iOS cannot ship a `SurveyListView` that round-trips to the server because there is nothing on the server to list.

**This is a backend dependency, not an iOS task.** Before iOS can implement the four-level navigation, the Windows side must, at minimum:

1. Add a `Survey` model to `schema.prisma` with FK to `Project` and decide what it owns (locations? Access points? both? A survey "type"?).
2. Decide where `projectType` lives — keep it on `Project` (a project is "a camera-mode project" and all its surveys are camera surveys) or move it to `Survey` (a single project can have a mix of camera-survey and access-control-survey rows under it). This is the open question raised in §6.
3. Migrate `camera_locations` either to point at `survey_id` directly, or keep `project_id` and add a `survey_id` discriminator. The iOS write path (`POST /api/survey/locations`, `PATCH /api/survey/locations/{id}`) needs to be re-scoped accordingly.
4. Expose `GET /api/survey/projects/{id}/surveys` (or extend `sites-list` to embed the survey tree).
5. Possibly split `GET /api/survey/[projectId]` — what's currently "load the project's locations" becomes "load a survey's locations" at `GET /api/survey/surveys/{id}`.

Until items 1–5 land, the iOS work that **can** proceed is:

- The §1 fix (eager-fetch defect, if any).
- The empty-state additions at the site→building→project levels (§3, §4).
- Code-level prep that doesn't bake in a fake `Survey` shape — i.e., leave the project→locations transition as-is, but tag it with a `// TODO(survey)` marker.

The iOS team should **not** fabricate a `Survey` model on the client. If we invent one now and the server lands a different shape later, we'll round-trip it twice.

---

## §1 — Findings: what fires on site tap

The user reports that the app "is still trying to load survey data when the site is tapped" — they see the "Could not load survey" failure (`SurveyBoardView.swift:31`) after a single site tap. A prior diagnostic concluded the opposite ("SurveyBoardView only mounts after three nav steps"). I re-checked every plausible side-effect path the user listed, against the actual files.

**Result: I could not find a code path from a site tap to `fetchProject(_:)`.** Every potential leak the user named comes back clean. Specifics, with citations:

1. **`BuildingListView` side effects** (`Views/Survey/BuildingListView.swift`, full file 1–79). No `.task`, no `.task(id:)`, no `.onAppear`, no `.onChange`, no `.refreshable`. No `init()` body. No `@StateObject`. No `@EnvironmentObject`. The view is a pure render over `site.buildings`. Nothing in it can fire a network call.
2. **`ProjectListView` side effects** (`Views/Survey/ProjectListView.swift`, full file 1–75). Same shape — pure render over `building.projects`, no lifecycle modifiers, no view-model. `ProjectListViewModel.swift` is a 3-line tombstone comment confirming the VM was deliberately deleted.
3. **Eager pre-fetching of `SurveyBoardViewModel`.** `grep -n 'SurveyBoardViewModel(' ./CSMSSurvey` returns exactly one hit: `SurveyBoardView.swift:13` inside `SurveyBoardView.init`. No parent view, environment, or shared singleton constructs it. `SurveyBoardViewModel.load()` (`ViewModels/SurveyBoardViewModel.swift:42–51`) is the only call site for `api.fetchProject(_:)` in the entire app (`grep -n 'fetchProject' ./CSMSSurvey` → one hit).
4. **`NavigationStack` programmatic destinations / path seeding.** `grep -n 'SceneStorage\|AppStorage\|NavigationPath' ./CSMSSurvey` → zero hits. The `NavigationStack` in `SiteListView.swift:16` is unparameterized; no path binding, no restoration.
5. **Single-row auto-traverse.** No view in the chain auto-pushes when its list contains one row. The `NavigationLink(value:)` form is used at all three levels (`SiteListView:52`, `BuildingListView:22`, `ProjectListView:22`) — destination closures only run on tap.
6. **`SurveyBoardView` mounted by a parent.** `grep -n 'SurveyBoardView(' ./CSMSSurvey` → one hit: `ProjectListView.swift:38`, inside `.navigationDestination(for: ProjectSummary.self)`. With the `value:` form of `NavigationLink`, the destination closure is evaluated lazily on tap; SwiftUI does not pre-instantiate it.

**So what's the user actually seeing?** Three live hypotheses, in order of likelihood:

- **(A) Collapsed taps.** The user taps site → (sees `BuildingListView`) → taps a single visible building → (sees `ProjectListView`) → taps a single visible project → (`SurveyBoardView` mounts, `.task` fires `fetchProject`, server errors). If each intermediate level has exactly one row, the perceived experience is "I tapped a site and it tried to load a survey." This is consistent with the data: the sample customer almost certainly has 1 building and 1 project per site during demo/testing.
- **(B) Empty levels silently passed through.** If the user lands on `BuildingListView` with zero buildings, today they see the `ContentUnavailableView` (lines 12–17) — but if the user taps that back-arrow and tries another site quickly, the failure state from a prior `SurveyBoardView` could still be on-screen via the nav stack. Less likely but worth ruling out manually.
- **(C) The previous diagnostic stands.** Under the user's mental model where "surveys" live below "projects," the user expects `SurveyBoardView` not to mount until after a fourth tap. Today it mounts after the third, which from the user's perspective is "too eager." This isn't a leak — it's the absence of a level. Fixing it requires §0 to land first.

**My recommendation** is to treat the bug report as a symptom of hypothesis (A) + (C). The fix is *not* "stop `BuildingListView` from fetching" — it doesn't fetch. The fix is "stop `SurveyBoardView` from mounting on the third tap by inserting `SurveyListView` between project and board, once the backend supports it." Until then, the §3 work is mostly clarification of empty states and disclaiming the side-effect surface so future regressions can be caught.

---

## §2 — Current navigation vs. target navigation

Current:

| Level | View | Shows | Fetches | On tap |
|---|---|---|---|---|
| 1 | `SiteListView` | `vm.sites` (loaded once via `.task` line 90) | `fetchSitesList()` returns full site→building→project tree | Pushes `BuildingListView(site:)` |
| 2 | `BuildingListView` | `site.buildings` (already in memory) | none | Pushes `ProjectListView(building:)` |
| 3 | `ProjectListView` | `building.projects` (already in memory) | none | Pushes `SurveyBoardView(projectId:)` |
| 4 | `SurveyBoardView` | locations under the project | `fetchProject(_:)` via `.task` (line 154) | Opens `LocationDetailView` per row |

Target:

| Level | View | Shows | Fetches | On tap |
|---|---|---|---|---|
| 1 | `SiteListView` | sites | `fetchSitesList()` returns full site→building→project tree (extended with surveys per §0) | Pushes `BuildingListView(site:)`, no fetch |
| 2 | `BuildingListView` | buildings for site, or empty-state "No buildings for this site" | none | Pushes `ProjectListView(building:)`, no fetch |
| 3 | `ProjectListView` | projects for building, or empty-state "No projects for this building" | none | Pushes **new** `SurveyListView(project:)`, no fetch |
| 4 | `SurveyListView` *(new)* | surveys for project, or empty-state "No surveys for this project" | none if the tree is pre-loaded; otherwise `fetchSurveys(projectId:)` once on `.task` | Pushes `SurveyBoardView(surveyId:)`, no fetch |
| 5 | `SurveyBoardView` | locations/access-points under the survey, or empty-state "No locations recorded yet" | `fetchSurvey(_:)` via `.task` — **the only network call in the chain** | Opens `LocationDetailView` per row |

The key invariant: **the only place a survey/board fetch fires is the survey-board level**, after the user has explicitly drilled into a single survey. Every level above is render-only.

---

## §3 — Concrete change list

### Files to touch (post-§0)

- **`Views/Survey/SiteListView.swift`** — no change to the load on `.task`. No tap-level fetch (already correct).
- **`Views/Survey/BuildingListView.swift`** — already correct (pure render). Tighten the empty-state copy from "No buildings have been added to this site." to "No buildings for this site." per the user's wording. Add an explicit `// MARK: - No side effects` comment at the top to make a future audit grep-friendly.
- **`Views/Survey/ProjectListView.swift`** — already correct (pure render). Tighten empty-state to "No projects for this building." Update the `.navigationDestination(for: ProjectSummary.self)` closure to push **`SurveyListView(project:)`** (not `SurveyBoardView`).
- **`Views/Survey/SurveyListView.swift`** — **new file**. Pure render of `project.surveys` (whatever the backend ends up calling that array). Empty-state "No surveys for this project." Pushes `SurveyBoardView(surveyId:)` via `.navigationDestination(for: SurveySummary.self)`. **No fetch on tap.** If the sites-list endpoint is *not* extended to embed surveys, the screen does one `.task { await vm.load() }` for the project's surveys — but that load runs **after the user taps a project**, not on site tap.
- **`Views/Survey/SurveyBoardView.swift`** — change `init(projectId: Int)` to `init(surveyId: Int)`. Rename `SurveyBoardViewModel.projectId` → `surveyId`. Repoint `api.fetchProject(_:)` to `api.fetchSurvey(_:)` (new endpoint per §0). The error-state copy "Could not load survey" stays — it's now accurate at this level. Add empty-state branch: when `survey?.locations.isEmpty` and not loading, render `ContentUnavailableView` per §4. Today the view shows no empty state at all (lines 37–82 render the scroll view unconditionally once `vm.project != nil`).
- **`Models/Site.swift`** — extend `ProjectSummary` to embed `surveys: [SurveySummary]` (or leave it lean and let `SurveyListView` fetch). Add `SurveySummary` (and `SurveyDetail`) types, **shape pending §0**.
- **`Services/APIClient.swift`** — add `fetchSurveys(projectId:)` and `fetchSurvey(_:)`. Remove or repurpose `fetchProject(_:)` once the survey board no longer consumes it.
- **`ViewModels/SurveyBoardViewModel.swift`** — replaces `project: SurveyProject?` with `survey: SurveyDetail?`. Mutation helpers (`append`, `update`, `remove`) operate on `survey?.locations`.
- **New: `ViewModels/SurveyListViewModel.swift`** — only if the sites-list payload doesn't embed surveys. Holds `surveys: [SurveySummary]`, `isLoading`, `errorMsg`. `load()` calls `api.fetchSurveys(projectId:)`.

### Empty-state copy (per level)

- `BuildingListView`: "No buildings for this site."
- `ProjectListView`: "No projects for this building."
- `SurveyListView`: "No surveys for this project."
- `SurveyBoardView` (when survey loads but has no locations): "No locations recorded yet." or, for access-control mode, "No access points recorded yet." (Branch on `survey.effectiveProjectType` once §6.1 is resolved.)

### Code-level fixes for the §1 leak

There is no leak to fix. The recommended hardening:

- Add a SwiftUI preview to each pure-render level (`BuildingListView`, `ProjectListView`, `SurveyListView`) that supplies an empty `buildings`/`projects`/`surveys` array, to keep the empty-state path under continuous visual review.
- Add an XCTest assertion (or a runtime `assertionFailure` guard in `#if DEBUG`) at the top of `BuildingListView.body` and `ProjectListView.body` that `APIClient.shared` has not been touched since the parent appeared. This catches future regressions in the "no fetch at this level" invariant. (Optional; can be deferred.)

---

## §4 — Empty-state design

The existing `ContentUnavailableView` pattern in `SiteListView.swift:41–47` is the right template. Use it verbatim at every empty level:

```
ContentUnavailableView {
    Label(<headline>, systemImage: <icon>)
} description: {
    Text(<sub-copy>).foregroundStyle(Theme.textSecondary)
}
```

Icons per level:

| Level | systemImage | Headline | Description |
|---|---|---|---|
| Buildings | `building` | "No Buildings" | "No buildings for this site." |
| Projects | `folder` | "No Projects" | "No projects for this building." |
| Surveys | `clipboard` | "No Surveys" | "No surveys for this project." |
| Locations | `mappin.slash` | "No Locations Yet" | "Tap the + button to add the first one." |

For the survey-board "no locations" state, add a `tealButtonStyle()` "Add Location" / "Add Access Point" affordance inline (the FAB is already on screen, but a centered call-to-action is more discoverable on an empty board). Use the same branching that `addButtonLabel` does today (`SurveyBoardView.swift:161–166`).

Today's `SurveyBoardView` has **no empty-state branch at all** — once `vm.project != nil`, the scroll view renders even if locations is empty (lines 38–82). This is a visible defect on a brand-new survey. Fix it as part of §3.

---

## §5 — Side-effect audit checklist

Each item is a Pass/Fail check the implementation must clear. The implementation PR description should paste this list with each item marked.

1. `BuildingListView` declares no `@StateObject`, `@ObservedObject`, `@EnvironmentObject` that performs I/O on init. **Pass today.**
2. `BuildingListView` has no `.task`, `.task(id:)`, `.onAppear`, `.onChange`, `.refreshable`, `.onReceive`. **Pass today.**
3. `BuildingListView.init()` has no body (synthesized only). **Pass today.**
4. Same three checks for `ProjectListView`. **Pass today.**
5. Same three checks for the new `SurveyListView` — **except** a single `.task { await vm.load() }` is allowed *if and only if* the sites-list payload doesn't embed surveys. The `.task` runs on `SurveyListView` appear, i.e., after the project tap, **not before**.
6. `SurveyBoardView` declares its `.task { await vm.load() }` exactly once and only on the board view itself. No parent view holds a `SurveyBoardViewModel`.
7. `grep -n 'SurveyBoardViewModel(' ./CSMSSurvey` returns exactly one hit, inside `SurveyBoardView.init`.
8. `grep -n 'fetchSurvey\|fetchProject' ./CSMSSurvey/ViewModels` returns hits only inside `SurveyBoardViewModel`.
9. No `NavigationPath`, `SceneStorage`, or `AppStorage` keys are introduced. We're not restoring deep-link state.
10. `NavigationLink(value:)` is used at every list level (not `NavigationLink(destination:)`), so SwiftUI evaluates the destination closure lazily on tap.

---

## §6 — Open questions

1. **Does `projectType` live on `Project` or on `Survey`?** (Surfaced for the user; do not guess.)
   - If on Project (status quo): all surveys under an access-control project are access-control surveys. The `effectiveProjectType` lookup in `SurveyBoardView.swift:131` and `.swift:162` flows up from `survey.project.projectType`.
   - If moved to Survey: a single project can host a mix of camera surveys and access-control surveys, and the FAB label / Add-sheet branch reads from `survey.projectType`. The access-control-mode-plan.md assumption that mode is project-level becomes invalid.
   - **Recommended default: keep `projectType` on `Project`.** It mirrors the current iOS code with minimum churn, and "one project, one mode" matches how Windows-side reporting currently slices the data (per `docs/access-control-mode-plan.md` §1.1).
2. **Does `Survey` own `CameraLocation` directly, or via a join?** Recommended default: direct FK (`camera_locations.survey_id`), `Project.cameraLocations` removed in favor of `Project.surveys[].locations`. Cleaner, but it's a breaking schema change.
3. **What identifies a Survey to a user?** A name? A date? A surveyor? Need at least one human-readable field on `SurveySummary` for `SurveyListView` to render rows. Recommended default: `surveyName` (required) + `createdAt` (display only).
4. **Does `sites-list` embed the survey tree, or does `SurveyListView` fetch per project?** Recommended default: embed in `sites-list` for consistency with how buildings and projects are embedded today (one round-trip, no per-level fetch). The payload is small (id + name + date per survey).
5. **What does "no surveys for this project" mean operationally?** Is it a real state (project exists, surveys not yet started) or an error? Recommended default: real state. Add an in-screen "Create Survey" affordance if and only if the iOS side gains write access to Survey rows — out of scope for the first cut.

---

## §7 — Out of scope

- Server-side schema or endpoint changes. Tracked as a backend dependency in §0; iOS does not author them.
- Access-control mode behavior changes. The existing access-control work (`docs/access-control-mode-plan.md`) is treated as orthogonal — this plan inherits whatever decisions that plan made, with the caveat in §6.1.
- Audio-session / voice-command fixes. Voice command registration in `SurveyBoardView.swift:168–177` stays as-is.
- Server-side report generation, PDF exports, or any output.
- Performance optimization. We are not lazy-loading buildings, projects, or surveys until product asks for it. Today's "one fat sites-list response" is fine for the data volumes in use.
- Authentication / session restoration. The `auth.checkSession()` flow in `CSMSSurveyApp.swift:21` is untouched.
- Voice "add location" command behavior; that's a separate side effect that fires `showAddSheet`, which is in scope only for `SurveyBoardView`.

---

## §8 — Test plan

Walk-through tests, run by hand on a TestFlight build once §0 lands. The "N / M / K / L" parameters cover the empty-state / single-row / many-row matrix.

1. **Site tap with N buildings.**
   - N = 0: tap site → `BuildingListView` shows "No buildings for this site." No network call fires (verify with Charles / Instruments / Xcode Network Conditioner). Back button returns to `SiteListView`.
   - N = 1: tap site → see one building row. **Do not auto-traverse.** Confirm a separate tap is required.
   - N = many: tap site → scroll list renders, all rows present.
2. **Building tap with M projects.**
   - M = 0: `ProjectListView` shows "No projects for this building." No network call.
   - M = 1: one row, no auto-traverse.
   - M = many: scroll list renders.
3. **Project tap with K surveys.**
   - K = 0: `SurveyListView` shows "No surveys for this project." If `sites-list` embeds surveys, no network call fires. If `SurveyListView` self-loads, exactly one call to `fetchSurveys(projectId:)` and no call to `fetchSurvey(_:)`.
   - K = 1: one row, no auto-traverse.
   - K = many: scroll list renders.
4. **Survey tap with L locations.**
   - L = 0: `SurveyBoardView` shows "No locations recorded yet." with the inline Add CTA. Exactly one call to `fetchSurvey(_:)` fires.
   - L = many: progress header + location rows render.
5. **Network failure on survey tap.** Turn off Wi-Fi, tap into a survey. Confirm "Could not load survey" appears **only** at the survey-board level, not at site, building, project, or survey-list. Retry button refires `fetchSurvey(_:)`.
6. **Back-stack hygiene.** Drill down all five levels, back out to root, drill in again. Confirm no stale board content, no duplicate fetches at intermediate levels.
7. **Side-effect grep checks** (CI-friendly):
   - `grep -rn 'fetchSurvey\|fetchProject' ./CSMSSurvey/Views` → only inside `SurveyBoardView.swift` and possibly `SurveyListView.swift`. **Nothing in `BuildingListView` or `ProjectListView`.**
   - `grep -rn 'api\.\|APIClient\.shared' ./CSMSSurvey/Views/Survey/{Building,Project}ListView.swift` → zero hits.

---

**File path of this plan:** `vms-estimator/ios/docs/explicit-survey-nav-plan.md`.
