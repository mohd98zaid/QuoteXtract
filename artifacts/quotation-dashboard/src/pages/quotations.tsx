import { useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import {
  Search, Filter, FileText, CheckCircle, Clock, XCircle,
  MoreHorizontal, Trash2, ArrowRight, Loader2, Plus,
} from "lucide-react";
import { useListQuotations, getListQuotationsQueryKey } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDebounce } from "@/hooks/use-debounce";

const EMPTY_QUOTATION = {
  supplierName: "",
  supplierEmail: "",
  quotationNumber: "",
  quotationDate: "",
  currency: "",
  paymentTerms: "",
  deliveryTerms: "",
  totalAmount: "",
  notes: "",
};

export default function QuotationsList() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newForm, setNewForm] = useState({ ...EMPTY_QUOTATION });

  const createMut = useMutation({
    mutationFn: async (data: typeof EMPTY_QUOTATION) => {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Create failed");
      return res.json() as Promise<{ id: number }>;
    },
    onSuccess: (quotation) => {
      queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
      setShowNewDialog(false);
      setNewForm({ ...EMPTY_QUOTATION });
      toast({ title: "Quotation created" });
      setLocation(`/quotations/${quotation.id}`);
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to create quotation" });
    },
  });

  const debouncedSearch = useDebounce(searchTerm, 300);

  const { data: quotations, isLoading } = useListQuotations({
    search: debouncedSearch || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/quotations/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
      toast({ title: "Quotation deleted" });
      setDeleteTarget(null);
    },
    onError: () => {
      toast({ variant: "destructive", title: "Delete failed", description: "Could not delete the quotation." });
      setDeleteTarget(null);
    },
  });

  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);

  const statusMut = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      setUpdatingStatusId(id);
      const res = await fetch(`/api/quotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
      return res.json();
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
      const label = status === "draft" ? "Draft" : status === "reviewed" ? "Reviewed" : status === "approved" ? "Approved" : "Rejected";
      toast({ title: `Status set to ${label}` });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to update status" });
    },
    onSettled: () => setUpdatingStatusId(null),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
      case 'reviewed':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"><CheckCircle className="w-3 h-3 mr-1" /> Reviewed</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" /> Draft</Badge>;
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Quotations</h1>
        <p className="text-muted-foreground">Manage and review extracted customer quotations.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search customer, ref number..."
            className="pl-9 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => { setNewForm({ ...EMPTY_QUOTATION }); setShowNewDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" /> New Quotation
          </Button>
        </div>
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <CardContent className="flex-1 overflow-auto p-0">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-[200px]">Customer</TableHead>
                <TableHead>Quote Ref</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : quotations && quotations.length > 0 ? (
                quotations.map((quotation) => (
                  <TableRow
                    key={quotation.id}
                    className="group hover:bg-muted/50 cursor-pointer"
                    onClick={() => setLocation(`/quotations/${quotation.id}`)}
                  >
                    <TableCell className="font-medium">
                      {quotation.supplierName || 'Unknown Customer'}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {quotation.quotationNumber || '-'}
                    </TableCell>
                    <TableCell>
                      {quotation.quotationDate ? format(new Date(quotation.quotationDate), 'MMM d, yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {quotation.totalAmount ? `${quotation.currency || ''} ${quotation.totalAmount}` : '-'}
                    </TableCell>
                    <TableCell>
                      {quotation.extractionScore != null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 rounded-full bg-secondary overflow-hidden">
                            <div
                              className={`h-full ${
                                quotation.extractionScore > 80 ? 'bg-green-500' :
                                quotation.extractionScore > 60 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${quotation.extractionScore}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {quotation.extractionScore}%
                          </span>
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={quotation.status}
                        onValueChange={(val) => statusMut.mutate({ id: quotation.id, status: val })}
                        disabled={updatingStatusId === quotation.id}
                      >
                        <SelectTrigger className={`h-7 w-[130px] text-xs border px-2 gap-1 rounded-full font-medium ${
                          quotation.status === "approved" ? "bg-green-50 border-green-300 text-green-700 dark:bg-green-950 dark:border-green-700 dark:text-green-300" :
                          quotation.status === "rejected" ? "bg-red-50 border-red-300 text-red-700 dark:bg-red-950 dark:border-red-700 dark:text-red-300" :
                          quotation.status === "reviewed" ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950 dark:border-blue-700 dark:text-blue-300" :
                          "bg-muted border-border text-muted-foreground"
                        }`}>
                          {updatingStatusId === quotation.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">
                            <span className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Draft
                            </span>
                          </SelectItem>
                          <SelectItem value="reviewed">
                            <span className="flex items-center gap-2">
                              <CheckCircle className="w-3.5 h-3.5 text-blue-500" /> Mark Reviewed
                            </span>
                          </SelectItem>
                          <SelectItem value="rejected">
                            <span className="flex items-center gap-2">
                              <XCircle className="w-3.5 h-3.5 text-red-500" /> Reject
                            </span>
                          </SelectItem>
                          <SelectItem value="approved">
                            <span className="flex items-center gap-2">
                              <CheckCircle className="w-3.5 h-3.5 text-green-500" /> Approve
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setLocation(`/quotations/${quotation.id}`)}>
                            <ArrowRight className="w-4 h-4 mr-2" />
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() =>
                              setDeleteTarget({
                                id: quotation.id,
                                name: quotation.supplierName || quotation.quotationNumber || `#${quotation.id}`,
                              })
                            }
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-[400px] text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <FileText className="w-12 h-12 mb-4 opacity-20" />
                      <p className="text-lg font-medium">No quotations found</p>
                      <p className="text-sm mt-1">Try adjusting your filters or upload a new PDF.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* New Quotation dialog */}
      <Dialog open={showNewDialog} onOpenChange={(v) => !v && setShowNewDialog(false)}>
        <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Quotation</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Customer Name</Label>
                <Input
                  placeholder="e.g. Acme Corporation"
                  value={newForm.supplierName}
                  onChange={(e) => setNewForm({ ...newForm, supplierName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Customer Email</Label>
                <Input
                  type="email"
                  placeholder="e.g. buyer@acme.com"
                  value={newForm.supplierEmail}
                  onChange={(e) => setNewForm({ ...newForm, supplierEmail: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Quote Reference #</Label>
                <Input
                  placeholder="e.g. QT-2024-001"
                  value={newForm.quotationNumber}
                  onChange={(e) => setNewForm({ ...newForm, quotationNumber: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={newForm.quotationDate}
                  onChange={(e) => setNewForm({ ...newForm, quotationDate: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Input
                  placeholder="e.g. USD"
                  value={newForm.currency}
                  onChange={(e) => setNewForm({ ...newForm, currency: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Total Amount</Label>
                <Input
                  placeholder="e.g. 12500.00"
                  value={newForm.totalAmount}
                  onChange={(e) => setNewForm({ ...newForm, totalAmount: e.target.value })}
                />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Payment Terms</Label>
                <Input
                  placeholder="e.g. Net 30, T/T in advance"
                  value={newForm.paymentTerms}
                  onChange={(e) => setNewForm({ ...newForm, paymentTerms: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Delivery Terms</Label>
                <Input
                  placeholder="e.g. FOB, CIF, DDP"
                  value={newForm.deliveryTerms}
                  onChange={(e) => setNewForm({ ...newForm, deliveryTerms: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Any additional remarks or terms…"
                rows={3}
                value={newForm.notes}
                onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createMut.mutate(newForm)}
              disabled={createMut.isPending || !newForm.supplierName.trim()}
            >
              {createMut.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</>
              ) : (
                <><Plus className="w-4 h-4 mr-2" /> Create Quotation</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete quotation?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> and all its line items will be permanently deleted.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting…</>
              ) : (
                <><Trash2 className="w-4 h-4 mr-2" /> Delete</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
