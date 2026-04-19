import React, { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { QuotationDocument, QuotationData } from "@/components/pdf/QuotationDocument";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Download, Eye, Image as ImageIcon, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const quotationSchema = z.object({
  quotationNumber: z.string().min(1, "Quotation Number is required"),
  date: z.string().min(1, "Date is required"),
  validUntil: z.string().min(1, "Valid Until is required"),
  clientName: z.string().min(1, "Client Name is required"),
  clientAddress: z.string(),
  clientContact: z.string(),
  clientVat: z.string(),
  buyersRef: z.string(),
  email: z.string(),
  destination: z.string(),
  termsOfPayment: z.string(),
  termsOfDelivery: z.string(),
  items: z.array(z.object({
    partNo: z.string(),
    brand: z.string(),
    description: z.string().min(1, "Description is required"),
    deliveryLeadTime: z.string(),
    quantity: z.coerce.number().min(1),
    unitPrice: z.coerce.number().min(0),
  })).min(1, "At least one item is required"),
  taxRate: z.coerce.number().min(0).max(100),
  notes: z.string(),
});

type QuotationFormValues = z.infer<typeof quotationSchema>;

const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = error => reject(error);
});

async function generatePdfBlob(filename: string, pdfData?: QuotationData): Promise<File> {
  const element = document.getElementById("print-section");
  if (!element) throw new Error("print-section not found");

  // Temporarily reveal the element at full scale for capture
  const originalTransform = element.style.transform;
  const originalMargin = element.style.marginBottom;
  element.style.transform = "scale(1)";
  element.style.marginBottom = "0";

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: element.scrollWidth,
      height: element.scrollHeight,
    });

    const imgData = canvas.toDataURL("image/png");
    // A4 dimensions in mm
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    // If content is taller than one page, add more pages
    let heightLeft = imgHeight;
    let position = 0;

    // INJECT DATA LAYER FOR AI PARSERS (Fixes "Unknown Customer" textless PDF issue)
    let machineText = "";
    if (pdfData) {
      const subtotal = pdfData.items.reduce((acc, item) => acc + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
      const taxAmount = subtotal * (Number(pdfData.taxRate || 0) / 100);
      const grandTotal = subtotal + taxAmount;
      
      machineText = `[EXTRACTION-HINTS] DOCUMENT-TYPE: QUOTATION ISSUER: PLUMS AND PEARLS FZE LLC (sender, NOT the customer) CUSTOMER-SECTION-STARTS: Customer Details
Customer Name: ${pdfData.clientName}
Customer Address: ${pdfData.clientAddress}
Customer Contact: ${pdfData.clientContact}
Customer VAT: ${pdfData.clientVat}
Quotation Number: ${pdfData.quotationNumber}
Date: ${pdfData.date}
Total Amount: ${grandTotal}
Items:
${pdfData.items.map(i => `- ${i.partNo} | ${i.description} | ${i.quantity} @ ${i.unitPrice}`).join("\n")}`;
      
      console.log("[DEBUG] Generating PDF with machine-readable layer:", machineText.slice(0, 100) + "...");
    }

    // 1. First, generate all visual pages (the "screenshot" images)
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // 2. APPEND GUARANTEED MACHINE-READABLE DATA PAGE (Appendix)
    if (machineText) {
      pdf.addPage();
      pdf.setTextColor(0, 0, 0); // Standard black
      pdf.setFontSize(10); // Standard readable size
      const textLines = pdf.splitTextToSize(machineText, 190);
      
      pdf.text("--- SYSTEM DATA LAYER (MACHINE READABLE) ---", 10, 10);
      pdf.text(textLines, 10, 20);
      
      console.log("[DEBUG] Appended machine-readable data appendix to PDF.");
    }

    const blob = pdf.output("blob");
    return new File([blob], filename, { type: "application/pdf" });
  } finally {
    element.style.transform = originalTransform;
    element.style.marginBottom = originalMargin;
  }
}

