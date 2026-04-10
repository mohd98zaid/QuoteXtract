import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import {
  CheckCircle, XCircle, Clock, FileText, Download, Edit2, Save, X, ArrowLeft, Trash2, Plus, Maximize2, ExternalLink, MoreHorizontal, RefreshCw, History, AlertTriangle
} from "lucide-react";
import {
  useGetQuotation,
  useUpdateQuotation,
  useDeleteQuotation,
  useUpdateItem,
  useDeleteItem,
  useCreateItem,
  getGetQuotationQueryKey,
  getListQuotationsQueryKey
} from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const EMPTY_ITEM = {
  partNumber: "",
  description: "",
  quantity: "",
  unitPrice: "",
  totalPrice: "",
  leadTime: "",
  moq: "",
  currency: "",
  notes: "",
};

interface QuotationEvent {
  id: number;
  quotationId: number;
  eventType: string;
  oldValue: string | null;
  newValue: string | null;
  note: string | null;
  createdAt: string;
}

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  created: { label: "Created", color: "text-indigo-500" },
  status_changed: { label: "Status Changed", color: "text-blue-500" },
  updated: { label: "Fields Updated", color: "text-yellow-500" },
  re_extracted: { label: "Re-extracted", color: "text-purple-500" },
  item_added: { label: "Item Added", color: "text-green-500" },
  item_deleted: { label: "Item Removed", color: "text-red-500" },
};

