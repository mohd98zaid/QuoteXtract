import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, emailsTable, quotationsTable, quotationItemsTable } from "@workspace/db";
import { ExtractQuotationBody } from "@workspace/api-zod";
import { extractFromPdf } from "../../lib/pdf-extractor";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

router.post("/extract", async (req, res): Promise<void> => {
  const parsed = ExtractQuotationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { emailId, pdfStorageKey } = parsed.data;

  await db
    .update(emailsTable)
    .set({ status: "processing" })
    .where(eq(emailsTable.id, emailId));

  req.log.info({ emailId, pdfStorageKey }, "Starting PDF extraction");

  let extracted;
  try {
    extracted = await extractFromPdf(pdfStorageKey);
  } catch (err) {
    req.log.error({ err, emailId }, "PDF extraction failed");
    await db
      .update(emailsTable)
      .set({ status: "failed" })
      .where(eq(emailsTable.id, emailId));
    res.status(400).json({ error: "PDF extraction failed" });
    return;
  }

  if (extracted.isQuotation === false) {
    req.log.info({ emailId, pdfStorageKey }, "Document is not a quotation");
    await db
      .update(emailsTable)
      .set({ status: "failed" })
      .where(eq(emailsTable.id, emailId));
    res.status(400).json({ error: "Document is not a recognizable quotation" });
    return;
  }

  const [quotation] = await db
    .insert(quotationsTable)
    .values({
      emailId,
      supplierName: extracted.supplierName,
      supplierEmail: extracted.supplierEmail,
      quotationNumber: extracted.quotationNumber,
      quotationDate: extracted.quotationDate,
      currency: extracted.currency,
      paymentTerms: extracted.paymentTerms,
      deliveryTerms: extracted.deliveryTerms,
      totalAmount: extracted.totalAmount,
      extractionScore: extracted.extractionScore,
      pdfStorageKey,
      status: "draft",
    })
    .returning();

  if (extracted.items.length > 0) {
    await db.insert(quotationItemsTable).values(
      extracted.items.map((item) => ({
        quotationId: quotation.id,
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

  await db
    .update(emailsTable)
    .set({ status: "extracted" })
    .where(eq(emailsTable.id, emailId));

  req.log.info(
    { emailId, quotationId: quotation.id, score: extracted.extractionScore },
    "Extraction complete",
  );

  const items = await db
    .select()
    .from(quotationItemsTable)
    .where(eq(quotationItemsTable.quotationId, quotation.id));

  res.json({ ...quotation, items });
});

export default router;
