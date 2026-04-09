import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Search, Filter, ArrowRight, FileText, CheckCircle, Clock, XCircle } from "lucide-react";
import { useListQuotations } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";

export default function QuotationsList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const debouncedSearch = useDebounce(searchTerm, 300);

  const { data: quotations, isLoading } = useListQuotations({
    search: debouncedSearch || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined
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
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // Loading skeletons
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
                  <TableRow key={quotation.id} className="group hover:bg-muted/50 cursor-pointer">
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
                    <TableCell>
                      {getStatusBadge(quotation.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/quotations/${quotation.id}`}>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </Link>
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
    </div>
  );
}
