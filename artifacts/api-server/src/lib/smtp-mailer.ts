import nodemailer from "nodemailer";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  email: string;
  fromName: string;
  configured: boolean;
}

export interface EmailAlias {
  email: string;
  name: string;
}

async function getSetting(key: string): Promise<string | null> {
  try {
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
}

export async function getSmtpConfig(): Promise<SmtpConfig> {
  const email = await getSetting("smtp_email");
  const host = (await getSetting("smtp_host")) || "smtp.hostinger.com";
  const port = Number((await getSetting("smtp_port")) || 465);
  const secure = (await getSetting("smtp_secure")) !== "false";
  const fromName = (await getSetting("smtp_from_name")) || "QuoteXtract";

  return {
    host,
    port,
    secure,
    email,
    fromName,
    configured: !!email,
  };
}

export async function saveSmtpConfig(opts: {
  email: string;
  password: string;
  host?: string;
  port?: number;
  secure?: boolean;
  fromName?: string;
}): Promise<void> {
  const pairs: [string, string][] = [
    ["smtp_email", opts.email],
    ["smtp_password", opts.password],
    ["smtp_host", opts.host || "smtp.hostinger.com"],
    ["smtp_port", String(opts.port ?? 465)],
    ["smtp_secure", String(opts.secure ?? true)],
    ["smtp_from_name", opts.fromName || "QuoteXtract"],
  ];

  for (const [key, value] of pairs) {
    await setSetting(key, value);
  }

  logger.info({ email: opts.email }, "SMTP config saved");
}

export async function getAliases(): Promise<EmailAlias[]> {
  try {
    const raw = await getSetting("smtp_aliases");
    if (!raw) return [];
    return JSON.parse(raw) as EmailAlias[];
  } catch {
    return [];
  }
}

export async function addAlias(alias: EmailAlias): Promise<EmailAlias[]> {
  const existing = await getAliases();
  if (existing.some((a) => a.email.toLowerCase() === alias.email.toLowerCase())) {
    return existing;
  }
  const updated = [...existing, { email: alias.email.trim(), name: alias.name.trim() }];
  await setSetting("smtp_aliases", JSON.stringify(updated));
  return updated;
}

export async function removeAlias(email: string): Promise<EmailAlias[]> {
  const existing = await getAliases();
  const updated = existing.filter((a) => a.email.toLowerCase() !== email.toLowerCase());
  await setSetting("smtp_aliases", JSON.stringify(updated));
  return updated;
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export async function sendMail(opts: {
  to: string;
  cc?: string;
  subject: string;
  text: string;
  fromEmail?: string;
  fromName?: string;
  attachments?: MailAttachment[];
}): Promise<void> {
  const email = await getSetting("smtp_email");
  const password = await getSetting("smtp_password");
  const host = (await getSetting("smtp_host")) || "smtp.hostinger.com";
  const port = Number((await getSetting("smtp_port")) || 465);
  const secure = (await getSetting("smtp_secure")) !== "false";
  const defaultFromName = (await getSetting("smtp_from_name")) || "QuoteXtract";

  if (!email || !password) {
    throw new Error("SMTP not configured. Please add your credentials in Settings.");
  }

  const resolvedFromEmail = opts.fromEmail || email;
  const resolvedFromName = opts.fromName || defaultFromName;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user: email, pass: password },
  });

  await transporter.sendMail({
    from: `"${resolvedFromName}" <${resolvedFromEmail}>`,
    to: opts.to,
    cc: opts.cc || undefined,
    subject: opts.subject,
    text: opts.text,
    attachments: opts.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });

  logger.info({ to: opts.to, from: resolvedFromEmail, subject: opts.subject }, "Email sent via SMTP");
}
