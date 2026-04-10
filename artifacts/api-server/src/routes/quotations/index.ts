import { Router, type IRouter } from "express";
import { eq, ilike, or, lt, and, desc } from "drizzle-orm";
import { db, quotationsTable, quotationItemsTable, quotationEventsTable, emailsTable } from "@workspace/db";
import {
  GetQuotationParams,
  UpdateQuotationParams,
  UpdateQuotationBody,
  DeleteQuotationParams,
  ListQuotationsQueryParams,
  ListQuotationItemsParams,
  UpdateItemParams,
  UpdateItemBody,
  DeleteItemParams,
  SearchQuotationsQueryParams,
  CreateItemBody,
} from "@workspace/api-zod";
import { extractFromPdf } from "../../lib/pdf-extractor";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

const upload = multer({ storage: multer.memoryStorage() });

const router: IRouter = Router();

async function logEvent(
  quotationId: number,
  eventType: "created" | "status_changed" | "updated" | "re_extracted" | "item_added" | "item_deleted",
  oldValue?: string | null,
  newValue?: string | null,
  note?: string | null,
) {
  await db.insert(quotationEventsTable).values({ quotationId, eventType, oldValue, newValue, note });
}

// Create quotation manually
router.post("/quotations", async (req, res): Promise<void> => {
  const {
    supplierName = null,
    supplierEmail = null,
    quotationNumber = null,
    quotationDate = null,
    currency = null,
    paymentTerms = null,
    deliveryTerms = null,
    totalAmount = null,
    notes = null,
  } = req.body || {};

  const [quotation] = await db
    .insert(quotationsTable)
    .values({
      supplierName,
      supplierEmail,
      quotationNumber,
      quotationDate,
      currency,
      paymentTerms,
      deliveryTerms,
      totalAmount,
      notes,
      status: "draft",
      pdfStorageKey: null,
      emailId: null,
      extractionScore: null,
    })
    .returning();

  await logEvent(quotation.id, "created", null, "draft", `Manual creation: ${supplierName ?? "unnamed"}`);

  res.status(201).json(quotation);
});

// List quotations with optional filters and pagination
router.get("/quotations", async (req, res): Promise<void> => {
  const parsed = ListQuotationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const { status, search, emailId } = parsed.data;
  const pageParam = req.query.page ? parseInt(req.query.page as string, 10) : null;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;

  const needsReview = (req.query.needs_review as string) === "true";

  const buildWhere = () => {
    const conditions = [];

    if (status) {
      conditions.push(eq(quotationsTable.status, status as "draft" | "reviewed" | "approved" | "rejected"));
    }

    if (needsReview) {
      conditions.push(
        and(
          lt(quotationsTable.extractionScore, 70),
          eq(quotationsTable.status, "draft"),
        )!,
      );
    }

    if (search) {
      conditions.push(
        or(
          ilike(quotationsTable.supplierName, `%${search}%`),
          ilike(quotationsTable.quotationNumber, `%${search}%`),
        )!,
      );
    }

    if (emailId) {
      conditions.push(eq(quotationsTable.emailId, emailId));
    }

    return conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);
  };

  const whereClause = buildWhere();

  if (pageParam !== null) {
    const offset = (pageParam - 1) * limit;

    const [{ total }] = await db
      .select({ total: db.$count(quotationsTable) })
      .from(quotationsTable)
      .where(whereClause);

    let dataQuery = db.select().from(quotationsTable).$dynamic();
    if (whereClause) dataQuery = dataQuery.where(whereClause);
    dataQuery = dataQuery.orderBy(desc(quotationsTable.createdAt)).limit(limit).offset(offset);

    const data = await dataQuery;
    const totalNum = Number(total);

    res.json({
      data,
      total: totalNum,
      page: pageParam,
      limit,
      totalPages: Math.ceil(totalNum / limit),
    });
    return;
  }

  let query = db.select().from(quotationsTable).$dynamic();
  if (whereClause) query = query.where(whereClause);
  const quotations = await query.orderBy(desc(quotationsTable.createdAt));
  res.json(quotations);
});

// Export all top-level quotations to CSV — uses full path /quotations/export to avoid /:id conflict
router.get("/quotations/export", async (req, res): Promise<void> => {
  try {
    const quotations = await db.select().from(quotationsTable).orderBy(desc(quotationsTable.createdAt));

    const exportData = quotations.map(q => ({
      id: q.id,
      supplierName: q.supplierName || "",
      supplierEmail: q.supplierEmail || "",
      quotationNumber: q.quotationNumber || "",
      quotationDate: q.quotationDate || "",
      totalAmount: q.totalAmount || "",
      currency: q.currency || "",
      paymentTerms: q.paymentTerms || "",
      deliveryTerms: q.deliveryTerms || "",
      status: q.status || "draft",
      notes: q.notes || ""
    }));

    const csvData = stringify(exportData, { header: true });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="quotations_backup.csv"');
    res.send(csvData);
  } catch (err) {
    req.log.error({ err }, "Failed to export quotations to CSV");
    res.status(500).json({ error: "Export failed" });
  }
});

