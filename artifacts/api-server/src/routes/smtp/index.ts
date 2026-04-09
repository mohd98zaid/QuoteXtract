import { Router, type IRouter } from "express";
import { getSmtpConfig, saveSmtpConfig, sendMail } from "../../lib/smtp-mailer";

const router: IRouter = Router();

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

// POST /api/mail/send
router.post("/mail/send", async (req, res): Promise<void> => {
  const { to, cc, subject, text } = req.body ?? {};
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
  try {
    await sendMail({ to, cc: cc || undefined, subject, text });
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send email";
    res.status(500).json({ error: message });
  }
});

export default router;
