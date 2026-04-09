import { useState, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import {
  UploadCloud,
  File,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  ArrowRight,
  Mail,
} from "lucide-react";
import {
  useListEmails,
  useUploadPdf,
  useCreateEmail,
  useExtractQuotation,
  useListQuotations,
  getListEmailsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Inbox() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  const { data: emails, isLoading } = useListEmails();
  const { data: allQuotations } = useListQuotations({});

  const emailToQuotationId = useMemo(() => {
    const map: Record<number, number> = {};
    if (allQuotations) {
      for (const q of allQuotations) {
        if (q.emailId) map[q.emailId] = q.id;
      }
    }
    return map;
  }, [allQuotations]);

  const uploadPdfMut = useUploadPdf();
  const createEmailMut = useCreateEmail();
  const extractMut = useExtractQuotation();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast({ variant: "destructive", title: "Invalid file type", description: "Please upload a PDF file." });
      return;
    }
    try {
      setIsUploading(true);
      setUploadProgress("Uploading PDF...");
      const uploadRes = await uploadPdfMut.mutateAsync({ data: { file } });
      setUploadProgress("Creating record...");
      const emailRes = await createEmailMut.mutateAsync({
        data: {
          subject: `Uploaded: ${file.name}`,
          pdfFilename: uploadRes.filename,
          pdfStorageKey: uploadRes.storageKey,
          receivedAt: new Date().toISOString(),
        },
      });
      queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
      setUploadProgress("Extracting data via AI...");
      const quotationRes = await extractMut.mutateAsync({
        data: { emailId: emailRes.id, pdfStorageKey: uploadRes.storageKey },
      });
      toast({ title: "Extraction complete", description: "Successfully processed the quotation." });
      setLocation(`/quotations/${quotationRes.id}`);
    } catch {
      toast({ variant: "destructive", title: "Processing failed", description: "An error occurred while processing the PDF." });
    } finally {
      setIsUploading(false);
      setUploadProgress("");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0]);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "extracted":
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Extracted
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <AlertCircle className="w-3 h-3 mr-1" /> Failed
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Clock className="w-3 h-3 mr-1" /> Pending
          </Badge>
        );
    }
  };

  const getSourceBadge = (email: { senderEmail?: string | null; subject?: string | null }) => {
    const isEmail = email.senderEmail && !email.subject?.startsWith("Uploaded:");
    return isEmail ? (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-violet-300 text-violet-600">
        <Mail className="w-2.5 h-2.5 mr-0.5" /> Email
      </Badge>
    ) : (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-300 text-slate-500">
        <UploadCloud className="w-2.5 h-2.5 mr-0.5" /> Upload
      </Badge>
    );
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Inbox</h1>
        <p className="text-muted-foreground">Upload PDFs or receive quotations by email automatically.</p>
      </div>

      {/* ── Upload zone (primary action) ────────────── */}
      <div
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer
          ${isDragging
            ? "border-primary bg-primary/10 shadow-lg scale-[1.01]"
            : "border-primary/30 bg-gradient-to-br from-primary/5 via-background to-blue-50/50 dark:to-blue-950/20 hover:border-primary/60 hover:shadow-md"
          }
          ${isUploading ? "pointer-events-none opacity-80" : ""}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && document.getElementById("pdf-upload")?.click()}
      >
        <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-5 shadow-sm transition-transform
            ${isDragging ? "scale-110 bg-primary text-primary-foreground" : "bg-white dark:bg-card border border-border text-primary"}
          `}>
            {isUploading
              ? <Loader2 className="w-9 h-9 animate-spin" />
              : <UploadCloud className="w-9 h-9" />
            }
          </div>

          {isUploading ? (
            <div className="space-y-2">
              <p className="text-lg font-semibold text-foreground">{uploadProgress}</p>
              <p className="text-sm text-muted-foreground">Please wait while AI processes your document…</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xl font-bold text-foreground">
                {isDragging ? "Drop to extract" : "Drop your quotation PDF here"}
              </p>
              <p className="text-sm text-muted-foreground max-w-sm">
                AI will instantly extract customer name, pricing, part numbers, and all line items.
              </p>
              <div className="pt-3">
                <Button
                  size="lg"
                  className="gap-2 px-8"
                  onClick={(e) => { e.stopPropagation(); document.getElementById("pdf-upload")?.click(); }}
                >
                  <UploadCloud className="w-4 h-4" />
                  Select PDF File
                </Button>
              </div>
              <p className="text-xs text-muted-foreground/60 pt-1">
                Supports any text-based PDF quotation
              </p>
            </div>
          )}
        </div>
        <input id="pdf-upload" type="file" accept="application/pdf" className="hidden" onChange={handleFileInput} />
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <div className="p-6 pb-2">
          <h2 className="text-xl font-semibold">Processed Documents</h2>
        </div>
        <CardContent className="flex-1 overflow-auto p-0">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>File / Subject</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : emails && emails.length > 0 ? (
                emails.map((email) => {
                  const quotationId = emailToQuotationId[email.id];
                  return (
                    <TableRow key={email.id} className="group">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <File className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[220px]">
                            {email.pdfFilename || email.subject || "Untitled"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getSourceBadge(email)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {email.senderName || email.senderEmail || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {email.receivedAt ? format(new Date(email.receivedAt), "MMM d, yyyy HH:mm") : "—"}
                      </TableCell>
                      <TableCell>{getStatusBadge(email.status)}</TableCell>
                      <TableCell className="text-right">
                        {email.status === "extracted" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setLocation(quotationId ? `/quotations/${quotationId}` : "/quotations")}
                          >
                            View Details <ArrowRight className="w-4 h-4 ml-1" />
                          </Button>
                        )}
                        {email.status === "processing" && (
                          <span className="text-xs text-muted-foreground italic">Extracting...</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                    No documents yet. Upload a PDF manually or configure email integration in Settings.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
