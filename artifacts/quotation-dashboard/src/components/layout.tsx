import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Inbox, 
  FileText, 
  Search,
  Settings,
  LogOut,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/mail", label: "Mail", icon: Mail },
    { href: "/inbox", label: "Upload", icon: Inbox },
    { href: "/quotations", label: "Quotations", icon: FileText },
    { href: "/search", label: "Search", icon: Search },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <aside className="w-64 border-r border-border bg-card flex flex-col hidden md:flex shrink-0">
        <div className="h-14 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-2 text-primary font-bold text-lg tracking-tight">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground">
              Q
            </div>
            QuoteXtract
          </div>
        </div>
        
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
            Menu
          </div>
          {navItems.map((item) => {
            const isActive = location === item.href || 
                            (item.href !== "/" && location.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors hover-elevate",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-foreground hover:bg-muted"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border space-y-1">
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium transition-colors hover-elevate",
              location === "/settings" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
            )}
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
          <button className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors hover-elevate">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-muted/30">
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-7xl h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
