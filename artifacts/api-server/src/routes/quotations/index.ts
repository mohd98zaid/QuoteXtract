import { Router, type IRouter } from "express";
import { eq, ilike, or } from "drizzle-orm";
import { db, quotationsTable, quotationItemsTable } from "@workspace/db";
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

const router: IRouter = Router();

// List quotations with optional filters
router.get("/quotations", async (req, res): Promise<void> => {
  const parsed = ListQuotationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { status, search, emailId } = parsed.data;

  let query = db.select().from(quotationsTable).$dynamic();

  if (status) {
    query = query.where(eq(quotationsTable.status, status as "draft" | "reviewed" | "approved" | "rejected"));
  }

  if (search) {
    query = query.where(
      or(
        ilike(quotationsTable.supplierName, `%${search}%`),
        ilike(quotationsTable.quotationNumber, `%${search}%`),
      ),
    );
  }

  if (emailId) {
    query = query.where(eq(quotationsTable.emailId, emailId));
  }

  const quotations = await query.orderBy(quotationsTable.createdAt);
  res.json(quotations);
});

// Get single quotation with items
router.get("/quotations/:id", async (req, res): Promise<void> => {
  const params = GetQuotationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [quotation] = await db
    .select()
    .from(quotationsTable)
    .where(eq(quotationsTable.id, params.data.id));

  if (!quotation) {
    res.status(404).json({ error: "Quotation not found" });
    return;
  }

  const items = await db
    .select()
    .from(quotationItemsTable)
    .where(eq(quotationItemsTable.quotationId, quotation.id));

  res.json({ ...quotation, items });
});

// Update quotation
router.patch("/quotations/:id", async (req, res): Promise<void> => {
  const params = UpdateQuotationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateQuotationBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [quotation] = await db
    .update(quotationsTable)
    .set(body.data)
    .where(eq(quotationsTable.id, params.data.id))
    .returning();

  if (!quotation) {
    res.status(404).json({ error: "Quotation not found" });
    return;
  }

  res.json(quotation);
});

// Delete quotation
router.delete("/quotations/:id", async (req, res): Promise<void> => {
  const params = DeleteQuotationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .delete(quotationItemsTable)
    .where(eq(quotationItemsTable.quotationId, params.data.id));

  const [quotation] = await db
    .delete(quotationsTable)
    .where(eq(quotationsTable.id, params.data.id))
    .returning();

  if (!quotation) {
    res.status(404).json({ error: "Quotation not found" });
    return;
  }

  res.sendStatus(204);
});

// Create a new item for a quotation
router.post("/quotations/:id/items", async (req, res): Promise<void> => {
  const params = ListQuotationItemsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = CreateItemBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [quotation] = await db
    .select()
    .from(quotationsTable)
    .where(eq(quotationsTable.id, params.data.id));

  if (!quotation) {
    res.status(404).json({ error: "Quotation not found" });
    return;
  }

  const [item] = await db
    .insert(quotationItemsTable)
    .values({ quotationId: params.data.id, ...body.data })
    .returning();

  res.status(201).json(item);
});

// List items for a quotation
router.get("/quotations/:id/items", async (req, res): Promise<void> => {
  const params = ListQuotationItemsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
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
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateItemBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [item] = await db
    .update(quotationItemsTable)
    .set(body.data)
    .where(eq(quotationItemsTable.id, params.data.id))
    .returning();

  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  res.json(item);
});

// Delete a single item
router.delete("/items/:id", async (req, res): Promise<void> => {
  const params = DeleteItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [item] = await db
    .delete(quotationItemsTable)
    .where(eq(quotationItemsTable.id, params.data.id))
    .returning();

  if (!item) {
    res.status(404).json({ error: "Item not found" });
    return;
  }

  res.sendStatus(204);
});

// Search quotations and items
router.get("/search", async (req, res): Promise<void> => {
  const parsed = SearchQuotationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
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
