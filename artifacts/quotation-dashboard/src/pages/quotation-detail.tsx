import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { format } from "date-fns";
import { 
  CheckCircle, XCircle, Clock, FileText, Download, Edit2, Save, X, ArrowLeft, Trash2, Plus
} from "lucide-react";
import { 
  useGetQuotation, 
  useUpdateQuotation, 
  useUpdateItem,
  useDeleteItem,
  getGetQuotationQueryKey,
  getListQuotationsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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

export default function QuotationDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const quotationId = parseInt(id || "0", 10);

  const { data: quotation, isLoading } = useGetQuotation(quotationId, {
    query: { enabled: !!quotationId }
  });

  const updateQuotationMut = useUpdateQuotation();
  const updateItemMut = useUpdateItem();
  const deleteItemMut = useDeleteItem();

  // Local state for header fields
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  
  // Local state for items
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [itemFormData, setItemFormData] = useState<any>({});

  // Initialize form data when quotation loads
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
      await updateQuotationMut.mutateAsync({
        id: quotationId,
        data: formData
      });
      
      // Update cache locally instead of full invalidation to avoid jumpiness
      queryClient.setQueryData(getGetQuotationQueryKey(quotationId), (old: any) => 
        old ? { ...old, ...formData } : old
      );
      
      setIsEditing(false);
      toast({ title: "Quotation updated" });
    } catch (error) {
      toast({ variant: "destructive", title: "Update failed" });
    }
  };

  const handleStatusChange = async (newStatus: "reviewed" | "approved" | "rejected") => {
    try {
      await updateQuotationMut.mutateAsync({
        id: quotationId,
        data: { status: newStatus }
      });
      
      queryClient.setQueryData(getGetQuotationQueryKey(quotationId), (old: any) => 
        old ? { ...old, status: newStatus } : old
      );
      queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
      
      toast({ title: `Status changed to ${newStatus}` });
    } catch (error) {
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
      leadTime: item.leadTime || ""
    });
  };

  const saveItemEdit = async () => {
    if (!editingItemId) return;
    try {
      await updateItemMut.mutateAsync({
        id: editingItemId,
        data: itemFormData
      });
      
      // Full invalidation here is okay for item list
      queryClient.invalidateQueries({ queryKey: getGetQuotationQueryKey(quotationId) });
      
      setEditingItemId(null);
      toast({ title: "Item updated" });
    } catch (error) {
      toast({ variant: "destructive", title: "Item update failed" });
    }
  };

  const deleteItem = async (itemId: number) => {
    if (confirm("Delete this line item?")) {
      try {
        await deleteItemMut.mutateAsync({ id: itemId });
        queryClient.invalidateQueries({ queryKey: getGetQuotationQueryKey(quotationId) });
        toast({ title: "Item deleted" });
      } catch (error) {
        toast({ variant: "destructive", title: "Failed to delete item" });
      }
    }
  };

  if (isLoading || !quotation) {
    return <div className="p-8"><Skeleton className="h-[600px] w-full" /></div>;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="w-4 h-4 mr-1" /> Approved</Badge>;
      case 'rejected': return <Badge variant="destructive"><XCircle className="w-4 h-4 mr-1" /> Rejected</Badge>;
      case 'reviewed': return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><CheckCircle className="w-4 h-4 mr-1" /> Reviewed</Badge>;
      default: return <Badge variant="outline"><Clock className="w-4 h-4 mr-1" /> Draft</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-card p-4 rounded-lg shadow-sm border border-border">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation('/quotations')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{quotation.supplierName || 'Unknown Supplier'}</h1>
            <div className="text-sm text-muted-foreground font-mono">{quotation.quotationNumber || 'No Ref'}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
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
        {/* Left Column: Details */}
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
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Supplier</label>
                  {isEditing ? (
                    <Input value={formData.supplierName} onChange={(e) => setFormData({...formData, supplierName: e.target.value})} />
                  ) : (
                    <div className="font-medium">{quotation.supplierName || '-'}</div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Reference</label>
                  {isEditing ? (
                    <Input value={formData.quotationNumber} onChange={(e) => setFormData({...formData, quotationNumber: e.target.value})} />
                  ) : (
                    <div className="font-medium font-mono">{quotation.quotationNumber || '-'}</div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Date</label>
                  {isEditing ? (
                    <Input type="date" value={formData.quotationDate} onChange={(e) => setFormData({...formData, quotationDate: e.target.value})} />
                  ) : (
                    <div className="font-medium">{quotation.quotationDate || '-'}</div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Currency</label>
                  {isEditing ? (
                    <Input value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value})} />
                  ) : (
                    <div className="font-medium">{quotation.currency || '-'}</div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Total Amount</label>
                  {isEditing ? (
                    <Input value={formData.totalAmount} onChange={(e) => setFormData({...formData, totalAmount: e.target.value})} />
                  ) : (
                    <div className="font-medium text-lg text-primary">{quotation.totalAmount || '-'}</div>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Payment Terms</label>
                  {isEditing ? (
                    <Input value={formData.paymentTerms} onChange={(e) => setFormData({...formData, paymentTerms: e.target.value})} />
                  ) : (
                    <div className="font-medium">{quotation.paymentTerms || '-'}</div>
                  )}
                </div>
              </div>
              
              <div className="mt-6 space-y-1 border-t pt-4">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Notes / Delivery Terms</label>
                {isEditing ? (
                  <div className="grid gap-4">
                    <Input placeholder="Delivery terms..." value={formData.deliveryTerms} onChange={(e) => setFormData({...formData, deliveryTerms: e.target.value})} />
                    <Textarea placeholder="Additional notes..." value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={3} />
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

          {/* Line Items Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Line Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[120px]">Part Number</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotation.items && quotation.items.length > 0 ? (
                    quotation.items.map((item) => (
                      <TableRow key={item.id} className="group hover:bg-muted/30">
                        {editingItemId === item.id ? (
                          <>
                            <TableCell><Input value={itemFormData.partNumber} onChange={e => setItemFormData({...itemFormData, partNumber: e.target.value})} className="h-8 text-sm w-[100px]" /></TableCell>
                            <TableCell><Input value={itemFormData.description} onChange={e => setItemFormData({...itemFormData, description: e.target.value})} className="h-8 text-sm" /></TableCell>
                            <TableCell><Input value={itemFormData.quantity} onChange={e => setItemFormData({...itemFormData, quantity: e.target.value})} className="h-8 text-sm w-[80px] text-right ml-auto" /></TableCell>
                            <TableCell><Input value={itemFormData.unitPrice} onChange={e => setItemFormData({...itemFormData, unitPrice: e.target.value})} className="h-8 text-sm w-[100px] text-right ml-auto" /></TableCell>
                            <TableCell><Input value={itemFormData.totalPrice} onChange={e => setItemFormData({...itemFormData, totalPrice: e.target.value})} className="h-8 text-sm w-[100px] text-right ml-auto" /></TableCell>
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
                            <TableCell className="text-right">{item.unitPrice || '-'}</TableCell>
                            <TableCell className="text-right font-semibold">{item.totalPrice || '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startItemEdit(item)}>
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteItem(item.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        No line items extracted.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: PDF Viewer / Metadata */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Source Document</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-[1/1.4] bg-muted rounded-md border border-border flex items-center justify-center relative overflow-hidden mb-4">
                {/* PDF Viewer Placeholder - In reality we'd render the actual PDF here */}
                <div className="text-center p-6 text-muted-foreground flex flex-col items-center">
                  <FileText className="w-12 h-12 mb-3 opacity-50 text-primary" />
                  <p className="font-medium">Original PDF</p>
                  <p className="text-xs mt-1 max-w-[200px] truncate">{quotation.pdfStorageKey || 'Document'}</p>
                </div>
              </div>
              <Button className="w-full" variant="outline">
                <Download className="w-4 h-4 mr-2" /> Download PDF
              </Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">AI Extraction Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Confidence Score</span>
                  <span className="font-medium">{Math.round((quotation.extractionScore || 0) * 100)}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                  <div 
                    className={`h-full ${
                      (quotation.extractionScore || 0) > 0.8 ? 'bg-green-500' : 
                      (quotation.extractionScore || 0) > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${(quotation.extractionScore || 0) * 100}%` }}
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
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
