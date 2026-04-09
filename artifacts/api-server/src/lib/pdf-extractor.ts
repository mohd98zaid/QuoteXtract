import { openai } from "@workspace/integrations-openai-ai-server";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const uploadDir = "/tmp/quotation-pdfs";

export interface ExtractedQuotation {
  supplierName: string | null;
  supplierEmail: string | null;
  quotationNumber: string | null;
  quotationDate: string | null;
  currency: string | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  totalAmount: string | null;
  items: ExtractedItem[];
  extractionScore: number;
}

export interface ExtractedItem {
  partNumber: string | null;
  description: string | null;
  quantity: string | null;
  unitPrice: string | null;
  totalPrice: string | null;
  leadTime: string | null;
  moq: string | null;
  currency: string | null;
  notes: string | null;
}

async function extractTextFromPdf(filePath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("pdftotext", ["-layout", filePath, "-"], {
      maxBuffer: 10 * 1024 * 1024, // 10 MB
    });
    return stdout.trim();
  } catch {
    return "";
  }
}

export async function extractFromPdf(storageKey: string): Promise<ExtractedQuotation> {
  const filePath = path.join(uploadDir, storageKey);

  if (!fs.existsSync(filePath)) {
    throw new Error(`PDF file not found: ${storageKey}`);
  }

  const pdfText = await extractTextFromPdf(filePath);

  const systemPrompt = `You are a precise data extraction assistant specializing in supplier quotation documents.
Extract structured quotation data from the provided text. Always respond with valid JSON only — no markdown fences, no explanations.
For fields you cannot find, use null. Extract every line item you can identify.`;

  const userPrompt = `Extract all quotation data from the following supplier quotation text and return a JSON object with this exact structure:
{
  "supplierName": "Company name of the supplier",
  "supplierEmail": "supplier contact email or null",
  "quotationNumber": "quotation/reference number or null",
  "quotationDate": "date in ISO format (YYYY-MM-DD) or original format, or null",
  "currency": "3-letter currency code (USD, EUR, GBP, SGD, AED, etc.) or null",
  "paymentTerms": "payment terms description or null",
  "deliveryTerms": "delivery/shipping terms or null",
  "totalAmount": "total quotation value as string with 2 decimal places, or null",
  "items": [
    {
      "partNumber": "part/item number or null",
      "description": "item description or null",
      "quantity": "quantity as string or null",
      "unitPrice": "unit price as string with 2 decimal places or null",
      "totalPrice": "line total as string with 2 decimal places or null",
      "leadTime": "lead time description or null",
      "moq": "minimum order quantity or null",
      "currency": "item-specific currency override or null",
      "notes": "any additional notes for this item or null"
    }
  ],
  "extractionScore": <integer 0-100 representing your confidence in the extraction quality>
}

Quotation text:
${pdfText || "(No text could be extracted from this PDF — it may be scanned/image-based. Return your best estimate with extractionScore: 0.)"}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";

  let extracted: ExtractedQuotation;
  try {
    extracted = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        extracted = JSON.parse(match[0]);
      } catch {
        extracted = emptyExtraction();
      }
    } else {
      extracted = emptyExtraction();
    }
  }

  if (!Array.isArray(extracted.items)) {
    extracted.items = [];
  }

  if (typeof extracted.extractionScore !== "number") {
    extracted.extractionScore = 50;
  }

  return extracted;
}

function emptyExtraction(): ExtractedQuotation {
  return {
    supplierName: null,
    supplierEmail: null,
    quotationNumber: null,
    quotationDate: null,
    currency: null,
    paymentTerms: null,
    deliveryTerms: null,
    totalAmount: null,
    items: [],
    extractionScore: 0,
  };
}