export default function NewQuotationPage() {
  const [logoDataUrl] = useState<string | undefined>(() => localStorage.getItem("quotation_logo") || undefined);
  const [stampDataUrl] = useState<string | undefined>(() => localStorage.getItem("quotation_stamp") || undefined);
  const [showTrackDialog, setShowTrackDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { register, control, watch, setValue, formState: { errors } } = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      quotationNumber: `PNP/QTN/${new Date().getFullYear()}/___`,
      date: new Date().toISOString().split("T")[0],
      validUntil: "30 Days",
      clientName: "",
      clientAddress: "",
      clientContact: "",
      clientVat: "",
      buyersRef: "",
      email: "",
      destination: "",
      termsOfPayment: "ADVANCE",
      termsOfDelivery: "Ex-Work Dubai",
      items: [{ partNo: "", brand: "", description: "", deliveryLeadTime: "", quantity: 1, unitPrice: 0 }],
      taxRate: 5,
      notes: "",
    }
  });

  // On mount: fetch the last saved quotation number and auto-increment it
  useEffect(() => {
    const fetchNextNumber = async () => {
      try {
        const res = await fetch("/api/quotations?limit=1&page=1");
        if (!res.ok) return;
        const data = await res.json();
        const lastQuotation = data?.data?.[0];
        const year = new Date().getFullYear();
        if (lastQuotation?.quotationNumber) {
          // Match pattern like PNP/QTN/2026/458
          const match = lastQuotation.quotationNumber.match(/PNP\/QTN\/(\d{4})\/(\d+)/);
          if (match) {
            const nextNum = parseInt(match[2], 10) + 1;
            setValue("quotationNumber", `PNP/QTN/${year}/${nextNum}`);
            return;
          }
        }
        // No existing quotations or pattern doesn't match â€” start from 100
        setValue("quotationNumber", `PNP/QTN/${year}/100`);
      } catch {
        const year = new Date().getFullYear();
        setValue("quotationNumber", `PNP/QTN/${year}/100`);
      }
    };
    fetchNextNumber();
  }, [setValue]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  const formData = watch();

  const pdfData: QuotationData = {
    ...formData,
    quotationNumber: formData.quotationNumber || "",
    date: formData.date || "",
    validUntil: formData.validUntil || "",
    clientName: formData.clientName || "",
    clientAddress: formData.clientAddress || "",
    clientContact: formData.clientContact || "",
    clientVat: formData.clientVat || "",
    buyersRef: formData.buyersRef || "",
    email: formData.email || "",
    destination: formData.destination || "",
    termsOfPayment: formData.termsOfPayment || "",
    termsOfDelivery: formData.termsOfDelivery || "",
    items: formData.items ? formData.items.map(i => ({
        partNo: i.partNo || "",
        brand: i.brand || "",
        deliveryLeadTime: i.deliveryLeadTime || "",
        description: i.description || "",
        quantity: i.quantity || 0,
        unitPrice: i.unitPrice || 0
    })) : [],
    taxRate: formData.taxRate || 0,
    notes: formData.notes || "",
    logoDataUrl,
    stampDataUrl,
  };



  const handlePrint = () => {
    // Set page title to quotation number (slashes â†’ dashes) so browser saves PDF with correct filename
    const originalTitle = document.title;
    const qNum = formData.quotationNumber || "quotation";
    const pdfFilename = qNum.replace(/\//g, "-");
    document.title = pdfFilename;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
      setShowTrackDialog(true);
    }, 1000);
  };

  const handleTrackInPortal = async () => {
    try {
      setIsSaving(true);
      const subtotal = pdfData.items.reduce(
        (acc, item) => acc + Number(item.quantity || 0) * Number(item.unitPrice || 0),
        0
      );
      const taxAmount = subtotal * (Number(pdfData.taxRate || 0) / 100);
      const grandTotal = subtotal + taxAmount;

      // Build notes combining form notes, buyers ref, email, destination, and validity
      const extraNotes = [
        pdfData.buyersRef ? `Buyer's Ref: ${pdfData.buyersRef}` : null,
        pdfData.email ? `Email: ${pdfData.email}` : null,
        pdfData.destination ? `Destination: ${pdfData.destination}` : null,
        pdfData.validUntil ? `Valid Until: ${pdfData.validUntil}` : null,
        pdfData.notes || null,
      ].filter(Boolean).join("\n");

      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Client (customer) info â€” this is an outbound quotation we are sending
          supplierName: pdfData.clientName || "Unknown Client",
          clientAddress: pdfData.clientAddress || null,
          clientContact: pdfData.clientContact || null,
          clientVat: pdfData.clientVat || null,
          supplierEmail: pdfData.email || null,
          // Quotation meta
          quotationNumber: pdfData.quotationNumber,
          quotationDate: pdfData.date,
          currency: "AED",
          direction: "outbound",
          // Terms
          paymentTerms: pdfData.termsOfPayment || null,
          deliveryTerms: pdfData.termsOfDelivery || null,
          // Financials
          totalAmount: String(grandTotal),
          // Combined notes with all extra fields
          notes: extraNotes || null,
        })
      });

      if (!res.ok) throw new Error("Failed to save quotation");
      
      const savedQuote = await res.json();
      
      for (const item of pdfData.items) {
         await fetch(`/api/quotations/${savedQuote.id}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
               partNumber: item.partNo || null,
               description: item.description,
               quantity: String(Number(item.quantity) || 0),
               unitPrice: String(item.unitPrice),
               totalPrice: String(Number(item.quantity) * Number(item.unitPrice)),
               leadTime: item.deliveryLeadTime || null,
               currency: "AED"
            })
         });
      }

      // Generate a PDF from the live preview and attach it to the quotation record
      try {
        const pdfFilename = (pdfData.quotationNumber || "quotation").replace(/\//g, "-") + ".pdf";
        const pdfFile = await generatePdfBlob(pdfFilename, pdfData);
        const formDataUpload = new FormData();
        formDataUpload.append("file", pdfFile, pdfFilename);
        const attachRes = await fetch(`/api/quotations/${savedQuote.id}/attach-pdf`, {
          method: "POST",
          body: formDataUpload,
        });
        if (!attachRes.ok) {
          console.warn("PDF attachment failed:", await attachRes.text());
        }
      } catch (pdfErr) {
        console.warn("PDF generation/upload error:", pdfErr);
        // Non-fatal — quotation is still saved
      }

      toast({ title: "Success", description: "Quotation is now tracked in your portal." });
      setLocation("/quotations");
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Could not track quotation." });
    } finally {
      setIsSaving(false);
      setShowTrackDialog(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
      {/* 
        This is a global style override to ensure that when window.print() is called, 
        ONLY the component inside the PDF Preview pane is printed.
      */}
      <style>{`
        @page {
          size: A4;
          margin: 0;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          #print-section, #print-section * {
            visibility: visible;
          }
          #print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            min-height: 297mm;
          }
          /* Remove background colors and extra spacing when printing */
          .print\\:shadow-none { box-shadow: none !important; }
        }
      `}</style>
      
      {/* Form Section */}
      <div className="w-full lg:w-1/2 xl:w-5/12 overflow-y-auto pr-4 space-y-6 pb-20 print:hidden">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">New Quotation</h1>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Meta Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               <div className="space-y-2 md:col-span-2">
                 <Label>Quotation No.</Label>
                 <Input {...register("quotationNumber")} />
                 {errors.quotationNumber && <p className="text-xs text-red-500">{errors.quotationNumber.message}</p>}
               </div>
               <div className="space-y-2">
                 <Label>Date</Label>
                 <Input type="date" {...register("date")} />
               </div>
               <div className="space-y-2">
                 <Label>Valid Until</Label>
                 <Input type="date" {...register("validUntil")} />
               </div>
             </div>
          </CardContent>
        </Card>

         <Card>
          <CardHeader>
            <CardTitle>Client Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label>Client Name</Label>
                 <Input {...register("clientName")} placeholder="Acme Corp" />
                 {errors.clientName && <p className="text-xs text-red-500">{errors.clientName.message}</p>}
               </div>
               <div className="space-y-2">
                 <Label>Client VAT / TRN</Label>
                 <Input {...register("clientVat")} placeholder="100000000000000" />
               </div>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client Address</Label>
                  <Textarea {...register("clientAddress")} placeholder="123 Business St, Dubai" className="min-h-[80px]"/>
                </div>
                <div className="space-y-2">
                  <Label>Client Contact</Label>
                  <Textarea {...register("clientContact")} placeholder="contact@acme.com&#10;+971 50 123 4567" className="min-h-[80px]" />
                </div>
             </div>
             <div className="grid grid-cols-5 gap-4 pt-4 border-t border-border mt-4">
                <div className="space-y-2 col-span-2">
                  <Label>Buyer's Ref./Order No.</Label>
                  <Input {...register("buyersRef")} />
                </div>
                <div className="space-y-2 col-span-3">
                  <Label>Email</Label>
                  <Input type="email" {...register("email")} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Destination</Label>
                  <Input {...register("destination")} />
                </div>
                <div className="space-y-2 col-span-3">
                  <Label>Terms of Delivery</Label>
                  <Input {...register("termsOfDelivery")} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Payment Terms</Label>
                  <Input {...register("termsOfPayment")} />
                </div>
             </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="flex flex-col gap-4 border p-4 rounded-md bg-muted/20 relative">
                 <div className="flex gap-4 items-start">
                   <div className="w-1/3 space-y-2">
                     <Label>Part No</Label>
                     <Input {...register(`items.${index}.partNo` as const)} placeholder="Part No" />
                   </div>
                   <div className="w-1/3 space-y-2">
                     <Label>Brand</Label>
                     <Input {...register(`items.${index}.brand` as const)} placeholder="Brand" />
                   </div>
                   <div className="w-1/3 space-y-2">
                     <Label>Delivery Lead Time</Label>
                     {/* Number + unit selector — writes combined string into the form field */}
                     <div className="flex gap-1">
                       <Input
                         type="number"
                         min={1}
                         placeholder="1"
                         className="w-16 shrink-0"
                         value={(() => {
                           const val = watch(`items.${index}.deliveryLeadTime` as const) || "";
                           const match = val.match(/^(\d+)/);
                           return match ? match[1] : "";
                         })()}
                         onChange={(e) => {
                           const cur = watch(`items.${index}.deliveryLeadTime` as const) || "";
                           const unitMatch = cur.match(/(Days|Weeks|Months)$/i);
                           const unit = unitMatch ? unitMatch[1] : "Days";
                           setValue(`items.${index}.deliveryLeadTime` as const, `${e.target.value} ${unit}`);
                         }}
                       />
                       <Select
                         value={(() => {
                           const val = watch(`items.${index}.deliveryLeadTime` as const) || "";
                           const match = val.match(/(Days|Weeks|Months)$/i);
                           return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() : "Days";
                         })()}
                         onValueChange={(unit) => {
                           const cur = watch(`items.${index}.deliveryLeadTime` as const) || "";
                           const numMatch = cur.match(/^(\d+)/);
                           const num = numMatch ? numMatch[1] : "1";
                           setValue(`items.${index}.deliveryLeadTime` as const, `${num} ${unit}`);
                         }}
                       >
                         <SelectTrigger className="flex-1">
                           <SelectValue />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="Days">Days</SelectItem>
                           <SelectItem value="Weeks">Weeks</SelectItem>
                           <SelectItem value="Months">Months</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
                   </div>
                   <Button type="button" variant="ghost" size="icon" className="mt-8 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 shrink-0" onClick={() => remove(index)} disabled={fields.length === 1}>
                     <Trash2 className="w-4 h-4" />
                   </Button>
                 </div>
                 <div className="flex gap-4 items-start">
                   <div className="flex-1 space-y-2">
                     <Label>Description</Label>
                     <Input {...register(`items.${index}.description` as const)} placeholder="Item description" />
                     {errors.items?.[index]?.description && <p className="text-xs text-red-500">{errors.items[index]?.description?.message}</p>}
                   </div>
                   <div className="w-24 space-y-2">
                     <Label>Qty</Label>
                     <Input type="number" {...register(`items.${index}.quantity` as const)} placeholder="1" />
                   </div>
                   <div className="w-32 space-y-2">
                     <Label>Unit Price</Label>
                     <Input type="number" {...register(`items.${index}.unitPrice` as const)} placeholder="0.00" />
                   </div>
                 </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => append({ partNo: "", brand: "", deliveryLeadTime: "", description: "", quantity: 1, unitPrice: 0 })} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary & Assets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
               <div className="space-y-2">
                 <Label>Tax/VAT Rate (%)</Label>
                 <Input type="number" {...register("taxRate")} />
               </div>
               <div className="space-y-2">
                 <Label>Notes / Terms</Label>
                 <Textarea {...register("notes")} className="min-h-[100px]" />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-border">
               <div className="col-span-2 text-sm text-muted-foreground bg-muted/40 p-4 rounded-lg flex items-center justify-between border border-border/50">
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                     <ImageIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                   </div>
                   <div>
                     <p className="font-semibold text-foreground">Logo & Stamp Options</p>
                     <p className="text-xs">Your logo and authorized signature/stamp are configured in Settings.</p>
                   </div>
                 </div>
                 <a href="/settings" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">Change defaults</a>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PDF Preview Section */}
      <div className="w-full lg:w-1/2 xl:w-7/12 flex flex-col bg-muted/30 border rounded-xl overflow-hidden mt-6 lg:mt-0 lg:h-full pb-14 lg:pb-0 print:border-none print:m-0 print:p-0 print:!w-full print:!overflow-visible print:bg-transparent">
        <div className="p-4 border-b bg-card flex justify-between items-center shrink-0 print:hidden">
          <div className="flex items-center gap-2 font-medium text-sm">
             <Eye className="w-4 h-4 text-muted-foreground" />
             Live Document Preview
          </div>
          <Button onClick={handlePrint} size="sm">
            <Printer className="w-4 h-4 mr-2" />
            Print / Save as PDF
          </Button>
        </div>
        
        <div className="flex-1 bg-zinc-400 dark:bg-zinc-800 lg:min-h-0 min-h-[500px] overflow-auto p-8 print:p-0 print:!overflow-visible print:bg-white flex items-start justify-center">
           <div id="print-section" className="transition-transform origin-top print:!scale-100" style={{ transform: "scale(0.85)", marginBottom: "-15%" }}>
             <QuotationDocument data={pdfData} />
           </div>
        </div>
      </div>

      <AlertDialog open={showTrackDialog} onOpenChange={setShowTrackDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quotation Formatted Successfully</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to track and save this created quotation in your Quotations Portal to monitor its status later?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Skip</AlertDialogCancel>
            <Button onClick={handleTrackInPortal} disabled={isSaving}>
              {isSaving ? "Saving..." : "Yes, Track in Portal"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

