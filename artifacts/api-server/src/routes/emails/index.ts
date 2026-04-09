import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, emailsTable } from "@workspace/db";
import {
  CreateEmailBody,
  GetEmailParams,
  ListEmailsResponse,
  GetEmailResponse,
} from "@workspace/api-zod";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

router.get("/emails", async (req, res): Promise<void> => {
  const emails = await db
    .select()
    .from(emailsTable)
    .orderBy(emailsTable.createdAt);
  res.json(ListEmailsResponse.parse(emails));
});

router.post("/emails", async (req, res): Promise<void> => {
  const parsed = CreateEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [email] = await db.insert(emailsTable).values(parsed.data).returning();
  req.log.info({ emailId: email.id }, "Email record created");
  res.status(201).json(GetEmailResponse.parse(email));
});

router.get("/emails/:id", async (req, res): Promise<void> => {
  const params = GetEmailParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [email] = await db
    .select()
    .from(emailsTable)
    .where(eq(emailsTable.id, params.data.id));

  if (!email) {
    res.status(404).json({ error: "Email not found" });
    return;
  }

  res.json(GetEmailResponse.parse(email));
});

export default router;
