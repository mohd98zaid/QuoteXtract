import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

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

router.post(
  "/emails/upload-pdf",
  upload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const storageKey = req.file.filename;
    const filename = req.file.originalname;

    req.log.info({ storageKey, filename }, "PDF uploaded");

    res.json({
      storageKey,
      filename,
      url: `/api/pdfs/${storageKey}`,
    });
  },
);

router.get("/pdfs/:key", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
  const filePath = path.join(uploadDir, raw);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.sendFile(filePath);
});

export default router;
