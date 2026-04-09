# QuoteXtract — Quotation PDF Extraction Dashboard

## Overview

A full-stack application that converts supplier quotation PDFs into structured, searchable data. Users upload PDFs (manually for MVP, with Hostinger email integration planned for Phase 2), and AI automatically extracts all fields — then the team can review, edit, approve, and search quotations.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI GPT-5.2 via Replit AI Integrations (no API key needed)
- **File upload**: multer (PDF storage in /tmp/quotation-pdfs)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Architecture

```
Email → PDF Upload → AI Extraction → DB → Dashboard
```

### DB Tables

- **emails** — email/PDF records with status (pending|processing|extracted|failed)
- **quotations** — extracted quotation headers (supplier, date, currency, payment terms, delivery terms, total amount, extraction score)
- **quotation_items** — line items per quotation (part number, description, qty, unit price, total, lead time, MOQ)

### API Routes

- `GET/POST /api/emails` — list/create email records
- `GET /api/emails/:id` — get single email
- `POST /api/emails/upload-pdf` — upload PDF file (multipart/form-data)
- `GET /api/pdfs/:key` — serve stored PDF
- `POST /api/extract` — trigger AI extraction for a PDF
- `GET/PATCH/DELETE /api/quotations` + `/:id` — CRUD quotations
- `GET /api/quotations/:id/items` — list line items
- `PATCH/DELETE /api/items/:id` — update/delete individual items
- `GET /api/search?q=...` — full-text search across quotations and items
- `GET /api/analytics/summary` — dashboard stats
- `GET /api/analytics/by-supplier` — grouped supplier stats
- `GET /api/analytics/recent-activity` — activity feed

## Frontend Pages

- `/` — Dashboard (summary cards, supplier chart, status breakdown, activity feed)
- `/inbox` — PDF upload (drag & drop) + processed emails table
- `/quotations` — filterable/searchable quotation list with status badges
- `/quotations/:id` — quotation detail with inline editing + line items table
- `/search` — search by part number, supplier, description

## Development Phases

- **Phase 1 (MVP)** ✅ — Manual PDF upload, AI extraction, dashboard, CRUD, search
- **Phase 2** — Hostinger inbound email integration (auto-ingest PDFs from email)
- **Phase 3** — OCR improvements for scanned/image PDFs
- **Phase 4** — Scaling, user auth, multi-tenant

## Artifacts

- `artifacts/api-server` — Express API server (port auto-assigned, path `/api`)
- `artifacts/quotation-dashboard` — React + Vite frontend (path `/`)