// Import top-level quotations from CSV — uses full path /quotations/import to avoid /:id conflict
router.post("/quotations/import", upload.single("file"), async (req, res): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const csvContent = req.file.buffer.toString("utf-8");
    const records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });

    if (records.length === 0) {
      res.status(400).json({ error: "CSV is empty or invalid" });
      return;
    }

    const valuesToInsert = records.map((record: any) => ({
      supplierName: record.supplierName || null,
      supplierEmail: record.supplierEmail || null,
      quotationNumber: record.quotationNumber || null,
      quotationDate: record.quotationDate || null,
      totalAmount: record.totalAmount || null,
      currency: record.currency || null,
      paymentTerms: record.paymentTerms || null,
      deliveryTerms: record.deliveryTerms || null,
      status: ["draft", "reviewed", "approved", "rejected"].includes(record.status) ? record.status : "draft",
      notes: record.notes || null,
    }));

    if (valuesToInsert.length > 0) {
      await db.insert(quotationsTable).values(valuesToInsert);
    }

    res.json({ success: true, importedCount: valuesToInsert.length });
  } catch (err: any) {
    req.log.error({ err }, "Failed to import quotations from CSV");
    res.status(500).json({ error: err.message || "Import failed" });
  }
});

// Get single quotation with items
router.get("/quotations/:id", async (req, res): Promise<void> => {
  const params = GetQuotationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const [quotation] = await db
    .select()
    .from(quotationsTable)
    .where(eq(quotationsTable.id, params.data.id));

  if (!quotation) {
    res.status(404).json({ error: "Quotation not found", code: "NOT_FOUND" });
    return;
  }

  const items = await db
    .select()
    .from(quotationItemsTable)
    .where(eq(quotationItemsTable.quotationId, quotation.id));

  res.json({ ...quotation, items });
});

// Get audit trail events for a quotation
router.get("/quotations/:id/events", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id", code: "VALIDATION_ERROR" });
    return;
  }

  const events = await db
    .select()
    .from(quotationEventsTable)
    .where(eq(quotationEventsTable.quotationId, id))
    .orderBy(desc(quotationEventsTable.createdAt));

  res.json(events);
});

// Re-extract quotation using AI
router.post("/quotations/:id/re-extract", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id", code: "VALIDATION_ERROR" });
    return;
  }

  const [quotation] = await db
    .select()
    .from(quotationsTable)
    .where(eq(quotationsTable.id, id));

  if (!quotation) {
    res.status(404).json({ error: "Quotation not found", code: "NOT_FOUND" });
    return;
  }

  const pdfKey = quotation.pdfStorageKey;
  if (!pdfKey) {
    res.status(400).json({ error: "No PDF associated with this quotation", code: "NO_PDF" });
    return;
  }

  req.log.info({ quotationId: id, pdfKey }, "Re-extracting quotation");

  let extracted;
  try {
    extracted = await extractFromPdf(pdfKey);
  } catch (err) {
    req.log.error({ err, quotationId: id }, "Re-extraction failed");
    res.status(500).json({ error: "Re-extraction failed", code: "EXTRACTION_FAILED" });
    return;
  }

  if (extracted.isQuotation === false) {
    req.log.info({ quotationId: id }, "Re-extraction determined document is not a quotation");
    res.status(400).json({ error: "Document does not appear to be a quotation", code: "NOT_A_QUOTATION" });
    return;
  }

  const [updated] = await db
    .update(quotationsTable)
    .set({
      supplierName: extracted.supplierName,
      supplierEmail: extracted.supplierEmail,
      quotationNumber: extracted.quotationNumber,
      quotationDate: extracted.quotationDate,
      currency: extracted.currency,
      paymentTerms: extracted.paymentTerms,
      deliveryTerms: extracted.deliveryTerms,
      totalAmount: extracted.totalAmount,
      extractionScore: extracted.extractionScore,
      status: "draft",
    })
    .where(eq(quotationsTable.id, id))
    .returning();

  await db.delete(quotationItemsTable).where(eq(quotationItemsTable.quotationId, id));

  if (extracted.items.length > 0) {
    await db.insert(quotationItemsTable).values(
      extracted.items.map((item) => ({
        quotationId: id,
        partNumber: item.partNumber,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        leadTime: item.leadTime,
        moq: item.moq,
        currency: item.currency ?? extracted.currency,
        notes: item.notes,
      })),
    );
  }

  await logEvent(id, "re_extracted", String(quotation.extractionScore ?? 0), String(extracted.extractionScore), `Re-extracted ${extracted.items.length} items`);

  const items = await db
    .select()
    .from(quotationItemsTable)
    .where(eq(quotationItemsTable.quotationId, id));

  res.json({ ...updated, items });
});

