# Invoice Feature — Implementation Plan

**Goal:** Add a "Prepare Invoice" capability to the project page, directly below the existing "Prepare Proposal" button. An invoice is generated from the project's existing cost data (the same `buildCostSchedule()` figures the proposal uses), with two configurable choices: **level of detail** (full line items vs. summary) and **payment basis** (Direct Total vs. Consulting + PM fee). Invoices are tracked in the database with their own history, status, and auto-generated invoice numbers, and exported as Word + PDF in the Digital Support Systems invoice layout.

## Decisions locked (from clarifying questions, 2026-06-14)

1. **Persistence:** Full tracking — new `Invoice` Prisma model, an Invoice History panel, statuses, auto invoice numbers. Mirrors the proposal feature.
2. **"Remaining Consulting + PM fee":** Means simply `consultingFee + projectManagementFee` from the fee summary. No payment-ledger / net-of-prior-payments logic.
3. **Output:** Reproduce the DSS invoice layout from the sample (`COG_2220-0211-011.pdf`) — To / Ship To blocks, line-item table, Total Due, "make checks payable" footer — pulling branding from company settings. Generate **both** Word (.docx) and PDF.
4. **Invoice number:** Auto-derived from the project number plus a running per-project sequence (e.g. `2220-0211-011`).

---

## How this mirrors the existing proposal feature

The proposal feature is the template to copy. Reusing its structure keeps the codebase consistent and minimizes new patterns:

| Proposal artifact | Invoice equivalent to build |
|---|---|
| `components/ProjectProposalButton.tsx` | `components/ProjectInvoiceButton.tsx` |
| `components/ProposalModal.tsx` (4-step wizard) | `components/InvoiceModal.tsx` (simpler — no AI step) |
| `components/ProposalHistory.tsx` | `components/InvoiceHistory.tsx` |
| `Proposal` model in `prisma/schema.prisma` | `Invoice` model |
| `app/api/projects/[id]/proposals/route.ts` (GET list / POST create) | `app/api/projects/[id]/invoices/route.ts` |
| `.../proposals/[proposalId]/route.ts` (GET/PATCH/DELETE) | `.../invoices/[invoiceId]/route.ts` |
| `.../proposals/[proposalId]/docx/route.ts` | `.../invoices/[invoiceId]/docx/route.ts` |
| `.../proposals/[proposalId]/pdf/route.ts` | `.../invoices/[invoiceId]/pdf/route.ts` |
| `lib/generate-proposal-docx.ts` | `lib/generate-invoice-docx.ts` |
| `lib/generate-proposal-pdf.ts` | `lib/generate-invoice-pdf.ts` |
| `lib/cost-schedule.ts` (`buildCostSchedule`) | **Reused as-is** — single source of cost figures |

Key reuse: **all dollar figures come from `buildCostSchedule(cameraLocations, costs, feeSummary)`** in `lib/cost-schedule.ts`. The invoice never recomputes costs; it reads the same `CostScheduleData` (`groups[]`, `directTotal`, `consultingFee`, `projectManagementFee`, `grandTotal`, etc.) the proposal already trusts. This guarantees the invoice and proposal never disagree.

---

## The two required options (exact behavior)

### Option 1 — Level of detail

- **Line items:** the invoice table lists every `CostScheduleGroup` row — quantity, description, unit cost (with markup applied as the proposal does), and line total — exactly like the sample's QUANTITY / DESCRIPTION / UNIT PRICE / AMOUNT grid.
- **Summary:** the table collapses to a few roll-up rows (e.g. one line per category, or a single "Equipment, installation & integration" line) plus the fee lines. The underlying total is identical; only the granularity shown changes.

Implemented as a radio toggle in the modal (`detail: 'line-items' | 'summary'`), stored on the invoice record so the saved document and any re-download stay consistent.

### Option 2 — Payment basis (amount due)

- **Direct Total:** amount due = `costSchedule.directTotal` (sum of all line items before fees/overhead/contingency/tax).
- **Consulting + PM fee:** amount due = `costSchedule.consultingFee + costSchedule.projectManagementFee`.

Implemented as a radio toggle (`paymentBasis: 'direct-total' | 'consulting-pm'`). The chosen basis drives the **Total Due** figure printed on the invoice and stored as `amountDue`. The line-item table can still show full detail; the basis only controls which subtotal becomes the billed amount. A short caption under Total Due states which basis was used (e.g. "Direct equipment & labor total" or "Remaining consulting + project management fee").

---

## Data model

Add to `prisma/schema.prisma` (mirrors `Proposal`, lines 406–422):

