# QuoteXtract — LLM Context & Agentic Guide

Welcome to the QuoteXtract codebase! This file is the single source of truth for AI assistants and new contributors to understand the complete architecture, data flow, and critical rules of this project without having to scan directories blindly.

---

## 1. Project Purpose

QuoteXtract is a dual-pipeline system for managing and orchestrating B2B logistical Quotations.

1. **Inbound Pipeline** — Listens to an IMAP inbox or accepts manual PDF uploads. PDF text is extracted using `poppler-utils (pdftotext)` with `pdf-parse` as a JS fallback. A **fully offline, zero-AI regex/heuristic parser** then structures the extracted text into supplier name, quotation number, currency, line items, etc. and saves the record to PostgreSQL.

2. **Outbound Pipeline** — Allows users to craft standard outbound quotes using a custom HTML-to-PDF engine in the browser. It overrides native browser printing via `@media print` CSS to produce pixel-perfect PDFs, then saves the metadata to the database.

> ⚠️ **No AI / LLM anywhere in this codebase.** No OpenAI, no Anthropic, no local model runners. All PDF parsing is regex/heuristic in `artifacts/api-server/src/lib/pdf-extractor.ts`. The mail compose dialog has no AI Enhance button. The assistant route has been deleted.

---

## 2. Global Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, **Wouter** (routing), Tailwind CSS 4, shadcn/ui |
| Backend | Node.js, Express 5, TypeScript |
| Validation | Zod (shared via `@workspace/api-zod`) |
| Database | PostgreSQL 16, **Drizzle ORM** (`@workspace/db`) |
| PDF Text Extraction | `pdftotext` (poppler-utils) + `pdf-parse` (JS fallback) |
| PDF Parsing / Structuring | **Regex + heuristics** (`pdf-extractor.ts`) — no AI |
| Email | ImapFlow (IMAP polling), Nodemailer (SMTP sending) |
| API Client | Generated React Query v5 hooks (`@workspace/api-client-react`) |

---

## 3. System Architecture & Data Flow

```mermaid
graph TD
    subgraph "Client (React Dashboard)"
        UI[Pages & Components]
        PDFEng[HTML-to-PDF\nCSS Print Engine]
        RQ[React Query v5 Hooks]
    end

    subgraph "Backend (Express API :8080)"
        API[REST Routes\n/api/*]
        IMAP[IMAP Poller\nImapFlow]
        SMTP[SMTP Mailer\nNodemailer]
        subgraph "PDF Pipeline (100% offline)"
            PDFTEXT[pdftotext\npoppler-utils]
            PDFPARSE[pdf-parse\nJS fallback]
            REGEX[Regex Heuristic Parser\npdf-extractor.ts]
        end
    end

    subgraph "Infrastructure"
        DB[(PostgreSQL 16\nDrizzle ORM)]
        FS[/tmp/quotation-pdfs\nLocal PDF Storage]
    end

    UI <-->|REST fetch| RQ
    RQ <-->|HTTP| API
    IMAP -->|PDF attachments| FS
    UI -->|Upload PDF| FS
    FS --> PDFTEXT --> REGEX
    FS --> PDFPARSE --> REGEX
    REGEX -->|ExtractedQuotation| API
    API -->|Drizzle insert/update| DB
    DB -->|Query results| API
    UI -->|window.print()| PDFEng
    PDFEng -->|POST /api/quotations| API
    SMTP <-->|Send emails| API
```

### Inbound Flow (step by step)

```
Email arrives in IMAP inbox
  → ImapFlow downloads PDF attachment → saves to /tmp/quotation-pdfs/<key>.pdf
  → POST /api/mail/:id/track
  → pdftotext extracts layout-aware text
      (fallback: pdf-parse if pdftotext unavailable)
  → regex parser extracts: supplierName, quotationNumber, date, currency,
      paymentTerms, deliveryTerms, totalAmount, line items[]
  → INSERT into quotationsTable + quotationItemsTable
  → email.status updated to "extracted"
```

### Outbound Flow (step by step)

```
User fills "New Quotation" form in the dashboard
  → window.print() → browser renders HTML with @media print styles
  → POST /api/quotations { direction: "outbound", ...metadata }
  → INSERT into quotationsTable
  → POST /api/quotations/:id/items (loop per line item)
  → INSERT into quotationItemsTable
  → Redirect to /quotations/:id
```

---

## 4. Workspaces & Directory Structure

