import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface NavItem { label: string; to: string }

export function DashboardShell({ items, title, children }: { items: NavItem[]; title: string; children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen pt-20 md:pt-24 bg-muted/30">
      <div className="container-swiss py-8 md:py-12 grid lg:grid-cols-[240px_minmax(0,1fr)] gap-8 lg:gap-12">
        <aside className="lg:sticky lg:top-24 self-start">
          <div className="eyebrow text-muted-foreground mb-4">{title}</div>
          <nav className="flex lg:flex-col gap-1 overflow-x-auto -mx-2 px-2">
            {items.map((i) => {
              const active = pathname === i.to || (i.to !== "/dashboard" && i.to !== "/admin" && pathname.startsWith(i.to));
              return (
                <Link
                  key={i.to}
                  to={i.to}
                  className={cn(
                    "px-3 py-2.5 text-sm font-medium border-l-2 whitespace-nowrap transition-colors",
                    active ? "border-primary bg-background text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {i.label}
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              className="px-3 py-2.5 text-sm font-bold border-l-2 border-transparent text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:border-red-600 transition-colors text-left cursor-pointer whitespace-nowrap"
            >
              Logout
            </button>
          </nav>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4 border-b border-border pb-6">
      <div>
        {eyebrow && <div className="eyebrow text-muted-foreground mb-2">{eyebrow}</div>}
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("bg-background border border-border p-5 md:p-6", className)}>{children}</div>;
}
