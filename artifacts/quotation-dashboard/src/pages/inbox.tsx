import { useState, useCallback, useMemo, useRef } from "react";
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
  User,
  Calendar,
  Paperclip,
  ChevronRight,
  XCircle,
  Files,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const canTrack =
    email && email.pdfStorageKey && email.source === "imap" &&
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
                    {email.senderName
                      ? `${email.senderName}${email.senderEmail ? ` <${email.senderEmail}>` : ""}`
                      : email.senderEmail}
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
            <div className="shrink-0">{getStatusBadge(email.status)}</div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {email.bodyText || email.bodyHtml ? (
            email.bodyHtml ? (
              <div
                className="text-sm text-foreground/80 leading-relaxed [&_a]:text-primary [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
              />
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-foreground/80 font-sans leading-relaxed">
                {email.bodyText}
              </pre>
            )
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
            {email.pdfFilename ? (
              <span className="flex items-center gap-1">
                <Paperclip className="w-3 h-3" /> {email.pdfFilename}
              </span>
            ) : (
              "No PDF attachment"
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
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

type QueueStatus = "queued" | "uploading" | "extracting" | "done" | "failed";

interface FileQueueItem {
  id: string;
  file: File;
  status: QueueStatus;
  quotationId?: number;
  error?: string;
}

function QueueStatusIcon({ status }: { status: QueueStatus }) {
  if (status === "done") return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
  if (status === "failed") return <XCircle className="w-4 h-4 text-destructive shrink-0" />;
  if (status === "uploading" || status === "extracting")
    return <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />;
  return <Clock className="w-4 h-4 text-muted-foreground shrink-0" />;
}

function queueStatusLabel(status: QueueStatus) {
  if (status === "queued") return "Queued";
  if (status === "uploading") return "Uploading…";
  if (status === "extracting") return "AI Extracting…";
  if (status === "done") return "Done";
  return "Failed";
}

type SortField = "subject" | "source" | "sender" | "received" | "status";
type SortDir = "asc" | "desc";

function SortableHead({
  label,
  field,
  current,
  dir,
  onSort,
  className = "",
}: {
  label: string;
  field: SortField;
  current: SortField | null;
  dir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const active = current === field;
  return (
    <th
      className={`h-10 px-4 text-left align-middle text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors ${className}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          dir === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
        ) : (
          <ChevronsUpDown className="w-3 h-3 opacity-40" />
        )}
      </span>
    </th>
  );
}

export default function Inbox() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDragging, setIsDragging] = useState(false);
  const [fileQueue, setFileQueue] = useState<FileQueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("documents");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sortField, setSortField] = useState<SortField | null>("received");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

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

  const updateItem = (id: string, patch: Partial<FileQueueItem>) =>
    setFileQueue((q) => q.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const processFiles = async (files: File[]) => {
    const pdfs = files.filter((f) => f.type === "application/pdf");
    const invalid = files.length - pdfs.length;
    if (invalid > 0) {
      toast({ variant: "destructive", title: `${invalid} file(s) skipped`, description: "Only PDF files are supported." });
    }
    if (pdfs.length === 0) return;

    const newItems: FileQueueItem[] = pdfs.map((f) => ({
      id: `${Date.now()}-${Math.random()}`,
      file: f,
      status: "queued",
    }));
    setFileQueue((q) => [...q, ...newItems]);
    setIsProcessing(true);

    let doneCount = 0;
    let failCount = 0;
    const doneQuotationIds: number[] = [];

    for (const item of newItems) {
      try {
        updateItem(item.id, { status: "uploading" });
        const uploadRes = await uploadPdfMut.mutateAsync({ data: { file: item.file } });

        updateItem(item.id, { status: "extracting" });
        const emailRes = await createEmailMut.mutateAsync({
          data: {
            subject: `Uploaded: ${item.file.name}`,
            pdfFilename: uploadRes.filename,
            pdfStorageKey: uploadRes.storageKey,
            receivedAt: new Date().toISOString(),
          },
        });

        const quotationRes = await extractMut.mutateAsync({
          data: { emailId: emailRes.id, pdfStorageKey: uploadRes.storageKey },
        });

        updateItem(item.id, { status: "done", quotationId: quotationRes.id });
        doneQuotationIds.push(quotationRes.id);
        doneCount++;
      } catch {
        updateItem(item.id, { status: "failed", error: "Processing failed" });
        failCount++;
      }
    }

    queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });
    setIsProcessing(false);

    if (doneCount > 0 && failCount === 0) {
      toast({ title: `${doneCount} PDF${doneCount > 1 ? "s" : ""} extracted`, description: "All quotations processed successfully." });
      if (doneCount === 1 && doneQuotationIds.length === 1) {
        setLocation(`/quotations/${doneQuotationIds[0]}`);
      }
    } else if (failCount > 0) {
      toast({ variant: "destructive", title: `${failCount} file(s) failed`, description: `${doneCount} succeeded, ${failCount} failed.` });
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) processFiles(files);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) processFiles(files);
    e.target.value = "";
  };

  const emailsWithPdf = useMemo(() => {
    const filtered = (emails ?? []).filter((e) => !!e.pdfStorageKey);
    if (!sortField) return filtered;
    return [...filtered].sort((a, b) => {
      let aVal = "";
      let bVal = "";
      if (sortField === "subject") {
        aVal = (a.pdfFilename || a.subject || "").toLowerCase();
        bVal = (b.pdfFilename || b.subject || "").toLowerCase();
      } else if (sortField === "source") {
        aVal = a.senderEmail && !a.subject?.startsWith("Uploaded:") ? "email" : "upload";
        bVal = b.senderEmail && !b.subject?.startsWith("Uploaded:") ? "email" : "upload";
      } else if (sortField === "sender") {
        aVal = (a.senderName || a.senderEmail || "").toLowerCase();
        bVal = (b.senderName || b.senderEmail || "").toLowerCase();
      } else if (sortField === "received") {
        aVal = a.receivedAt ?? "";
        bVal = b.receivedAt ?? "";
      } else if (sortField === "status") {
        aVal = a.status ?? "";
        bVal = b.status ?? "";
      }
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [emails, sortField, sortDir]);

  const processedCount = emailsWithPdf.length;
  const hasQueue = fileQueue.length > 0;

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Upload</h1>
        <p className="text-muted-foreground">Extract quotation data from PDF files using AI.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-fit">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <UploadCloud className="w-4 h-4" />
            Upload PDF
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileStack className="w-4 h-4" />
            Processed Documents
            {processedCount > 0 && (
              <span className="ml-1 bg-muted text-muted-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {processedCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Upload ────────────────────────────────── */}
        <TabsContent value="upload" className="flex-1 mt-4 flex flex-col gap-4 min-h-0">
          {/* Drop zone */}
          <div
            className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer
              ${hasQueue ? "py-6" : "flex-1"}
              ${isDragging
                ? "border-primary bg-primary/10 shadow-lg scale-[1.005]"
                : "border-primary/30 bg-gradient-to-br from-primary/5 via-background to-blue-50/50 dark:to-blue-950/20 hover:border-primary/60 hover:shadow-md"
              }
              ${isProcessing ? "pointer-events-none opacity-80" : ""}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
          >
            <div className={`flex flex-col items-center justify-center px-6 text-center ${hasQueue ? "py-6" : "py-20 h-full"}`}>
              <div className={`rounded-2xl flex items-center justify-center mb-4 shadow-sm transition-transform
                ${hasQueue ? "w-12 h-12" : "w-20 h-20 mb-5"}
                ${isDragging ? "scale-110 bg-primary text-primary-foreground" : "bg-white dark:bg-card border border-border text-primary"}
              `}>
                {isProcessing
                  ? <Loader2 className={hasQueue ? "w-6 h-6 animate-spin" : "w-9 h-9 animate-spin"} />
                  : <UploadCloud className={hasQueue ? "w-6 h-6" : "w-9 h-9"} />
                }
              </div>
              {hasQueue ? (
                <div className="space-y-1">
                  <p className="text-base font-semibold text-foreground">
                    {isDragging ? "Drop more PDFs" : "Drop more PDFs or click to add"}
                  </p>
                  <p className="text-xs text-muted-foreground">You can add more files while others are processing</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-foreground">
                    {isDragging ? "Drop to extract" : "Drop your quotation PDFs here"}
                  </p>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    AI will extract customer name, pricing, part numbers, and line items from each PDF.
                  </p>
                  <div className="pt-4 flex items-center justify-center">
                    <Button
                      size="lg"
                      className="gap-2 px-8"
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    >
                      <UploadCloud className="w-4 h-4" />
                      Select PDFs
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground/60 pt-1">Select one or multiple PDFs at once for batch processing</p>
                </div>
              )}
            </div>
            <input ref={fileInputRef} id="pdf-upload" type="file" accept="application/pdf" multiple className="hidden" onChange={handleFileInput} />
          </div>

          {/* Queue list */}
          {hasQueue && (
            <div className="rounded-xl border bg-card overflow-hidden flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30 shrink-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Files className="w-4 h-4 text-primary" />
                  Processing Queue
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    {fileQueue.filter((i) => i.status === "done").length}/{fileQueue.length} complete
                  </span>
                </div>
                {!isProcessing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => setFileQueue([])}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <div className="overflow-y-auto flex-1">
                {fileQueue.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <QueueStatusIcon status={item.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-foreground">{item.file.name}</p>
                      <p className={`text-xs mt-0.5 ${
                        item.status === "done" ? "text-green-600 dark:text-green-400" :
                        item.status === "failed" ? "text-destructive" :
                        item.status === "queued" ? "text-muted-foreground" :
                        "text-primary"
                      }`}>
                        {item.error ?? queueStatusLabel(item.status)}
                      </p>
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground">
                      {(item.file.size / 1024).toFixed(0)} KB
                    </div>
                    {item.status === "done" && item.quotationId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs shrink-0"
                        onClick={() => setLocation(`/quotations/${item.quotationId}`)}
                      >
                        View <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Processed Documents ───────────────────── */}
        <TabsContent value="documents" className="flex-1 flex flex-col min-h-0 mt-4">
          <div className="flex-1 rounded-xl border bg-card overflow-hidden flex flex-col min-h-0">
            <div className="overflow-auto flex-1">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                  <tr>
                    <SortableHead label="File / Subject" field="subject" current={sortField} dir={sortDir} onSort={handleSort} />
                    <SortableHead label="Source" field="source" current={sortField} dir={sortDir} onSort={handleSort} />
                    <SortableHead label="Sender" field="sender" current={sortField} dir={sortDir} onSort={handleSort} />
                    <SortableHead label="Received" field="received" current={sortField} dir={sortDir} onSort={handleSort} />
                    <SortableHead label="Status" field="status" current={sortField} dir={sortDir} onSort={handleSort} />
                    <th className="h-10 px-4 text-right align-middle text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                  </tr>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : emailsWithPdf.length > 0 ? (
                    emailsWithPdf.map((email) => {
                      const quotationId = emailToQuotationId[email.id];
                      const canReview =
                        email.source === "imap" &&
                        (email.status === "pending" || email.status === "failed");
                      return (
                        <TableRow
                          key={email.id}
                          className="group cursor-pointer hover:bg-muted/40 transition-colors"
                          onClick={() => setSelectedEmail(email)}
                        >
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
                            {email.receivedAt
                              ? format(new Date(email.receivedAt), "MMM d, yyyy HH:mm")
                              : "—"}
                          </TableCell>
                          <TableCell>{getStatusBadge(email.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {email.status === "extracted" && quotationId ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={(e) => { e.stopPropagation(); setLocation(`/quotations/${quotationId}`); }}
                                >
                                  View Details <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                </Button>
                              ) : canReview ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-primary hover:text-primary"
                                  onClick={(e) => { e.stopPropagation(); setSelectedEmail(email); }}
                                >
                                  <Eye className="w-3.5 h-3.5 mr-1" /> Review & Track
                                </Button>
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              )}
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
          </div>
        </TabsContent>
      </Tabs>

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