```
QuoteXtract/
├── artifacts/
│   ├── api-server/          ← Express backend (port 8080)
│   │   └── src/
│   │       ├── index.ts     ← Entry point
│   │       ├── routes/      ← All API routes (modular)
│   │       └── lib/
│   │           ├── pdf-extractor.ts   ← ★ Regex PDF parser (no AI)
│   │           ├── imap-poller.ts     ← IMAP polling daemon
│   │           └── smtp-mailer.ts     ← Nodemailer wrapper
│   └── quotation-dashboard/ ← React frontend (port 4000)
│       └── src/
│           ├── pages/       ← Route pages (inbox, quotations, mail, etc.)
│           └── components/  ← Shared UI components
├── lib/
│   ├── db/                  ← Drizzle schema & database client
│   │   └── src/schema/      ← Table definitions (emails, quotations, items, events)
│   ├── api-zod/             ← Zod validation schemas (shared server ↔ client)
│   └── api-client-react/    ← Generated React Query v5 hooks + fetch client
├── tsconfig.json            ← Root composite tsconfig
├── tsconfig.base.json       ← Shared compiler options (target: es2022, bundler resolution)
├── pnpm-workspace.yaml      ← Workspace definition + catalog
└── claude.md                ← ★ This file
```

---

## 5. Database Schema (Drizzle / PostgreSQL)

### `emails` table
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| senderName | text | |
| senderEmail | text | |
| subject | text | |
| receivedAt | text | ISO string |
| pdfFilename | text | |
| pdfStorageKey | text | filename in /tmp/quotation-pdfs |
| pdfSha256 | text | dedup hash |
| bodyText | text | |
| bodyHtml | text | |
| isRead | boolean | default false |
| messageId | text | IMAP Message-ID header |
| source | enum | upload / imap / webhook / sent |
| recipientEmail | text | for sent emails |
| status | enum | pending / processing / extracted / failed |
| createdAt / updatedAt | timestamp | |

### `quotations` table
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| emailId | integer | FK to emails |
| supplierName | text | |
| supplierEmail | text | |
| quotationNumber | text | |
| quotationDate | text | |
| currency | text | |
| paymentTerms | text | |
| deliveryTerms | text | |
| totalAmount | text | |
| **direction** | enum | **inbound** (received) / **outbound** (sent/generated) |
| status | enum | draft / reviewed / approved / rejected |
| extractionScore | integer | 0–100, confidence of regex parser |
| notes | text | |
| pdfStorageKey | text | |
| createdAt / updatedAt | timestamp | |

### `quotation_items` table
| Column | Type |
|---|---|
| id | serial PK |
| quotationId | integer FK |
| partNumber, description, quantity, unitPrice, totalPrice, leadTime, moq, currency, notes | text (nullable) |

### `quotation_events` table
Audit log of all changes (created, status_changed, updated, re_extracted, item_added, item_deleted).

### `settings` table
Key-value store for IMAP/SMTP credentials and aliases (encrypted at application level).

---

## 6. PDF Extraction Logic (`pdf-extractor.ts`)

The extractor is **completely offline** — no API calls, no AI.

### Steps
1. **Text extraction**
   - `pdftotext -layout` (poppler-utils) → preserves column positions, best for tables
   - `pdf-parse` (JS) → fallback for environments without poppler

2. **Field parsing (regex heuristics)**
   - `quotationNumber` — matches patterns like `QUO-2024-001`, `RFQ#12345`, `No: ABC-001`
   - `quotationDate` — ISO, DD/MM/YYYY, written month formats
   - `currency` — detects AED, USD, EUR, GBP, SAR and 10+ others
   - `supplierName` — first meaningful non-label line in the document header
   - `supplierEmail` — RFC 5322 email regex
   - `totalAmount` — scans for "Grand Total", "Total Amount", "Net Total" patterns
   - `paymentTerms` — "Payment Terms:", "Net 30", T/T, LC patterns
   - `deliveryTerms` — Incoterms (FOB, CIF, EXW…), "Lead Time" patterns

3. **Line item extraction**
   - Finds the header row containing keywords: qty, unit, price, part, description
   - Maps column character positions from the header
   - Extracts each subsequent row into structured `ExtractedItem` objects
   - Fallback: detects rows with `description … number … number … number` pattern

4. **Confidence scoring (0–100)**

