import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { db, emailsTable, quotationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const uploadDir = "/tmp/quotation-pdfs";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

router.post(
  "/emails/upload-pdf",
  upload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded", code: "NO_FILE" });
      return;
    }

    const filePath = req.file.path;
    const sha256 = await hashFile(filePath);

    const [existing] = await db
      .select({ id: emailsTable.id, pdfFilename: emailsTable.pdfFilename, status: emailsTable.status, pdfStorageKey: emailsTable.pdfStorageKey })
      .from(emailsTable)
      .where(eq(emailsTable.pdfSha256, sha256));

    if (existing && existing.status === "extracted") {
      await fs.promises.unlink(filePath).catch(() => {});
      
      const [quote] = await db
        .select({ id: quotationsTable.id })
        .from(quotationsTable)
        .where(eq(quotationsTable.emailId, existing.id))
        .limit(1);

      res.status(409).json({
        error: "Duplicate file",
        code: "DUPLICATE_FILE",
        duplicate: {
          emailId: existing.id,
          filename: existing.pdfFilename,
          status: existing.status,
          storageKey: existing.pdfStorageKey,
          quotationId: quote?.id
        },
      });
      return;
    }

    const storageKey = req.file.filename;
    const filename = req.file.originalname;

    req.log.info({ storageKey, filename, sha256 }, "PDF uploaded");

    res.json({
      storageKey,
      filename,
      sha256,
      url: `/api/pdfs/${storageKey}`,
    });
  },
);

router.get("/pdfs/:key", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
  const filePath = path.join(uploadDir, raw);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found", code: "PDF_NOT_FOUND" });
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${raw}"`);
  res.sendFile(filePath);
});

export default router;