export default function QuotationDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const quotationId = parseInt(id || "0", 10);

  const { data: quotation, isLoading } = useGetQuotation(quotationId, {
    query: { enabled: !!quotationId }
  });

  const { data: events } = useQuery<QuotationEvent[]>({
    queryKey: ["quotation-events", quotationId],
    queryFn: async () => {
      const res = await fetch(`/api/quotations/${quotationId}/events`);
      return res.json();
    },
    enabled: !!quotationId,
    staleTime: 10_000,
  });

  const updateQuotationMut = useUpdateQuotation();
  const updateItemMut = useUpdateItem();
  const deleteItemMut = useDeleteItem();
  const createItemMut = useCreateItem();
  const deleteQuotationMut = useDeleteQuotation();

  const reExtractMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/quotations/${quotationId}/re-extract`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Re-extraction failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetQuotationQueryKey(quotationId) });
      queryClient.invalidateQueries({ queryKey: ["quotation-events", quotationId] });
      queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
      toast({ title: "Re-extraction complete", description: "AI has re-read the PDF and updated all fields." });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Re-extraction failed", description: err.message });
    },
  });

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [itemFormData, setItemFormData] = useState<any>({});

  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemData, setNewItemData] = useState<any>(EMPTY_ITEM);

  const [pdfFullScreen, setPdfFullScreen] = useState(false);
  const [showReExtractConfirm, setShowReExtractConfirm] = useState(false);

  useEffect(() => {
    if (quotation && !isEditing) {
      setFormData({
        supplierName: quotation.supplierName || "",
        quotationNumber: quotation.quotationNumber || "",
        quotationDate: quotation.quotationDate || "",
        currency: quotation.currency || "",
        paymentTerms: quotation.paymentTerms || "",
        deliveryTerms: quotation.deliveryTerms || "",
        totalAmount: quotation.totalAmount || "",
        notes: quotation.notes || ""
      });
    }
  }, [quotation, isEditing]);

  const handleHeaderSave = async () => {
    try {
      await updateQuotationMut.mutateAsync({ id: quotationId, data: formData });
      queryClient.setQueryData(getGetQuotationQueryKey(quotationId), (old: any) =>
        old ? { ...old, ...formData } : old
      );
      queryClient.invalidateQueries({ queryKey: ["quotation-events", quotationId] });
      setIsEditing(false);
      toast({ title: "Quotation updated" });
    } catch {
      toast({ variant: "destructive", title: "Update failed" });
    }
  };

  const handleStatusChange = async (newStatus: "reviewed" | "approved" | "rejected" | "draft") => {
    try {
      await updateQuotationMut.mutateAsync({ id: quotationId, data: { status: newStatus } });
      queryClient.setQueryData(getGetQuotationQueryKey(quotationId), (old: any) =>
        old ? { ...old, status: newStatus } : old
      );
      queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["quotation-events", quotationId] });
      toast({ title: `Status changed to ${newStatus}` });
    } catch {
      toast({ variant: "destructive", title: "Status update failed" });
    }
  };

  const startItemEdit = (item: any) => {
    setEditingItemId(item.id);
    setItemFormData({
      partNumber: item.partNumber || "",
      description: item.description || "",
      quantity: item.quantity || "",
      unitPrice: item.unitPrice || "",
      totalPrice: item.totalPrice || "",
      leadTime: item.leadTime || "",
      moq: item.moq || "",
      currency: item.currency || "",
      notes: item.notes || "",
    });
  };

  const saveItemEdit = async () => {
    if (!editingItemId) return;
    try {
      await updateItemMut.mutateAsync({ id: editingItemId, data: itemFormData });
      queryClient.invalidateQueries({ queryKey: getGetQuotationQueryKey(quotationId) });
      setEditingItemId(null);
      toast({ title: "Item updated" });
    } catch {
      toast({ variant: "destructive", title: "Item update failed" });
    }
  };

  const deleteItem = async (itemId: number) => {
    if (!confirm("Delete this line item?")) return;
    try {
      await deleteItemMut.mutateAsync({ id: itemId });
      queryClient.invalidateQueries({ queryKey: getGetQuotationQueryKey(quotationId) });
      queryClient.invalidateQueries({ queryKey: ["quotation-events", quotationId] });
      toast({ title: "Item deleted" });
    } catch {
      toast({ variant: "destructive", title: "Failed to delete item" });
    }
  };

  const handleAddItem = async () => {
    try {
      await createItemMut.mutateAsync({ id: quotationId, data: newItemData });
      queryClient.invalidateQueries({ queryKey: getGetQuotationQueryKey(quotationId) });
      queryClient.invalidateQueries({ queryKey: ["quotation-events", quotationId] });
      setShowAddItem(false);
      setNewItemData(EMPTY_ITEM);
      toast({ title: "Item added" });
    } catch {
      toast({ variant: "destructive", title: "Failed to add item" });
    }
  };

  const handleDeleteQuotation = async () => {
    if (!confirm("Are you sure you want to delete this quotation entirely?")) return;
    try {
      await deleteQuotationMut.mutateAsync({ id: quotationId });
      queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
      toast({ title: "Quotation deleted" });
      setLocation("/inbox");
    } catch {
      toast({ variant: "destructive", title: "Failed to delete quotation" });
    }
  };

  const pdfDownloadUrl = quotation?.pdfStorageKey
    ? `/api/pdfs/${quotation.pdfStorageKey}`
    : null;

  if (isLoading || !quotation) {
    return <div className="p-8"><Skeleton className="h-[600px] w-full" /></div>;
  }

  const score = quotation.extractionScore ?? 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="w-4 h-4 mr-1" /> Approved</Badge>;
      case 'rejected': return <Badge variant="destructive"><XCircle className="w-4 h-4 mr-1" /> Rejected</Badge>;
      case 'reviewed': return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"><CheckCircle className="w-4 h-4 mr-1" /> Reviewed</Badge>;
      default: return <Badge variant="outline"><Clock className="w-4 h-4 mr-1" /> Draft</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between bg-card p-4 rounded-lg shadow-sm border border-border">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation('/quotations')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{quotation.supplierName || 'Unknown Customer'}</h1>
            <div className="text-sm text-muted-foreground font-mono">{quotation.quotationNumber || 'No Ref'}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-destructive hover:bg-destructive/10" 
            onClick={handleDeleteQuotation} 
            disabled={deleteQuotationMut.isPending} 
            title="Delete Quotation"
          >
            <Trash2 className="w-5 h-5" />
          </Button>

          {getStatusBadge(quotation.status)}

          <Separator orientation="vertical" className="h-8 mx-2" />

          {quotation.status === 'draft' && (
            <Button variant="secondary" onClick={() => handleStatusChange('reviewed')}>Mark Reviewed</Button>
          )}
          {(quotation.status === 'draft' || quotation.status === 'reviewed') && (
            <div className="flex gap-2">
              <Button variant="destructive" onClick={() => handleStatusChange('rejected')}>Reject</Button>
              <Button onClick={() => handleStatusChange('approved')} className="bg-green-600 hover:bg-green-700">Approve</Button>
            </div>
          )}
          {quotation.status === 'approved' && (
            <Button variant="outline" onClick={() => handleStatusChange('draft')}>Reopen Draft</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Quotation Details</CardTitle>
              {isEditing ? (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleHeaderSave} disabled={updateQuotationMut.isPending}>
                    {updateQuotationMut.isPending ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save</>}
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit2 className="w-4 h-4 mr-2" /> Edit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Customer</label>
                  {isEditing ? (
                    <Input value={formData.supplierName} onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })} />
                  ) : (
                    <div className="font-medium">{quotation.supplierName || '-'}</div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Reference</label>
                  {isEditing ? (
                    <Input value={formData.quotationNumber} onChange={(e) => setFormData({ ...formData, quotationNumber: e.target.value })} />
                  ) : (
                    <div className="font-medium font-mono">{quotation.quotationNumber || '-'}</div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Date</label>
                  {isEditing ? (
                    <Input type="date" value={formData.quotationDate} onChange={(e) => setFormData({ ...formData, quotationDate: e.target.value })} />
                  ) : (
                    <div className="font-medium">{quotation.quotationDate || '-'}</div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Currency</label>
                  {isEditing ? (
                    <Input value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} />
                  ) : (
                    <div className="font-medium">{quotation.currency || '-'}</div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Total Amount</label>
                  {isEditing ? (
                    <Input value={formData.totalAmount} onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })} />
                  ) : (
                    <div className="font-medium text-lg text-primary">{quotation.totalAmount || '-'}</div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Payment Terms</label>
                  {isEditing ? (
                    <Input value={formData.paymentTerms} onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })} />
                  ) : (
                    <div className="font-medium">{quotation.paymentTerms || '-'}</div>
                  )}
                </div>
              </div>

              <div className="mt-6 space-y-1 border-t pt-4">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Notes / Delivery Terms</label>
                {isEditing ? (
                  <div className="grid gap-4">
                    <Input placeholder="Delivery terms..." value={formData.deliveryTerms} onChange={(e) => setFormData({ ...formData, deliveryTerms: e.target.value })} />
                    <Textarea placeholder="Additional notes..." value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} />
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-wrap">
                    {quotation.deliveryTerms && <div><span className="font-medium">Delivery:</span> {quotation.deliveryTerms}</div>}
                    {quotation.notes && <div className="mt-2 text-muted-foreground">{quotation.notes}</div>}
                    {!quotation.deliveryTerms && !quotation.notes && '-'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Line Items</CardTitle>
              <Button variant="outline" size="sm" onClick={() => { setNewItemData(EMPTY_ITEM); setShowAddItem(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Add Item
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[110px]">Part #</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">MOQ</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Lead Time</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotation.items && quotation.items.length > 0 ? (
                    quotation.items.map((item) => (
                      <TableRow key={item.id} className="group hover:bg-muted/30">
                        {editingItemId === item.id ? (
                          <>
                            <TableCell><Input value={itemFormData.partNumber} onChange={e => setItemFormData({ ...itemFormData, partNumber: e.target.value })} className="h-8 text-sm w-[90px]" /></TableCell>
                            <TableCell><Input value={itemFormData.description} onChange={e => setItemFormData({ ...itemFormData, description: e.target.value })} className="h-8 text-sm" /></TableCell>
                            <TableCell><Input value={itemFormData.quantity} onChange={e => setItemFormData({ ...itemFormData, quantity: e.target.value })} className="h-8 text-sm w-[70px] text-right ml-auto" /></TableCell>
                            <TableCell><Input value={itemFormData.moq} onChange={e => setItemFormData({ ...itemFormData, moq: e.target.value })} className="h-8 text-sm w-[70px] text-right ml-auto" /></TableCell>
                            <TableCell><Input value={itemFormData.unitPrice} onChange={e => setItemFormData({ ...itemFormData, unitPrice: e.target.value })} className="h-8 text-sm w-[90px] text-right ml-auto" /></TableCell>
                            <TableCell><Input value={itemFormData.totalPrice} onChange={e => setItemFormData({ ...itemFormData, totalPrice: e.target.value })} className="h-8 text-sm w-[90px] text-right ml-auto" /></TableCell>
                            <TableCell><Input value={itemFormData.leadTime} onChange={e => setItemFormData({ ...itemFormData, leadTime: e.target.value })} className="h-8 text-sm w-[90px]" /></TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={saveItemEdit} disabled={updateItemMut.isPending}>
                                  <Save className="w-4 h-4 text-green-600" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingItemId(null)}>
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="font-mono text-xs">{item.partNumber || '-'}</TableCell>
                            <TableCell className="text-sm font-medium">{item.description || '-'}</TableCell>
                            <TableCell className="text-right">{item.quantity || '-'}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{item.moq || '-'}</TableCell>
                            <TableCell className="text-right">{item.unitPrice || '-'}</TableCell>
                            <TableCell className="text-right font-semibold">{item.totalPrice || '-'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{item.leadTime || '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startItemEdit(item)}>
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => deleteItem(item.id)}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                        No line items extracted. <button className="underline text-primary ml-1" onClick={() => setShowAddItem(true)}>Add one manually.</button>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* ── Sticky right column ─── */}
        <div className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Source Document</CardTitle>
              {pdfDownloadUrl && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Full screen" onClick={() => setPdfFullScreen(true)}>
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                  <a href={pdfDownloadUrl} download target="_blank" rel="noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Download">
                      <Download className="w-4 h-4" />
                    </Button>
                  </a>
                  <a href={pdfDownloadUrl} target="_blank" rel="noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Open in new tab">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </a>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {pdfDownloadUrl ? (
                <iframe
                  src={pdfDownloadUrl}
                  className="w-full rounded-b-xl border-t border-border"
                  style={{ height: "480px" }}
                  title="PDF Preview"
                />
              ) : (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-3 p-6">
                  <FileText className="w-10 h-10 opacity-20 text-primary" />
                  <p className="text-sm font-medium">No PDF available</p>
                  <p className="text-xs opacity-60">This quotation was created manually without a source document.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">AI Extraction</CardTitle>
              {pdfDownloadUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  disabled={reExtractMut.isPending}
                  onClick={() => setShowReExtractConfirm(true)}
                >
                  {reExtractMut.isPending ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  {reExtractMut.isPending ? "Extracting…" : "Re-extract"}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {score < 70 && quotation.extractionScore != null && (
                <div className="flex items-start gap-2 rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 p-3 text-sm text-yellow-800 dark:text-yellow-300">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>Low confidence — some fields may be inaccurate. Review carefully or try re-extracting.</p>
                </div>
              )}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Confidence Score</span>
                  <span className="font-medium">{score}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full ${score > 80 ? 'bg-green-500' : score > 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
              <div className="pt-2 border-t text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Extracted On</span>
                  <span>{format(new Date(quotation.createdAt), 'MMM d, yyyy')}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Source Email ID</span>
                  <span>#{quotation.emailId || '-'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Line Items</span>
                  <span>{quotation.items?.length ?? 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {events && events.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="w-4 h-4" /> Audit Trail
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="px-4 pb-4 space-y-0 max-h-72 overflow-y-auto">
                  {events.map((event, i) => {
                    const meta = EVENT_LABELS[event.eventType] ?? { label: event.eventType, color: "text-muted-foreground" };
                    return (
                      <div key={event.id} className="relative flex gap-3 py-2.5">
                        {i < events.length - 1 && (
                          <div className="absolute left-[7px] top-7 bottom-0 w-px bg-border" />
                        )}
                        <div className={`w-3.5 h-3.5 rounded-full border-2 border-background ring-2 ring-current mt-1 shrink-0 ${meta.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className={`text-xs font-semibold ${meta.color}`}>{meta.label}</div>
                          {event.eventType === "status_changed" && event.oldValue && event.newValue && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              <span className="capitalize">{event.oldValue}</span> → <span className="capitalize font-medium">{event.newValue}</span>
                            </div>
                          )}
                          {event.note && <div className="text-xs text-muted-foreground mt-0.5 truncate">{event.note}</div>}
                          <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                            {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add Item Dialog */}
      <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Line Item</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <Label>Part Number</Label>
              <Input placeholder="e.g. PN-1234" value={newItemData.partNumber} onChange={e => setNewItemData({ ...newItemData, partNumber: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Input placeholder="e.g. USD" value={newItemData.currency} onChange={e => setNewItemData({ ...newItemData, currency: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Description</Label>
              <Input placeholder="Item description..." value={newItemData.description} onChange={e => setNewItemData({ ...newItemData, description: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Quantity</Label>
              <Input placeholder="e.g. 10" value={newItemData.quantity} onChange={e => setNewItemData({ ...newItemData, quantity: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>MOQ</Label>
              <Input placeholder="e.g. 5" value={newItemData.moq} onChange={e => setNewItemData({ ...newItemData, moq: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Unit Price</Label>
              <Input placeholder="e.g. 99.99" value={newItemData.unitPrice} onChange={e => setNewItemData({ ...newItemData, unitPrice: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Total Price</Label>
              <Input placeholder="e.g. 999.90" value={newItemData.totalPrice} onChange={e => setNewItemData({ ...newItemData, totalPrice: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Lead Time</Label>
              <Input placeholder="e.g. 2 weeks" value={newItemData.leadTime} onChange={e => setNewItemData({ ...newItemData, leadTime: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItem(false)}>Cancel</Button>
            <Button onClick={handleAddItem} disabled={createItemMut.isPending}>
              {createItemMut.isPending ? "Adding…" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full screen PDF dialog */}
      <Dialog open={pdfFullScreen} onOpenChange={setPdfFullScreen}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle>PDF Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 px-4 pb-4">
            {pdfDownloadUrl && (
              <iframe src={pdfDownloadUrl} className="w-full h-full rounded border border-border" title="PDF Full Screen" />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Re-extract confirmation */}
      <AlertDialog open={showReExtractConfirm} onOpenChange={setShowReExtractConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-extract with AI?</AlertDialogTitle>
            <AlertDialogDescription>
              This will ask GPT-4o to re-read the PDF and overwrite all extracted fields and line items. Your manual edits will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowReExtractConfirm(false); reExtractMut.mutate(); }}>
              Re-extract
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
