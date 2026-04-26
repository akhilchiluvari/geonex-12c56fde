// Customer app layout: sidebar + topbar + outlet.
// Auth-gated: redirects to /login when no session.
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useGeo } from "@/lib/geo-context";
import { CITIES } from "@/lib/cities";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Receipt,
  ShieldCheck,
  LogOut,
  MapPin,
  ShieldAlert,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const navItems: { to: "/app" | "/app/accounts" | "/app/transfer" | "/app/statements" | "/app/admin"; label: string; icon: React.ComponentType<{ className?: string }>; adminOnly?: boolean }[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/accounts", label: "Accounts", icon: Wallet },
  { to: "/app/transfer", label: "Transfer", icon: ArrowLeftRight },
  { to: "/app/statements", label: "Statements", icon: Receipt },
  { to: "/app/admin", label: "Admin", icon: ShieldAlert, adminOnly: true },
];

export function AppLayout() {
  const { user, loading, role, fullName, signOut } = useAuth();
  const navigate = useNavigate();
  const { city, setCity, cities } = useGeo();
  const [mobileOpen, setMobileOpen] = useState(false);
  const routerState = useRouterState();
  const path = routerState.location.pathname;

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login" });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="text-sm text-muted-foreground">Loading your dashboard…</div>
      </div>
    );
  }

  const visibleNav = navItems.filter((n) => !n.adminOnly || role === "admin");
  const initials =
    (fullName || user.email || "GE")
      .split(/[\s@.]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "GE";

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 h-screen w-64 bg-sidebar text-sidebar-foreground z-50 transition-transform lg:translate-x-0 flex flex-col",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="px-5 py-5 border-b border-sidebar-border flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-display font-semibold tracking-tight">GEONEX</span>
          </Link>
          <button
            className="lg:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleNav.map((item) => {
            const isActive = path === item.to || (item.to !== "/app" && path.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border space-y-3">
          <div className="px-3 py-3 rounded-lg bg-sidebar-accent/40">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-primary flex items-center justify-center text-sm font-semibold text-primary-foreground">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{fullName || user.email}</div>
                <div className="text-xs text-sidebar-foreground/60 capitalize">{role || "customer"}</div>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main column */}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 h-14 border-b bg-background/80 backdrop-blur-md flex items-center px-4 lg:px-8 gap-3">
          <button
            className="lg:hidden p-2 -ml-2 rounded-md hover:bg-accent"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground mr-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-pulse-ring" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            Live
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <Select value={city.name} onValueChange={(v) => {
              const c = cities.find((c) => c.name === v);
              if (c) setCity(c);
            }}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CITIES.map((c) => (
                  <SelectItem key={c.name} value={c.name} className="text-xs">
                    {c.name}, {c.country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        <main className="px-4 lg:px-8 py-6 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
