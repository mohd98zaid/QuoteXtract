import { Router, type IRouter } from "express";
import { sql, count } from "drizzle-orm";
import { db, emailsTable, quotationsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/analytics/summary", async (req, res): Promise<void> => {
  const [emailStats] = await db
    .select({ total: count() })
    .from(emailsTable);

  const [quotationStats] = await db
    .select({ total: count() })
    .from(quotationsTable);

  const statusRows = await db
    .select({
      status: quotationsTable.status,
      cnt: count(),
    })
    .from(quotationsTable)
    .groupBy(quotationsTable.status);

  const statusBreakdown = statusRows.map((r) => ({
    status: r.status,
    count: Number(r.cnt),
  }));

  const pendingRow = await db
    .select({ cnt: count() })
    .from(emailsTable)
    .where(sql`${emailsTable.status} IN ('pending', 'processing')`);

  const reviewedRow = statusRows.find((r) => r.status === "reviewed");
  const approvedRow = statusRows.find((r) => r.status === "approved");

  const scoreRow = await db
    .select({
      avg: sql<number>`AVG(${quotationsTable.extractionScore})`,
    })
    .from(quotationsTable)
    .where(sql`${quotationsTable.extractionScore} IS NOT NULL`);

  res.json({
    totalEmails: Number(emailStats?.total ?? 0),
    totalQuotations: Number(quotationStats?.total ?? 0),
    pendingExtraction: Number(pendingRow[0]?.cnt ?? 0),
    reviewedQuotations: Number(reviewedRow?.cnt ?? 0),
    approvedQuotations: Number(approvedRow?.cnt ?? 0),
    avgExtractionScore: scoreRow[0]?.avg != null ? Math.round(Number(scoreRow[0].avg) * 10) / 10 : null,
    statusBreakdown,
  });
});

router.get("/analytics/by-supplier", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      supplierName: quotationsTable.supplierName,
      quotationCount: count(),
      totalValue: sql<string>`SUM(CAST(NULLIF(${quotationsTable.totalAmount}, '') AS NUMERIC))::TEXT`,
    })
    .from(quotationsTable)
    .where(sql`${quotationsTable.supplierName} IS NOT NULL`)
    .groupBy(quotationsTable.supplierName)
    .orderBy(sql`COUNT(*) DESC`);

  res.json(
    rows.map((r) => ({
      supplierName: r.supplierName ?? "Unknown",
      quotationCount: Number(r.quotationCount),
      totalValue: r.totalValue,
    })),
  );
});

router.get("/analytics/recent-activity", async (req, res): Promise<void> => {
  const recentQuotations = await db
    .select()
    .from(quotationsTable)
    .orderBy(sql`${quotationsTable.createdAt} DESC`)
    .limit(20);

  const activity = recentQuotations.map((q, i) => ({
    id: i + 1,
    type:
      q.status === "approved"
        ? "quotation_approved"
        : q.status === "reviewed"
          ? "quotation_reviewed"
          : "extraction_complete",
    description: q.supplierName
      ? `Quotation from ${q.supplierName}${q.quotationNumber ? ` #${q.quotationNumber}` : ""} ${q.status}`
      : `Quotation #${q.id} ${q.status}`,
    timestamp: q.createdAt instanceof Date ? q.createdAt.toISOString() : String(q.createdAt),
    quotationId: q.id,
    emailId: q.emailId,
  }));

  res.json(activity);
});

export default router;
