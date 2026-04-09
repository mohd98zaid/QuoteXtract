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
  FileStack,
  Eye,
  RefreshCw,
  X,
  User,
  Calendar,
  Paperclip,
  ChevronRight,
} from "lucide-react";
import {
  useListEmails,
  useUploadPdf,
  useCreateEmail,
  useExtractQuotation,
  useListQuotations,
  useTrackMailPdf,
  getListEmailsQueryKey,
} from "@workspace/api-client-react";
import type { Email } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TabKey = "upload" | "documents";

function getStatusBadge(status: string) {
  switch (status) {
    case "extracted":
      return (
        <Badge className="bg-green-500 hover:bg-green-600 text-white text-[10px] px-2 py-0.5">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Extracted
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="text-[10px] px-2 py-0.5">
          <AlertCircle className="w-3 h-3 mr-1" /> Failed
        </Badge>
      );
    case "processing":
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-[10px] px-2 py-0.5">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px] px-2 py-0.5">
          <Clock className="w-3 h-3 mr-1" /> Pending
        </Badge>
      );
  }
}

function getSourceBadge(email: { senderEmail?: string | null; subject?: string | null }) {
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
}

interface EmailPreviewDialogProps {
  email: Email | null;
  quotationId: number | undefined;
  open: boolean;
  onClose: () => void;
  onTracked: (quotationId: number) => void;
}