```prisma
model Invoice {
  id            Int       @id @default(autoincrement()) @map("invoice_id")
  projectId     Int       @map("project_id")
  invoiceNumber String    @map("invoice_number") @db.VarChar(60)
  sequence      Int       // per-project running number, e.g. 11
  detail        String    @default("line-items") @db.VarChar(20)   // 'line-items' | 'summary'
  paymentBasis  String    @default("direct-total") @db.VarChar(30) // 'direct-total' | 'consulting-pm'
  amountDue     Decimal   @map("amount_due") @db.Decimal(12, 2)
  snapshot      Json      // frozen line items + fee figures at issue time
  billTo        Json?     @map("bill_to")   // name/address captured for the invoice
  shipTo        Json?     @map("ship_to")
  poNumber      String?   @map("po_number") @db.VarChar(60)
  terms         String?   @db.VarChar(60)   // e.g. "COD", "Net 30"
  status        String    @default("draft") @db.VarChar(50) // draft | sent | paid | void
  issuedAt      DateTime? @map("issued_at") @db.Date
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  project       Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@map("invoices")
}
```

Add the back-relation `invoices Invoice[]` to the `Project` model.

**Why a `snapshot` JSON column:** an invoice is a financial document — it must not silently change if someone later edits the project's costs or fee summary. At save time we freeze the computed `CostScheduleData` (and the billed `amountDue`) into `snapshot`, and the generators render from the snapshot, not from live project data. This follows the project's own stated caution that stored `feeSummary.directCostTotal` is only refreshed on save and should not be trusted for live documents.

**Migration:** create `prisma/migrations/<date>_add_invoice/`. Per project memory, the Prisma-Local MCP migrate tools are unusable here (they pull Prisma 7 against a v6 schema); use the project's own v6 scripts — `npm run db:migrate` then `npm run db:generate`.

### Invoice number generation

In the POST create route, derive the number from the project, then count existing invoices for that project to get the next sequence:

```
sequence = (count of invoices for project) + 1
invoiceNumber = `${projectNumber}-${String(sequence).padStart(3, '0')}`
```

So a project numbered `2220-0211` yields `2220-0211-001`, `-002`, … matching the sample's `2220-0211-011`. If `projectNumber` is blank, fall back to `INV-${projectId}-${seq}`. Wrap the count+create in a transaction to avoid duplicate sequences.

---

## API routes

All under `app/api/projects/[id]/invoices/`, copying the auth + param-unwrap pattern from the proposal routes (`getServerSession`, `await params`):

- **`route.ts`** — `GET` lists invoices for the project (id, invoiceNumber, amountDue, status, issuedAt, createdAt; exclude heavy `snapshot`). `POST` creates an invoice: accepts `{ detail, paymentBasis, billTo, shipTo, poNumber, terms, issuedAt }`, recomputes `buildCostSchedule()` server-side from the project's `costs` / `cameraLocations` / `feeSummary`, derives `amountDue` from `paymentBasis`, generates the invoice number, and stores the snapshot.
- **`[invoiceId]/route.ts`** — `GET` one (with snapshot), `PATCH` status (draft→sent→paid→void) and editable header fields, `DELETE`.
- **`[invoiceId]/docx/route.ts`** — `POST` returns the .docx blob via `generate-invoice-docx.ts`.
- **`[invoiceId]/pdf/route.ts`** — `POST` returns the PDF blob via `generate-invoice-pdf.ts`.

Server-side recompute on create (rather than trusting numbers sent from the browser) keeps the billed amount authoritative.

---

## UI

### Project page — `app/(dashboard)/projects/[id]/page.tsx`

`<ProjectProposalButton>` is rendered at line 114. Add `<ProjectInvoiceButton projectId={project.id} projectName={project.projectName} />` immediately after it so "Prepare Invoice" sits directly below "Prepare Proposal". Add `<InvoiceHistory projectId={project.id} projectName={project.projectName} />` near `<ProposalHistory>` (line 237).

### `components/ProjectInvoiceButton.tsx`

Copy `ProjectProposalButton.tsx` almost verbatim — a `btn-secondary` button (use a `DocumentCurrencyDollarIcon` / `ReceiptPercentIcon` from heroicons), label "Prepare Invoice", opens `InvoiceModal`, dispatches an `invoice-saved` event on save so the history panel refreshes.

### `components/InvoiceModal.tsx`

Simpler than `ProposalModal` — **no AI generate step**. Suggested two-step flow:

