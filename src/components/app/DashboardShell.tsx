import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_NAV_GROUPS, type NavItem } from "@/lib/navigation";
import {
  LayoutDashboard,
  Shirt,
  Tag,
  Ticket,
  ShoppingBag,
  Users,
  Wallet,
  Star,
  BarChart3,
  Settings,
  ShieldCheck,
  Heart,
  LogOut,
  ChevronDown,
  Menu,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

// Icon mapper for nav items
function getNavIcon(label: string) {
  const l = label.toLowerCase();
  if (l.includes("dashboard")) return LayoutDashboard;
  if (l.includes("pesanan")) return ShoppingBag;
  if (l.includes("produk")) return Shirt;
  if (l.includes("kategori")) return Tag;
  if (l.includes("pelanggan")) return Users;
  if (l.includes("keuangan")) return Wallet;
  if (l.includes("laporan")) return BarChart3;
  if (l.includes("voucher")) return Ticket;
  if (l.includes("ulasan")) return Star;
  if (l.includes("pengaturan")) return Settings;
  if (l.includes("profil") || l.includes("keamanan")) return ShieldCheck;
  if (l.includes("wishlist")) return Heart;
  return LayoutDashboard;
}

export function DashboardShell({
  items,
  title,
  children,
}: {
  items: NavItem[];
  title: string;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  const currentItem = items.find(
    (i) =>
      pathname === i.to ||
      (i.to !== "/dashboard" && i.to !== "/admin" && pathname.startsWith(i.to)),
  ) || items[0];

  const CurrentIcon = getNavIcon(currentItem?.label || "");
  const isAdminShell = title.toLowerCase().includes("admin");

  // Primary mobile quick tabs (Optimized: Dashboard, Pesanan, Produk, Keuangan, Lainnya)
  const quickTabs = isAdminShell
    ? [
        { label: "Dashboard", to: "/admin" },
        { label: "Pesanan", to: "/admin/pesanan" },
        { label: "Produk", to: "/admin/produk" },
        { label: "Keuangan", to: "/admin/keuangan" },
      ]
    : [
        { label: "Dashboard", to: "/dashboard" },
        { label: "Pesanan", to: "/dashboard/pesanan" },
        { label: "Wishlist", to: "/dashboard/wishlist" },
        { label: "Profil", to: "/dashboard/profil" },
      ];

  const isQuickTabActive = (to: string) =>
    pathname === to || (to !== "/dashboard" && to !== "/admin" && pathname.startsWith(to));

  const isOtherTabActive = !quickTabs.some((t) => isQuickTabActive(t.to));

  return (
    <div className="min-h-screen pt-16 sm:pt-20 md:pt-24 bg-muted/30 w-full pb-20 lg:pb-10">
      <div className="container-swiss py-3 sm:py-6 md:py-8 grid lg:grid-cols-[240px_minmax(0,1fr)] gap-6 lg:gap-10">
        {/* Desktop: Classic Elegant Grouped Vertical Sidebar - Always Sticky & Visible on Scroll */}
        <aside className="hidden lg:block sticky top-24 self-start w-full max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
          <div className="eyebrow text-muted-foreground mb-3 text-[11px] font-bold tracking-widest">
            {title}
          </div>
          <nav className="flex flex-col gap-3.5">
            {isAdminShell ? (
              ADMIN_NAV_GROUPS.map((group) => (
                <div key={group.section} className="space-y-1">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/70 px-3 py-0.5">
                    {group.section}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((i) => {
                      const active =
                        pathname === i.to ||
                        (i.to !== "/dashboard" && i.to !== "/admin" && pathname.startsWith(i.to));
                      const Icon = getNavIcon(i.label);
                      return (
                        <Link
                          key={i.to}
                          to={i.to}
                          className={cn(
                            "px-3 py-2 text-xs font-semibold transition-all duration-150 cursor-pointer flex items-center gap-2.5 rounded-lg border-l-2",
                            active
                              ? "bg-background text-foreground border-primary shadow-xs font-bold"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border-transparent",
                          )}
                        >
                          <Icon
                            className={cn(
                              "size-4 shrink-0",
                              active ? "text-primary" : "text-muted-foreground",
                            )}
                          />
                          <span className="truncate">{i.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col gap-1">
                {items.map((i) => {
                  const active =
                    pathname === i.to ||
                    (i.to !== "/dashboard" && i.to !== "/admin" && pathname.startsWith(i.to));
                  const Icon = getNavIcon(i.label);
                  return (
                    <Link
                      key={i.to}
                      to={i.to}
                      className={cn(
                        "px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-2.5 rounded-lg border-l-2",
                        active
                          ? "bg-background text-foreground border-primary shadow-sm font-bold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border-transparent",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4",
                          active ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <span>{i.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="pt-2 border-t border-border/50">
              <button
                onClick={handleLogout}
                className="px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors text-left cursor-pointer flex items-center gap-2.5 rounded-lg border-l-2 border-transparent hover:border-red-600 w-full"
              >
                <LogOut className="size-4 shrink-0" />
                <span>Logout</span>
              </button>
            </div>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="min-w-0 w-full max-w-full overflow-x-hidden">{children}</main>
      </div>

      {/* Persistent Native Mobile Bottom Navigation App Bar (Fixed at bottom) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-lg border-t border-border/80 px-2 py-1.5 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="grid grid-cols-5 items-center max-w-md mx-auto">
          {quickTabs.map((tab) => {
            const active = isQuickTabActive(tab.to);
            const Icon = getNavIcon(tab.label);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex flex-col items-center justify-center py-1 px-1 rounded-lg transition-colors cursor-pointer text-center",
                  active ? "text-primary font-extrabold" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <div
                  className={cn(
                    "p-1 rounded-full transition-all",
                    active && "bg-primary/10",
                  )}
                >
                  <Icon className={cn("size-5", active ? "text-primary stroke-[2.5]" : "stroke-[1.75]")} />
                </div>
                <span className="text-[10px] mt-0.5 leading-tight truncate w-full">{tab.label}</span>
              </Link>
            );
          })}

          {/* 5th Tab: "Semua Menu" Button with Sheet Trigger */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex flex-col items-center justify-center py-1 px-1 rounded-lg transition-colors cursor-pointer text-center",
                  isOtherTabActive ? "text-primary font-extrabold" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <div
                  className={cn(
                    "p-1 rounded-full transition-all",
                    isOtherTabActive && "bg-primary/10",
                  )}
                >
                  <Menu className={cn("size-5", isOtherTabActive ? "text-primary stroke-[2.5]" : "stroke-[1.75]")} />
                </div>
                <span className="text-[10px] mt-0.5 leading-tight truncate w-full">
                  {isOtherTabActive ? currentItem?.label || "Menu" : "Lainnya"}
                </span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-2xl p-5 overflow-y-auto z-50">
              <SheetHeader className="mb-4 text-left border-b border-border pb-3 pr-8">
                <SheetTitle className="text-base font-extrabold text-foreground">
                  Daftar Menu {title}
                </SheetTitle>
              </SheetHeader>

              {isAdminShell ? (
                <div className="space-y-4 py-1">
                  {ADMIN_NAV_GROUPS.map((group) => (
                    <div key={group.section} className="space-y-1.5">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/80 px-1">
                        {group.section}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {group.items.map((i) => {
                          const active =
                            pathname === i.to ||
                            (i.to !== "/dashboard" && i.to !== "/admin" && pathname.startsWith(i.to));
                          const Icon = getNavIcon(i.label);
                          return (
                            <Link
                              key={i.to}
                              to={i.to}
                              onClick={() => setMobileMenuOpen(false)}
                              className={cn(
                                "flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer min-h-[44px]",
                                active
                                  ? "bg-primary text-primary-foreground border-primary shadow-md"
                                  : "bg-background border-border hover:bg-muted text-muted-foreground hover:text-foreground",
                              )}
                            >
                              <div
                                className={cn(
                                  "p-1.5 rounded-lg shrink-0",
                                  active ? "bg-white/20 text-white" : "bg-primary/10 text-primary",
                                )}
                              >
                                <Icon className="size-4" />
                              </div>
                              <span className="truncate">{i.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 py-1">
                  {items.map((i) => {
                    const active =
                      pathname === i.to ||
                      (i.to !== "/dashboard" && i.to !== "/admin" && pathname.startsWith(i.to));
                    const Icon = getNavIcon(i.label);
                    return (
                      <Link
                        key={i.to}
                        to={i.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 p-3 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer min-h-[48px]",
                          active
                            ? "bg-primary text-primary-foreground border-primary shadow-md"
                            : "bg-background border-border hover:bg-muted text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <div
                          className={cn(
                            "p-1.5 rounded-lg shrink-0",
                            active ? "bg-white/20 text-white" : "bg-primary/10 text-primary",
                          )}
                        >
                          <Icon className="size-4" />
                        </div>
                        <span className="truncate">{i.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}

              <div className="mt-5 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-xl border border-red-500/20 transition-colors cursor-pointer min-h-[44px]"
                >
                  <LogOut className="size-4" />
                  Keluar / Logout Akun
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 sm:mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4 border-b border-border pb-3 sm:pb-4 md:pb-6 w-full max-w-full">
      <div className="min-w-0 flex-1">
        {eyebrow && <div className="eyebrow text-muted-foreground mb-1 text-[10px] sm:text-xs uppercase tracking-wider">{eyebrow}</div>}
        <h1 className="text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight truncate">{title}</h1>
      </div>
      {action && <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto shrink-0 justify-start sm:justify-end">{action}</div>}
    </div>
  );
}

export function Card({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("bg-background border border-border p-3.5 sm:p-5 md:p-6 rounded-xl w-full max-w-full overflow-hidden shadow-sm", className)} {...props}>
      {children}
    </div>
  );
}
