import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Inbox,
  FileText,
  Search,
  Settings,
  LogOut,
  Mail,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { ChatAssistant } from "./ChatAssistant";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar_collapsed") === "true"
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/mail", label: "Mail", icon: Mail },
    { href: "/inbox", label: "Upload", icon: Inbox },
    { href: "/quotations", label: "Quotations", icon: FileText },
    { href: "/search", label: "Search", icon: Search },
  ];

  const NavLink = ({ href, label, Icon }: { href: string; label: string; Icon: React.ElementType }) => {
    const isActive = location === href || (href !== "/" && location.startsWith(href));
    return (
      <Link
        href={href}
        title={collapsed ? label : undefined}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors hover-elevate",
          collapsed ? "justify-center" : "",
          isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
        )}
      >
        <Icon className="w-4 h-4 shrink-0" />
        {!collapsed && <span>{label}</span>}
      </Link>
    );
  };

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={cn("flex flex-col h-full", mobile && "w-64")}>
      <div className="h-14 flex items-center border-b border-border shrink-0 px-3">
        <div className="flex items-center gap-2 text-primary font-bold text-lg tracking-tight min-w-0 flex-1">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground shrink-0">
            Q
          </div>
          {(!collapsed || mobile) && <span className="truncate">QuoteXtract</span>}
        </div>
        {!mobile && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={toggleCollapsed}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        )}
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} Icon={item.icon} />
        ))}
      </nav>

      <div className={cn("p-2 border-t border-border space-y-1 shrink-0", collapsed && !mobile ? "px-2" : "px-2")}>
        {/* Dark mode toggle */}
        <button
          title={collapsed && !mobile ? (theme === "dark" ? "Light mode" : "Dark mode") : undefined}
          onClick={toggleTheme}
          className={cn(
            "flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium transition-colors hover:bg-muted text-foreground hover-elevate",
            collapsed && !mobile ? "justify-center" : ""
          )}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 shrink-0 text-amber-500" />
          ) : (
            <Moon className="w-4 h-4 shrink-0 text-indigo-500" />
          )}
          {(!collapsed || mobile) && (
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          )}
        </button>

        <Link
          href="/settings"
          title={collapsed && !mobile ? "Settings" : undefined}
          className={cn(
            "flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium transition-colors hover-elevate",
            collapsed && !mobile ? "justify-center" : "",
            location === "/settings" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
          )}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {(!collapsed || mobile) && <span>Settings</span>}
        </Link>
        <button
          title={collapsed && !mobile ? "Logout" : undefined}
          className={cn(
            "flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors hover-elevate",
            collapsed && !mobile ? "justify-center" : ""
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {(!collapsed || mobile) && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "border-r border-border bg-card hidden md:flex flex-col shrink-0 transition-[width] duration-200",
          collapsed ? "w-[60px]" : "w-64"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed top-0 left-0 h-full z-50 bg-card border-r border-border transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent mobile />
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-muted/30">
        {/* Mobile top bar */}
        <div className="h-14 flex items-center gap-3 px-4 border-b border-border bg-card md:hidden shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <div className="flex items-center gap-2 text-primary font-bold text-base tracking-tight">
            <div className="w-5 h-5 rounded bg-primary flex items-center justify-center text-primary-foreground text-xs">
              Q
            </div>
            QuoteXtract
          </div>
          <div className="ml-auto">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme}>
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-500" />
              )}
            </Button>
          </div>
        </div>

        {location.startsWith("/mail") ? (
          // Mail page: full-bleed, no padding, no outer scroll
          <div className="flex-1 min-h-0 overflow-hidden">
            {children}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 md:p-8 min-h-0">
            <div className="mx-auto max-w-7xl h-full">
              {children}
            </div>
          </div>
        )}
      </main>
      <ChatAssistant />
    </div>
  );
}