| Field | Points |
|---|---|
| supplierName | 20 |
| quotationNumber | 20 |
| totalAmount | 15 |
| items > 0 | 15 |
| currency | 10 |
| quotationDate | 10 |
| supplierEmail | 5 |
| paymentTerms | 3 |
| deliveryTerms | 2 |

---

## 7. API Routes

| Method | Path | Description |
|---|---|---|
| GET | /api/healthz | Health check |
| GET | /api/emails | List all uploaded/fetched emails |
| POST | /api/emails | Create email record |
| GET | /api/emails/:id | Get single email |
| POST | /api/emails/upload-pdf | Upload PDF file (stores to /tmp) |
| POST | /api/extract | AI-free extraction: runs pdf-extractor on given storageKey |
| GET | /api/quotations | List quotations (filter: status, supplierId, search, emailId) |
| POST | /api/quotations | Create manual (outbound) quotation |
| GET | /api/quotations/:id | Get quotation with items |
| PATCH | /api/quotations/:id | Update quotation fields/status |
| DELETE | /api/quotations/:id | Delete quotation |
| POST | /api/quotations/:id/re-extract | Re-run pdf-extractor on existing quotation |
| GET | /api/quotations/search | Full-text search |
| GET/POST/PATCH/DELETE | /api/quotations/:id/items | CRUD for line items |
| GET | /api/mail | List IMAP/sent emails |
| GET | /api/mail/:id | Get full email detail |
| POST | /api/mail/:id/track | Extract PDF from IMAP email → create quotation |
| POST | /api/mail/:id/read | Mark email as read |
| POST | /api/mail/scan | Trigger immediate IMAP scan |
| GET | /api/analytics/summary | Dashboard stats |
| GET | /api/analytics/suppliers | Supplier breakdown |
| GET | /api/analytics/activity | Recent activity feed |
| GET/POST | /api/imap/status | IMAP poller status / configure |
| GET/POST | /api/smtp/status | SMTP status / configure / test |

---

## 8. Critical Development Rules

1. **No AI anywhere** — The extractor is regex-based. Do NOT add OpenAI, Anthropic, local model runners, or any AI API calls. If extraction quality needs improvement, improve the regex patterns in `pdf-extractor.ts`.

2. **Routing: Wouter only** — Use `import { useLocation } from "wouter"`. Do NOT use `react-router-dom`, `useNavigate`, or `<BrowserRouter>`.

3. **PDF Generation: CSS print only** — PDFs are generated via `window.print()` and `@media print` CSS. Do NOT add `@react-pdf/renderer`, `puppeteer`, or server-side PDF libs for the outbound pipeline.

4. **React Query v5 syntax** — Always use the object-based API: `useQuery({ queryKey: [...], queryFn: ... })`. Positional argument syntax (`useQuery(key, fn)`) from v4 is invalid and causes runtime errors.

5. **Drizzle enum typing** — Always add `as const` to enum arrays in schema definitions: `{ enum: ["a","b"] as const }`. Without it, drizzle infers `string` instead of the literal union.

6. **Ports** — Dashboard: `4000` → proxied to API at `8080`. Always use relative `/api/...` paths in the frontend.

7. **Database mutations** — Run `pnpm --filter @workspace/db push` after any schema change. The `direction` column (`inbound` | `outbound`) must exist in the DB before running.

8. **No duplicate exports** — `lib/api-zod/src/index.ts` must only export from `./generated/api`. Exporting from `./generated/types` too causes TS2308 ambiguity errors.

---

## 9. Environment Variables

| Variable | Used By | Description |
|---|---|---|
| DATABASE_URL | api-server, db | PostgreSQL connection string |
| IMAP_EMAIL | api-server | IMAP account email (env override) |
| IMAP_PASSWORD | api-server | IMAP password (env override) |
| IMAP_HOST | api-server | IMAP host, default imap.hostinger.com |
| IMAP_PORT | api-server | IMAP port, default 993 |
| IMAP_POLL_INTERVAL | api-server | Seconds between polls, default 60 |

> SMTP and IMAP credentials can also be stored in the `settings` DB table via the Settings page (preferred over env vars for runtime changes).

---

## 10. Build & Run

```bash
# Install all workspace dependencies
pnpm install

# Run API server (dev)
pnpm --filter @workspace/api-server dev

# Run dashboard (dev)
pnpm --filter @workspace/quotation-dashboard dev

# Type-check entire monorepo
pnpm --recursive exec tsc --noEmit

# Push DB schema changes
pnpm --filter @workspace/db push
```
