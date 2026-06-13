# Development History

A milestone-level history of the CSMS (CCTV / Security Management System) application.
For the full commit-by-commit record, see `git log`.

## 2026-06-12 — Access Control estimating & list usability

- **Access Control survey and estimating workflow**: projects are now typed
  (Video Surveillance or Access Control). AC projects get their own survey board
  recording access points (door name, floor, notes, photos, access method) with
  full voice parity, including setting the access method by voice.
- **Artifact catalog**: new "Artifacts" page (below Cameras in the menu) managing
  access-control equipment models (type, manufacturer, model, variant, cost,
  image). Access methods (door templates with default bills of materials) are
  managed under Settings → Access Methods.
- **BOM costing**: the cost page expands surveyed access points into BOM rows
  keyed per (access method, artifact type) so e.g. Internal vs External Single
  Door equipment prices independently, grouped under per-method header rows.
  The estimator picks a catalog model per row; committed rows are plain project
  costs so proposals work unchanged. Zero-cost rows can be removed (persisted)
  and restored.
- **List usability sweep**: contextual search plus pagination added to the
  Artifacts (10/page), Cameras (10/page), Customers (10/page), Sites (8/page,
  with buildings rolled up into a per-site listbox), Projects (8/page), and
  Proposals (8/page) pages. Searches match related fields (customer, building,
  site, status, etc.). The Reports page's site-survey dropdown became a
  searchable picker.

## 2026-06-11 — Proposal audit & narrative survey

- Proposal calculation audit and cleanup; figures the AI sees always agree with
  the cost schedule table.
- Survey interview reworked to a more narrative style.

## 2026-06-09/10 — Hierarchy rework & proposal/cost sync

- Implemented the hierarchical workflow: sites → buildings → projects → survey;
  survey records moved from building-level to project-level.
- Building management UI added; settings menu split into focused pages.
- Proposal detail synchronized with cost schedule data (camera items, line item
  spreadsheet calculations, building name on proposals).
- iOS CI workflow (path-filtered) and Xcode Cloud build fixes; photo upload 413
  fix.

## 2026-06-07/08 — Proposal generation

- Project proposal preparation feature deployed: AI-generated proposal sections
  (cover letter, executive summary, scope, timeline, terms) with preview,
  signatory and appendix pages, centered company logo, and DOCX/PDF export.
- Project → building assignment; company profile logo upload via Vercel Blob.
- Site/project relationship fixes and database pruning.

## 2026-06-04/06 — Estimating foundations

- Dynamic Line Item Category management (DB-driven categories + settings UI).
- Voice TTS improvements: mute toggle, acknowledgement shorthand, value prompts.
- Consistent $X,XXX.XX currency formatting across all pages.
- Live camera capture and Save button on location detail.
- Prisma pinned at 6.19.3 (7.x has no MySQL adapter).

## 2026-06-01/03 — Camera catalog & iOS hardening

- Camera catalog enhancements: comment field, image upload, save confirmation,
  dropdown fixes, Decimal/optional field corrections.
- Login screen redesign (centered minimal ring logo); dark color scheme
  app-wide.
- iOS app: Xcode Cloud pre-build scripting, Codable/JSON robustness fixes,
  camera assignment.

## 2026-05-26/31 — Voice survey & core features

- Voice-activated building location survey form with quick-reference popup and
  voice response tuning.
- Anthropic-powered survey agent for conversational survey interaction.
- Image storage wired to Vercel Blob; secured image handling; photo lightbox.
- User management UI; site listbox on the project page; nav bar collapse and
  log-off button.

## 2026-05-25 — Project start

- Initial commit: Next.js (App Router) + Prisma/MySQL CSMS application with
  customers, sites, projects, camera inventory, and cost estimating skeleton.