// Update quotation
router.patch("/quotations/:id", async (req, res): Promise<void> => {
  const params = UpdateQuotationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const body = UpdateQuotationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const [existing] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, params.data.id));

  const [quotation] = await db
    .update(quotationsTable)
    .set(body.data)
    .where(eq(quotationsTable.id, params.data.id))
    .returning();

  if (!quotation) {
    res.status(404).json({ error: "Quotation not found", code: "NOT_FOUND" });
    return;
  }

  if (existing && body.data.status && body.data.status !== existing.status) {
    await logEvent(quotation.id, "status_changed", existing.status, body.data.status);
  } else if (existing) {
    await logEvent(quotation.id, "updated", null, null, "Fields updated");
  }

  res.json(quotation);
});

// Delete quotation
router.delete("/quotations/:id", async (req, res): Promise<void> => {
  const params = DeleteQuotationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  await db
    .delete(quotationItemsTable)
    .where(eq(quotationItemsTable.quotationId, params.data.id));

  await db.delete(quotationEventsTable).where(eq(quotationEventsTable.quotationId, params.data.id));

  const [quotation] = await db
    .delete(quotationsTable)
    .where(eq(quotationsTable.id, params.data.id))
    .returning();

  if (!quotation) {
    res.status(404).json({ error: "Quotation not found", code: "NOT_FOUND" });
    return;
  }

  res.sendStatus(204);
});

// Create a new item for a quotation
router.post("/quotations/:id/items", async (req, res): Promise<void> => {
  const params = ListQuotationItemsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const body = CreateItemBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const [quotation] = await db
    .select()
    .from(quotationsTable)
    .where(eq(quotationsTable.id, params.data.id));

  if (!quotation) {
    res.status(404).json({ error: "Quotation not found", code: "NOT_FOUND" });
    return;
  }

  const [item] = await db
    .insert(quotationItemsTable)
    .values({ quotationId: params.data.id, ...body.data })
    .returning();

  await logEvent(params.data.id, "item_added", null, body.data.partNumber ?? body.data.description ?? "item");

  res.status(201).json(item);
});

// List items for a quotation
router.get("/quotations/:id/items", async (req, res): Promise<void> => {
  const params = ListQuotationItemsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const items = await db
    .select()
    .from(quotationItemsTable)
    .where(eq(quotationItemsTable.quotationId, params.data.id));

  res.json(items);
});

// Update a single item
router.patch("/items/:id", async (req, res): Promise<void> => {
  const params = UpdateItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const body = UpdateItemBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const [item] = await db
    .update(quotationItemsTable)
    .set(body.data)
    .where(eq(quotationItemsTable.id, params.data.id))
    .returning();

  if (!item) {
    res.status(404).json({ error: "Item not found", code: "NOT_FOUND" });
    return;
  }

  res.json(item);
});

// Delete a single item
router.delete("/items/:id", async (req, res): Promise<void> => {
  const params = DeleteItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const [item] = await db
    .delete(quotationItemsTable)
    .where(eq(quotationItemsTable.id, params.data.id))
    .returning();

  if (!item) {
    res.status(404).json({ error: "Item not found", code: "NOT_FOUND" });
    return;
  }

  res.sendStatus(204);
});

// Search quotations and items
router.get("/search", async (req, res): Promise<void> => {
  const parsed = SearchQuotationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: "VALIDATION_ERROR" });
    return;
  }

  const { q } = parsed.data;

  const quotations = await db
    .select()
    .from(quotationsTable)
    .where(
      or(
        ilike(quotationsTable.supplierName, `%${q}%`),
        ilike(quotationsTable.quotationNumber, `%${q}%`),
        ilike(quotationsTable.paymentTerms, `%${q}%`),
      ),
    );

  const items = await db
    .select()
    .from(quotationItemsTable)
    .where(
      or(
        ilike(quotationItemsTable.partNumber, `%${q}%`),
        ilike(quotationItemsTable.description, `%${q}%`),
      ),
    );

  res.json({
    quotations,
    items,
    total: quotations.length + items.length,
  });
});



export default router;