1. **Configure** — the two required radio groups (Level of detail; Payment basis), plus Bill To / Ship To (prefilled from `project.customer`), optional P.O. number, terms (default "COD" as in the sample), and issue date. Fetch project data from `GET /api/projects/[id]` exactly as `ProposalModal` does (lines 101–139) to get costs, cameraLocations, feeSummary, customer, and company settings, then compute a live `costSchedule` with `buildCostSchedule()` for the preview.
2. **Preview & Export** — render the invoice preview (reusing the DSS layout component), show the resolved Total Due for the chosen basis, then **Save**, **Download Word**, **Download PDF**, and optionally **Copy covering email**. Save posts to `POST /api/projects/[id]/invoices`; download buttons hit the docx/pdf routes. Reuse the `showSaveFilePicker` download helper from `ProposalModal` (lines 246–294).

### `components/InvoiceHistory.tsx`

Copy `ProposalHistory.tsx`: lists saved invoices with number, amount due, status badge, and date; lets the user re-download or change status. Listens for the `invoice-saved` event.

---

## Document generators

### `lib/generate-invoice-pdf.ts` and `lib/generate-invoice-docx.ts`

Model the DSS invoice from the sample (`COG_2220-0211-011.pdf`):

- **Header band:** company logo + name + tagline ("Developing eBusiness solutions since 1985"), address block, phone/fax — all from company settings (the same fields `ProposalModal` loads from `/api/user/settings`: `companyName`, `companyTagline`, `logoUrl`, `companyPhone`, `companyAddress`, `companyWebsite`). Top-right: **INVOICE**, DATE, and the document code (`COG-…`).
- **To / Ship To** two-column block from `billTo` / `shipTo`.
- **Meta strip:** SALESPERSON, P.O. NUMBER, INVOICE NO#, SHIPPED VIA, F.O.B. POINT, TERMS.
- **Line-item table:** QUANTITY · DESCRIPTION · UNIT PRICE · AMOUNT. In **line-items** mode, one row per snapshot group; in **summary** mode, collapsed rows.
- **Totals block:** Subtotal, Shipping & Handling, **Total Due** = `amountDue`, with the basis caption.
- **Footer:** "Make checks payable to: …" and the contact line, from settings.

For the docx generator, reuse the helper structure and page constants already in `generate-proposal-docx.ts` (`Document`, `Table`, `TableRow`, `Header`, `Footer`, DXA page constants). Since the chosen styling is the fixed DSS layout, the invoice generators need only a single template, not the five proposal templates — but they can borrow the same table/border helpers.

---

## Build order & verification

1. **Schema + migration** — add `Invoice` model and `Project.invoices` relation; run `npm run db:migrate` && `npm run db:generate`. Verify with `npm run db:studio` or `npx prisma validate`.
2. **API routes** — invoices `route.ts` + `[invoiceId]` routes; test create/list/number-sequencing with `curl` against `npm run dev`.
3. **Generators** — `generate-invoice-pdf.ts` and `generate-invoice-docx.ts`; spot-check output against the sample PDF for layout fidelity and that Total Due matches the selected basis.
4. **UI** — `ProjectInvoiceButton`, `InvoiceModal`, `InvoiceHistory`; wire into the project page below the proposal button.
5. **Verification pass (required):**
   - `npx tsc --noEmit 2>&1 | grep -E 'Invoice|invoice'` — confirm no new type errors (ignore the known pre-existing `.next/types`, `tsconfig.json`, `VoiceContext.tsx`, `useSpeak.ts` errors).
   - Manual: create a line-items invoice and a summary invoice on a real project; verify the invoice number increments per project; verify Direct-Total vs Consulting+PM produce the two expected amounts; verify the saved snapshot doesn't change after editing project costs; download and open both Word and PDF.
   - **Editing-safety note (project memory):** after appends/edits to the large modal/component files, strip null-byte corruption and re-check brace depth; never use `echo >>` / `cat >>` on paths containing parentheses (the `app/(dashboard)/…` path) — use `printf` with the quoted path or Python writes.

---

## Open items to confirm during build (non-blocking)

- **Salesperson / F.O.B. / Shipped Via** fields in the sample — likely come from company/user settings or are left blank/optional; confirm which should be editable in the modal vs. fixed from settings.
- **Summary mode granularity** — collapse to one line per category, or a single combined line? Default to per-category unless you prefer a single line.
- **Tax / Shipping** — the fee summary already carries `taxAmount`; decide whether tax shows on the invoice when the basis is Consulting + PM (likely not). Default: show tax only on Direct-Total invoices.
