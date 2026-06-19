import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { CUSTOMER_NAV } from "./dashboard.index";
import { formatIDR, formatDate, statusLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Shirt } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/_authenticated/dashboard/pesanan/")({
  component: OrdersPage,
});

function OrdersPage() {
  const { user } = useAuth();
  const [orderFilter, setOrderFilter] = useState("all");

  const q = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      await supabase.rpc("check_and_cancel_expired_orders");
      return (await supabase.from("orders").select("*, payments(status), order_items(*)").eq("user_id", user!.id).order("created_at", { ascending: false })).data ?? [];
    },
  });

  const counts = useMemo(() => {
    const list = q.data ?? [];
    let all = list.length;
    let pending = 0;
    let paid = 0;
    let processing = 0;
    let shipped = 0;
    let delivered = 0;
    let cancelled = 0;

    list.forEach((o) => {
      const payment = Array.isArray(o.payments) ? o.payments[0] : (o.payments as any);
      const displayStatus = (o.status === "pending" && payment?.status === "waiting_verification")
        ? "waiting_verification"
        : o.status;

      if (displayStatus === "pending") pending++;
      else if (displayStatus === "waiting_verification" || displayStatus === "paid") paid++;
      else if (displayStatus === "processing") processing++;
      else if (displayStatus === "shipped") shipped++;
      else if (displayStatus === "delivered") delivered++;
      else if (displayStatus === "cancelled") cancelled++;
    });

    return { all, pending, paid, processing, shipped, delivered, cancelled };
  }, [q.data]);

  const filteredOrders = useMemo(() => {
    let list = q.data ? [...q.data] : [];

    if (orderFilter !== "all") {
      list = list.filter((o) => {
        const payment = Array.isArray(o.payments) ? o.payments[0] : (o.payments as any);
        const displayStatus = (o.status === "pending" && payment?.status === "waiting_verification")
          ? "waiting_verification"
          : o.status;

        if (orderFilter === "pending") {
          return displayStatus === "pending";
        }
        if (orderFilter === "paid") {
          return displayStatus === "paid" || displayStatus === "waiting_verification";
        }
        return displayStatus === orderFilter;
      });
    }

    return list;
  }, [q.data, orderFilter]);

  return (
    <DashboardShell items={CUSTOMER_NAV} title="Akun Saya">
      <PageHeader eyebrow="Pesanan" title="Pesanan Saya" />

      {/* Order Status Tabs */}
      <div className="border-b border-border -mx-5 md:-mx-6 px-5 md:px-6 mb-6 overflow-x-auto scrollbar-none flex gap-6">
        {[
          { value: "all", label: "Semua", count: counts.all },
          { value: "pending", label: "Menunggu Pembayaran", count: counts.pending },
          { value: "paid", label: "Sudah Dibayar", count: counts.paid },
          { value: "processing", label: "Sedang Diproses", count: counts.processing },
          { value: "shipped", label: "Dikirim", count: counts.shipped },
          { value: "delivered", label: "Selesai", count: counts.delivered },
          { value: "cancelled", label: "Dibatalkan", count: counts.cancelled },
        ].map((tab) => {
          const isActive = orderFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setOrderFilter(tab.value)}
              className={cn(
                "pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap focus:outline-none",
                isActive
                  ? "border-primary text-primary font-bold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{tab.label}</span>
              <span className={cn(
                "px-2 py-0.5 text-[10px] rounded-full font-bold transition-colors",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "bg-muted text-muted-foreground"
              )}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {q.data?.length ? (
        filteredOrders.length ? (
          <div className="space-y-4">
            {filteredOrders.map((o) => {
              const payment = Array.isArray(o.payments) ? o.payments[0] : o.payments as any;
              const displayStatus = (o.status === "pending" && payment?.status === "waiting_verification")
                ? "waiting_verification"
                : o.status;

              const items = Array.isArray(o.order_items) ? o.order_items : [];
              const firstItem = items[0];
              const remainingCount = items.length - 1;

              const getStatusBadgeClass = (status: string) => {
                switch (status) {
                  case "pending":
                    return "bg-amber-500/10 text-amber-600 border border-amber-500/20";
                  case "waiting_verification":
                    return "bg-blue-500/10 text-blue-600 border border-blue-500/20 animate-pulse";
                  case "paid":
                  case "processing":
                    return "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20";
                  case "shipped":
                    return "bg-sky-500/10 text-sky-600 border border-sky-500/20";
                  case "delivered":
                    return "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";
                  case "cancelled":
                    return "bg-destructive/10 text-destructive border border-destructive/20";
                  default:
                    return "bg-muted text-muted-foreground border border-border";
                }
              };

              return (
                <Card key={o.id} className="space-y-4 hover:shadow-sm transition-shadow">
                  {/* Top Bar: Order ID, Date, and Status */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-muted-foreground">No. Pesanan:</span>
                      <span className="font-mono text-xs font-bold text-foreground">{o.order_number}</span>
                      <span className="text-muted-foreground/30">•</span>
                      <span className="text-xs text-muted-foreground">{formatDate(o.created_at)}</span>
                    </div>
                    <span className={cn("text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full", getStatusBadgeClass(displayStatus))}>
                      {statusLabel(displayStatus)}
                    </span>
                  </div>

                  {/* Body: Product details */}
                  {firstItem && (
                    <div className="flex gap-4 py-1">
                      <div className="size-16 bg-muted border border-border rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {firstItem.image_url ? (
                          <img src={firstItem.image_url} alt="" className="size-full object-cover" />
                        ) : (
                          <Shirt className="size-6 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm text-foreground truncate">{firstItem.product_name}</h4>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                          <span>Ukuran: <strong className="text-foreground">{firstItem.size}</strong></span>
                          <span>•</span>
                          <span>Jumlah: <strong className="text-foreground">x{firstItem.quantity}</strong></span>
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-right tabular-nums self-center">
                        {formatIDR(firstItem.subtotal)}
                      </div>
                    </div>
                  )}

                  {/* If there are more items */}
                  {remainingCount > 0 && (
                    <div className="text-xs text-muted-foreground pl-2 border-l-2 border-border italic">
                      + {remainingCount} produk lainnya
                    </div>
                  )}

                  {/* Bottom Bar: Total Price and CTA button */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border/50">
                    <div className="text-xs">
                      <span className="text-muted-foreground">Total Pesanan: </span>
                      <strong className="text-base font-extrabold text-foreground tabular-nums">{formatIDR(o.grand_total)}</strong>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="h-8 text-xs cursor-pointer" asChild>
                        <Link to="/dashboard/pesanan/$orderNumber" params={{ orderNumber: o.order_number }}>
                          Lihat Detail Pesanan
                        </Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <p className="text-sm text-muted-foreground text-center py-6">Tidak ada pesanan dengan status ini.</p>
          </Card>
        )
      ) : (
        <Card>
          <p className="text-sm text-muted-foreground text-center py-6">Belum ada pesanan.</p>
        </Card>
      )}
    </DashboardShell>
  );
}

