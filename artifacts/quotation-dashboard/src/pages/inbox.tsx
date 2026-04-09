import { useState, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { UploadCloud, File, AlertCircle, CheckCircle2, Clock, Loader2, ArrowRight } from "lucide-react";
import {
  useListEmails,
  useUploadPdf,
  useCreateEmail,
  useExtractQuotation,
  useListQuotations,
  getListEmailsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload a PDF file.",
      });
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress("Uploading PDF...");

      const uploadRes = await uploadPdfMut.mutateAsync({ data: { file } });

      setUploadProgress("Creating email record...");

      const emailRes = await createEmailMut.mutateAsync({
        data: {
          subject: `Uploaded: ${file.name}`,
          pdfFilename: uploadRes.filename,
          pdfStorageKey: uploadRes.storageKey,
          receivedAt: new Date().toISOString()
        }
      });

      queryClient.invalidateQueries({ queryKey: getListEmailsQueryKey() });

      setUploadProgress("Extracting data via AI...");

      const quotationRes = await extractMut.mutateAsync({
        data: {
          emailId: emailRes.id,
          pdfStorageKey: uploadRes.storageKey
        }
      });

      toast({
        title: "Extraction complete",
        description: "Successfully processed the quotation.",
      });

      setLocation(`/quotations/${quotationRes.id}`);

    } catch (error) {
      console.error("Upload process failed:", error);
      toast({
        variant: "destructive",
        title: "Processing failed",
        description: "An error occurred while processing the PDF.",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress("");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'extracted':
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Extracted</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      case 'processing':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Inbox</h1>
        <p className="text-muted-foreground">Upload and process PDF quotations.</p>
      </div>

      <Card
        className={`border-2 border-dashed transition-all duration-200 ease-in-out ${
          isDragging
            ? "border-primary bg-primary/5 shadow-md"
            : "border-border hover:border-primary/50 hover:bg-muted/50"
        } ${isUploading ? "pointer-events-none opacity-80" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
            {isUploading ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8" />
            )}
          </div>

          <h3 className="text-xl font-semibold mb-2">
            {isUploading ? uploadProgress : "Drop your quotation PDF here"}
          </h3>

          {!isUploading && (
            <>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                The AI will automatically extract supplier details, items, pricing, and terms.
              </p>

              <div className="flex items-center gap-4">
                <Button onClick={() => document.getElementById('pdf-upload')?.click()} className="relative">
                  Select File
                </Button>
                <input
                  id="pdf-upload"
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col min-h-0">
        <div className="p-6 pb-2">
          <h2 className="text-xl font-semibold">Processed Documents</h2>
        </div>
        <CardContent className="flex-1 overflow-auto p-0">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>File / Subject</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
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
                          <File className="w-4 h-4 text-muted-foreground" />
                          <span className="truncate max-w-[250px]">{email.pdfFilename || email.subject || 'Untitled'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{email.senderName || email.senderEmail || 'System Upload'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {email.receivedAt ? format(new Date(email.receivedAt), 'MMM d, yyyy HH:mm') : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(email.status)}</TableCell>
                      <TableCell className="text-right">
                        {email.status === 'extracted' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              if (quotationId) {
                                setLocation(`/quotations/${quotationId}`);
                              } else {
                                setLocation('/quotations');
                              }
                            }}
                          >
                            View Details <ArrowRight className="w-4 h-4 ml-1" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                    No documents found. Upload a PDF to get started.
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