function EmailPreviewDialog({ email, quotationId, open, onClose, onTracked }: EmailPreviewDialogProps) {
  const { toast } = useToast();
  const trackMut = useTrackMailPdf();
  const queryClient = useQueryClient();

  const canTrack = email && email.pdfStorageKey && email.source === "imap" &&
    (email.status === "pending" || email.status === "failed");

  const handleTrack = async () => {
    if (!email) return;
    try {
      const result = await trackMut.mutateAsync({ id: email.id });
      queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
      if (result.alreadyTracked) {
        toast({ title: "Already tracked", description: "This PDF is already in your quotations." });
      } else {
        toast({ title: "PDF tracked!", description: "Quotation extracted and saved." });
      }
      onClose();
      onTracked(result.quotationId);
    } catch {
      toast({ variant: "destructive", title: "Tracking failed", description: "Could not extract the PDF. Try again." });
    }
  };

  if (!email) return null;

  const isEmail = email.senderEmail && !email.subject?.startsWith("Uploaded:");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-full max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold leading-tight line-clamp-2">
                {email.subject || email.pdfFilename || "Untitled"}
              </DialogTitle>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                {isEmail && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {email.senderName ? `${email.senderName}${email.senderEmail ? ` <${email.senderEmail}>` : ""}` : email.senderEmail}
                  </span>
                )}
                {email.receivedAt && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(email.receivedAt), "MMM d, yyyy · HH:mm")}
                  </span>
                )}
                {email.pdfFilename && (
                  <span className="flex items-center gap-1 text-violet-600 font-medium">
                    <Paperclip className="w-3 h-3" />
                    {email.pdfFilename}
                  </span>
                )}
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              {getStatusBadge(email.status)}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {email.bodyText || email.bodyHtml ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {email.bodyHtml ? (
                <div
                  className="text-sm text-foreground/80 leading-relaxed [&_a]:text-primary [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
                />
              ) : (
                <pre className="whitespace-pre-wrap text-sm text-foreground/80 font-sans leading-relaxed">
                  {email.bodyText}
                </pre>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
              <Mail className="w-10 h-10 opacity-20" />
              <p className="text-sm">No email body available.</p>
              {email.pdfFilename && (
                <p className="text-xs opacity-70">The quotation data is inside the attached PDF.</p>
              )}
            </div>
          )}
        </div>

        <div className="border-t px-6 py-4 shrink-0 bg-muted/30 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {email.pdfFilename
              ? <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" /> {email.pdfFilename}</span>
              : "No PDF attachment"}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            {email.status === "extracted" && quotationId && (
              <Button size="sm" onClick={() => { onClose(); onTracked(quotationId); }}>
                View Quotation <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}
            {canTrack && (
              <Button size="sm" disabled={trackMut.isPending} onClick={handleTrack}>
                {trackMut.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Extracting…</>
                ) : (
                  <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Track PDF</>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Inbox() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabKey>("documents");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

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
      setUploadProgress("Uploading PDF…");
      const uploadRes = await uploadPdfMut.mutateAsync({ data: { file } });
      setUploadProgress("Creating record…");
      const emailRes = await createEmailMut.mutateAsync({
        data: {
          subject: `Uploaded: ${file.name}`,
          pdfFilename: uploadRes.filename,
          pdfStorageKey: uploadRes.storageKey,
          receivedAt: new Date().toISOString(),
        },
      });
      queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
      setUploadProgress("Extracting data via AI…");
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

  const processedCount = emails?.length ?? 0;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header bar */}
      <div className="shrink-0 border-b border-border bg-card px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground leading-tight">Upload & Documents</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Upload PDFs or review emails and extract quotation data with AI.</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center rounded-lg border border-border bg-muted p-0.5 text-sm">
            <button
              onClick={() => setActiveTab("upload")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "upload"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Upload PDF
            </button>
            <button
              onClick={() => setActiveTab("documents")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "documents"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileStack className="w-3.5 h-3.5" />
              Documents
              {processedCount > 0 && (
                <span className="ml-0.5 bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {processedCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "upload" ? (
          /* ── Upload tab ─────────────────────────────────────────── */
          <div className="h-full p-6">
            <div
              className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer h-full
                ${isDragging
                  ? "border-primary bg-primary/10 shadow-lg scale-[1.005]"
                  : "border-primary/30 bg-gradient-to-br from-primary/5 via-background to-blue-50/50 dark:to-blue-950/20 hover:border-primary/60 hover:shadow-md"
                }
                ${isUploading ? "pointer-events-none opacity-80" : ""}
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isUploading && document.getElementById("pdf-upload")?.click()}
            >
              <div className="flex flex-col items-center justify-center h-full py-20 px-6 text-center">
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
                    <p className="text-2xl font-bold text-foreground">
                      {isDragging ? "Drop to extract" : "Drop your quotation PDF here"}
                    </p>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      AI will instantly extract customer name, pricing, part numbers, and all line items.
                    </p>
                    <div className="pt-4">
                      <Button
                        size="lg"
                        className="gap-2 px-10"
                        onClick={(e) => { e.stopPropagation(); document.getElementById("pdf-upload")?.click(); }}
                      >
                        <UploadCloud className="w-4 h-4" />
                        Select PDF File
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground/60 pt-1">Supports any text-based PDF quotation</p>
                  </div>
                )}
              </div>
              <input id="pdf-upload" type="file" accept="application/pdf" className="hidden" onChange={handleFileInput} />
            </div>
          </div>
        ) : (
          /* ── Documents tab ──────────────────────────────────────── */
          <div className="h-full overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="pl-6">File / Subject</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-40 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : emails && emails.length > 0 ? (
                  emails.map((email) => {
                    const quotationId = emailToQuotationId[email.id];
                    const isPending = email.status === "pending" || email.status === "failed";
                    return (
                      <TableRow
                        key={email.id}
                        className="group cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedEmail(email)}
                      >
                        <TableCell className="pl-6 font-medium">
                          <div className="flex items-center gap-2">
                            <File className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[220px] text-sm">
                              {email.pdfFilename || email.subject || "Untitled"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getSourceBadge(email)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {email.senderName || email.senderEmail || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {email.receivedAt
                            ? format(new Date(email.receivedAt), "MMM d, yyyy HH:mm")
                            : "—"}
                        </TableCell>
                        <TableCell>{getStatusBadge(email.status)}</TableCell>
                        <TableCell className="pr-6 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {email.status === "extracted" && quotationId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={(e) => { e.stopPropagation(); setLocation(`/quotations/${quotationId}`); }}
                              >
                                View <ArrowRight className="w-3.5 h-3.5 ml-1" />
                              </Button>
                            )}
                            {(isPending && email.pdfStorageKey) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-primary hover:text-primary"
                                onClick={(e) => { e.stopPropagation(); setSelectedEmail(email); }}
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" /> Review
                              </Button>
                            )}
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <FileStack className="w-10 h-10 opacity-20" />
                        <p className="text-sm">No documents yet.</p>
                        <Button variant="outline" size="sm" onClick={() => setActiveTab("upload")}>
                          Upload your first PDF
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Email preview dialog */}
      <EmailPreviewDialog
        email={selectedEmail}
        quotationId={selectedEmail ? emailToQuotationId[selectedEmail.id] : undefined}
        open={!!selectedEmail}
        onClose={() => setSelectedEmail(null)}
        onTracked={(qId) => setLocation(`/quotations/${qId}`)}
      />
    </div>
  );
}
