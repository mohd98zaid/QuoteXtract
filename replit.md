# QuoteXtract — Quotation PDF Extraction Dashboard

## Overview

A full-stack application that converts supplier quotation PDFs into structured, searchable data. Users upload PDFs manually or receive them automatically from a Hostinger email account (IMAP). AI extracts all fields — the team then reviews, edits, approves, and searches quotations.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)
- **AI**: OpenAI GPT-4o via Replit AI Integrations (no API key needed)
- **PDF text extraction**: system `pdftotext` (Poppler — available at `/nix/store/.../bin/pdftotext`)
- **File upload**: multer (PDF storage in `/tmp/quotation-pdfs`)
- **Email**: imapflow + mailparser (IMAP polling), nodemailer

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Architecture

```
IMAP Poll (every 60s) → emails table (source=imap)
Manual Upload         → emails table (source=upload)
                         ↓
                   POST /api/extract  (pdftotext → GPT-4o → JSON)
                         ↓
                   quotations + quotation_items tables
                         ↓
              React dashboard (list, detail, search, analytics)
```

### DB Tables

- **emails** — email/PDF records with status (pending|processing|extracted|failed), source (imap|upload)
- **quotations** — extracted quotation headers (supplier, date, currency, payment terms, delivery terms, total amount, extraction score)
- **quotation_items** — line items per quotation (part number, description, qty, unit price, total, lead time, MOQ)
- **imap_credentials** — stored IMAP connection settings (host, port, user, pass)

### API Routes

- `GET/POST /api/emails` — list/create email records
- `GET /api/emails/:id` — get single email
- `POST /api/emails/upload-pdf` — upload PDF file (multipart/form-data)
- `GET /api/pdfs/:key` — serve stored PDF
- `POST /api/extract` — trigger AI extraction for a PDF
- `GET/PATCH/DELETE /api/quotations` + `/:id` — CRUD quotations
- `GET /api/quotations/:id/items` — list line items
- `PATCH/DELETE /api/items/:id` — update/delete individual items
- `GET /api/search` — search quotations and items
- `GET /api/analytics/summary` — dashboard KPIs
- `GET /api/analytics/by-supplier` — supplier breakdown
- `GET /api/analytics/recent-activity` — activity feed
- `GET/POST /api/imap/config` — configure IMAP credentials
- `GET /api/imap/status` — connection status
- `GET /api/mail` — list IMAP emails (source=imap)
- `GET /api/mail/:id` — get single IMAP email (marks as read)
- `POST /api/mail/:id/track` — AI extract PDF from IMAP email → create quotation
- `POST /api/mail/fetch` — manually trigger IMAP poll

## Frontend Pages

- `/` — Dashboard with KPIs, charts, activity feed
- `/mail` — 3-pane webmail UI (Hostinger IMAP inbox)
- `/inbox` (Upload) — manual PDF upload + IMAP configuration
- `/quotations` — filterable/searchable quotations list
- `/quotations/:id` — quotation detail with inline edit, status workflow, PDF viewer
- `/search` — global search across all quotations and items

## Known Quirks / Gotchas

- **Do NOT use `ScrollArea` from `@radix-ui/react-scroll-area`** — it crashes due to a duplicate React instance. Use plain `overflow-y-auto` divs instead.
- **Drizzle returns `Date` objects** for timestamp columns. Do NOT pass them to Zod schemas that expect strings. Use `res.json()` directly (it serializes dates automatically) or convert with `.toISOString()`.
- **IMAP poller** polls last 30 days, uses `messageId` for deduplication, does NOT mark emails as Seen.
- **Externalized packages** in build.mjs: `nodemailer`, `mailparser`, `imapflow`. Do NOT externalize `pdf-parse` (it's a CJS v2 with ESM-incompatible import — use `pdftotext` instead).
- **PDF extraction** uses `pdftotext -layout <file> -` via `child_process.execFile`, then sends extracted text to GPT-4o. Works for text-based PDFs; scanned PDFs return score 0.
- **AI model**: `gpt-4o` via Replit AI Integrations (`AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`).
- **Navigation**: "Mail" → `/mail`, "Upload" → `/inbox`
- **`FolderName` type**: `"Inbox" | "Starred" | "Sent" | "Drafts" | "Spam" | "Trash"` — only Inbox and Starred are functional (INBOX-only IMAP sync).

## Phases Completed

- **Phase 1** ✅ — Manual PDF upload → AI extraction → quotation detail with inline editing, status workflow (draft → reviewed → approved/rejected), global search, analytics dashboard
- **Phase 2** ✅ — Hostinger IMAP integration (polls last 30 days, messageId dedup), Mail page (3-pane webmail), Track PDF → AI extraction → quotation
