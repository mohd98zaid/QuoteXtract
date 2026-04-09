import { useState } from "react";
import { Link } from "wouter";
import { Search as SearchIcon, FileText, Package, ArrowRight } from "lucide-react";
import { useSearchQuotations } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function Search() {
  const [searchTerm, setSearchTerm] = useState("");
  // In a real app we'd debounce this, or trigger search on enter/submit
  const [activeSearch, setActiveSearch] = useState("");

  const { data: searchResults, isLoading } = useSearchQuotations(
    { q: activeSearch },
    { query: { enabled: activeSearch.length > 2 } }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim().length > 2) {
      setActiveSearch(searchTerm.trim());
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="text-center py-10">
        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">Global Search</h1>
        <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
          Search across all quotation records, suppliers, line items, and part numbers.
        </p>
        
        <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder="Enter part number, supplier, or description..." 
              className="pl-12 h-14 text-lg rounded-xl shadow-sm border-2 focus-visible:ring-primary/20 focus-visible:border-primary"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button type="submit" className="h-14 px-8 rounded-xl text-lg hover-elevate">
            Search
          </Button>
        </form>
      </div>

      {isLoading && (
        <div className="space-y-6">
          <Skeleton className="h-12 w-48" />
          <div className="grid gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        </div>
      )}

      {searchResults && activeSearch && !isLoading && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-2 pb-2 border-b">
            <h2 className="text-2xl font-bold tracking-tight">Results for "{activeSearch}"</h2>
            <Badge variant="secondary" className="text-base rounded-full px-3">{searchResults.total}</Badge>
          </div>

          {searchResults.total === 0 ? (
            <div className="text-center py-20 bg-card rounded-xl border border-dashed border-border">
              <SearchIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground">No results found</h3>
              <p className="text-muted-foreground mt-2">Try adjusting your search terms or part numbers.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Quotations Matches */}
              {searchResults.quotations && searchResults.quotations.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                    <FileText className="w-5 h-5" /> Matching Quotations ({searchResults.quotations.length})
                  </h3>
                  <div className="grid gap-3">
                    {searchResults.quotations.map(quotation => (
                      <Link key={`q-${quotation.id}`} href={`/quotations/${quotation.id}`}>
                        <Card className="hover:border-primary/50 transition-colors cursor-pointer hover-elevate">
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-lg">{quotation.supplierName || 'Unknown Supplier'}</span>
                                <Badge variant="outline" className="font-mono text-xs">{quotation.quotationNumber}</Badge>
                              </div>
                              <span className="text-muted-foreground text-sm">
                                Amount: {quotation.currency} {quotation.totalAmount} • Status: {quotation.status}
                              </span>
                            </div>
                            <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
                              <ArrowRight className="w-5 h-5" />
                            </Button>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Line Item Matches */}
              {searchResults.items && searchResults.items.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                    <Package className="w-5 h-5" /> Matching Line Items ({searchResults.items.length})
                  </h3>
                  <div className="grid gap-3">
                    {searchResults.items.map(item => (
                      <Link key={`i-${item.id}`} href={`/quotations/${item.quotationId}`}>
                        <Card className="hover:border-primary/50 transition-colors cursor-pointer hover-elevate">
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold">{item.description || 'No Description'}</span>
                                {item.partNumber && (
                                  <Badge className="font-mono bg-primary/10 text-primary hover:bg-primary/20">{item.partNumber}</Badge>
                                )}
                              </div>
                              <span className="text-muted-foreground text-sm flex gap-4">
                                <span>Qty: {item.quantity}</span>
                                <span>Unit: {item.unitPrice}</span>
                                <span className="font-semibold text-foreground">Total: {item.totalPrice}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-xs text-right hidden sm:block text-muted-foreground bg-muted px-2 py-1 rounded">
                                In Quote #{item.quotationId}
                              </div>
                              <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground">
                                <ArrowRight className="w-5 h-5" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
