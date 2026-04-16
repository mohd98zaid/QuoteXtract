import React, { useState, useEffect, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { QuotationDocument, QuotationData } from "@/components/pdf/QuotationDocument";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

export default function NewQuotationPage() {
  const [logoDataUrl] = useState<string | undefined>(() => localStorage.getItem("quotation_logo") || undefined);
  const [stampDataUrl] = useState<string | undefined>(() => localStorage.getItem("quotation_stamp") || undefined);
  const [showTrackDialog, setShowTrackDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { register, control, watch, formState: { errors } } = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      quotationNumber: `PNP/QTN/2026/${Math.floor(100 + Math.random() * 900)}`,
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
    window.print();
    setTimeout(() => {
      setShowTrackDialog(true);
    }, 500);
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

      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName: pdfData.clientName || "Unknown Client",
          clientAddress: pdfData.clientAddress || null,
          clientContact: pdfData.clientContact || null,
          clientVat: pdfData.clientVat || null,
          supplierEmail: pdfData.email || null,
          quotationNumber: pdfData.quotationNumber,
          quotationDate: pdfData.date,
          currency: "AED",
          direction: "outbound",
          paymentTerms: pdfData.termsOfPayment || null,
          deliveryTerms: pdfData.termsOfDelivery || null,
          totalAmount: String(grandTotal),
          notes: pdfData.notes || null,
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
               quantity: Number(item.quantity),
               unitPrice: String(item.unitPrice),
               totalPrice: String(Number(item.quantity) * Number(item.unitPrice)),
               leadTime: item.deliveryLeadTime || null,
               currency: "AED"
            })
         });
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
            width: 100%;
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
             <div className="grid grid-cols-3 gap-4">
               <div className="space-y-2">
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
                     <Input {...register(`items.${index}.deliveryLeadTime` as const)} placeholder="2 weeks" />
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
