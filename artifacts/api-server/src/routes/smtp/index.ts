import { Router, type IRouter } from "express";
import multer from "multer";
import { getSmtpConfig, saveSmtpConfig, sendMail, getAliases, addAlias, removeAlias } from "../../lib/smtp-mailer";
import { db, emailsTable } from "@workspace/db";

const router: IRouter = Router();
const memUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// GET /api/smtp/status
router.get("/smtp/status", async (_req, res): Promise<void> => {
  const config = await getSmtpConfig();
  res.json(config);
});

// POST /api/smtp/configure
router.post("/smtp/configure", async (req, res): Promise<void> => {
  const { email, password, host, port, secure, fromName } = req.body ?? {};
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Valid email required" });
    return;
  }
  if (!password || typeof password !== "string") {
    res.status(400).json({ error: "Password required" });
    return;
  }
  await saveSmtpConfig({
    email,
    password,
    host: host || undefined,
    port: port ? Number(port) : undefined,
    secure: secure !== undefined ? Boolean(secure) : undefined,
    fromName: fromName || undefined,
  });
  const config = await getSmtpConfig();
  res.json(config);
});

// POST /api/mail/send  (accepts multipart/form-data OR application/json)
router.post("/mail/send", memUpload.array("attachments"), async (req, res): Promise<void> => {
  const { to, cc, subject, text, fromEmail, fromName } = req.body ?? {};
  if (!to || typeof to !== "string") {
    res.status(400).json({ error: "Recipient (to) required" });
    return;
  }
  if (!subject || typeof subject !== "string") {
    res.status(400).json({ error: "Subject required" });
    return;
  }
  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "Message body required" });
    return;
  }

  const files = (req.files as Express.Multer.File[]) ?? [];
  const attachments = files.map((f) => ({
    filename: f.originalname,
    content: f.buffer,
    contentType: f.mimetype,
  }));

  const smtpCfg = await getSmtpConfig();
  const resolvedFromEmail = (fromEmail as string | undefined) || smtpCfg.email || "";
  const resolvedFromName = (fromName as string | undefined) || smtpCfg.fromName || "Me";

  try {
    await sendMail({
      to, cc: cc || undefined, subject, text,
      fromEmail: resolvedFromEmail || undefined,
      fromName: resolvedFromName,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    await db.insert(emailsTable).values({
      senderName: resolvedFromName,
      senderEmail: resolvedFromEmail,
      recipientEmail: [to, ...(cc ? [cc] : [])].filter(Boolean).join(", "),
      subject,
      bodyText: text,
      receivedAt: new Date().toISOString(),
      source: "sent",
      status: "extracted",
      isRead: true,
    } as any);

    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    res.status(500).json({ error: message });
  }
});

// GET /api/smtp/aliases
router.get("/smtp/aliases", async (_req, res): Promise<void> => {
  const aliases = await getAliases();
  res.json({ aliases });
});

// POST /api/smtp/aliases
router.post("/smtp/aliases", async (req, res): Promise<void> => {
  const { email, name } = req.body ?? {};
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "email required" });
    return;
  }
  const aliases = await addAlias({ email: email.trim(), name: (name || email.trim()) });
  res.json({ aliases });
});

// DELETE /api/smtp/aliases/:email
router.delete("/smtp/aliases/:email", async (req, res): Promise<void> => {
  const email = decodeURIComponent(req.params.email);
  const aliases = await removeAlias(email);
  res.json({ aliases });
});

export default router;
