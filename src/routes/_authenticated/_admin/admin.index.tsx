import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { formatIDR, statusLabel } from "@/lib/format";
import { ADMIN_NAV } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_admin/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const stats = useQuery({
    queryKey: ["admin-stats-profit"],
    queryFn: async () => {
      const [productsRes, ordersRes, customersRes] = await Promise.all([
        supabase.from("products").select("id, cost_price, price, name"),
        supabase
          .from("orders")
          .select(
            "id, grand_total, subtotal, shipping_cost, discount_amount, status, created_at, order_number, recipient_name, payments(status), order_items(product_id, quantity, unit_price, cost_price, subtotal, product_name)",
          ),
        supabase
          .from("user_roles")
          .select("id", { count: "exact", head: true })
          .eq("role", "customer"),
      ]);

      const allProducts = productsRes.data ?? [];
      const allOrders = ordersRes.data ?? [];

      // Create quick lookup for product cost price
      const productCostMap: Record<string, number> = {};
      allProducts.forEach((p) => {
        productCostMap[p.id] = Number((p as any).cost_price ?? 0);
      });

      // Filter paid / completed orders
      const validOrders = allOrders.filter((o) =>
        ["paid", "processing", "shipped", "delivered"].includes(o.status),
      );

      let totalRevenue = 0;
      let totalCost = 0;
      let totalJerseysSold = 0;

      validOrders.forEach((o) => {
        // Omset bersih produk (subtotal dikurangi diskon voucher)
        const orderRevenue = Math.max(
          0,
          Number(o.subtotal || o.grand_total) - Number(o.discount_amount || 0),
        );
        totalRevenue += orderRevenue;

        const items = (o as any).order_items || [];
        items.forEach((it: any) => {
          const qty = Number(it.quantity) || 1;
          totalJerseysSold += qty;
          const unitCost =
            Number(it.cost_price) > 0
              ? Number(it.cost_price)
              : productCostMap[it.product_id] || 0;
          totalCost += unitCost * qty;
        });
      });

      const totalProfit = totalRevenue - totalCost;
      const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

      return {
        productsCount: allProducts.length,
        customersCount: customersRes.count ?? 0,
        ordersCount: allOrders.length,
        validOrdersCount: validOrders.length,
        totalRevenue,
        totalCost,
        totalProfit,
        profitMargin,
        totalJerseysSold,
        recent: allOrders
          .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
          .slice(0, 8),
        byStatus: allOrders.reduce(
          (acc, o) => ({ ...acc, [o.status]: (acc[o.status] ?? 0) + 1 }),
          {} as Record<string, number>,
        ),
        productCostMap,
      };
    },
  });

  const costMap = stats.data?.productCostMap ?? {};

  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader eyebrow="Admin" title="Dashboard Utama" />
      
      {/* 4 Financial & Operational Cards - 2 per row on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-5">
        <Card className="border-border p-3 sm:p-4 rounded-xl">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              Omset
            </span>
            <span className="text-[9px] sm:text-[10px] font-extrabold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 shrink-0">
              Lunas
            </span>
          </div>
          <div
            className="text-sm sm:text-xl md:text-2xl font-extrabold tracking-tight text-foreground mt-2 truncate"
            title={formatIDR(stats.data?.totalRevenue ?? 0)}
          >
            {formatIDR(stats.data?.totalRevenue ?? 0)}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
            {stats.data?.validOrdersCount ?? 0} pesanan berhasil
          </p>
        </Card>

        <Card className="border-border p-3 sm:p-4 rounded-xl">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              Modal (HPP)
            </span>
            <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border shrink-0">
              COGS
            </span>
          </div>
          <div
            className="text-sm sm:text-xl md:text-2xl font-extrabold tracking-tight text-muted-foreground mt-2 truncate"
            title={formatIDR(stats.data?.totalCost ?? 0)}
          >
            {formatIDR(stats.data?.totalCost ?? 0)}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
            {stats.data?.totalJerseysSold ?? 0} pcs terjual
          </p>
        </Card>

        <Card className="border-border border-emerald-500/30 bg-emerald-500/[0.03] p-3 sm:p-4 rounded-xl">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 truncate">
              Keuntungan
            </span>
            <span className="text-[9px] sm:text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0">
              {(stats.data?.profitMargin ?? 0).toFixed(0)}%
            </span>
          </div>
          <div
            className="text-sm sm:text-xl md:text-2xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 mt-2 truncate"
            title={formatIDR(stats.data?.totalProfit ?? 0)}
          >
            {formatIDR(stats.data?.totalProfit ?? 0)}
          </div>
          <p className="text-[10px] sm:text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 font-medium truncate">
            Laba kotor
          </p>
        </Card>

        <Card className="border-border p-3 sm:p-4 rounded-xl">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              Volume
            </span>
            <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border shrink-0">
              Stok
            </span>
          </div>
          <div className="text-sm sm:text-xl md:text-2xl font-extrabold tracking-tight text-foreground mt-2 truncate">
            {stats.data?.totalJerseysSold ?? 0} pcs
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
            {stats.data?.productsCount ?? 0} produk · {stats.data?.customersCount ?? 0} user
          </p>
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-extrabold text-lg">Pesanan Terbaru & Rincian Profit</h2>
          <Link
            to="/admin/pesanan"
            className="text-xs text-primary hover:underline font-semibold cursor-pointer"
          >
            Lihat Semua Pesanan →
          </Link>
        </div>

        {stats.data?.recent.length ? (
          <>
            {/* Mobile Card List (< lg) */}
            <div className="grid grid-cols-1 gap-3 lg:hidden">
              {stats.data.recent.map((o) => {
                const payment = Array.isArray(o.payments)
                  ? o.payments[0]
                  : (o.payments as unknown as { status: string } | null);
                const displayStatus =
                  o.status === "pending" && payment?.status === "waiting_verification"
                    ? "waiting_verification"
                    : o.status;
                const isWaitingConfirm = displayStatus === "waiting_verification";
                const isPaid = ["paid", "processing", "shipped", "delivered"].includes(o.status);

                const items = (o as any).order_items || [];
                let orderCost = 0;
                items.forEach((it: any) => {
                  const qty = Number(it.quantity) || 1;
                  const unitCost =
                    Number(it.cost_price) > 0
                      ? Number(it.cost_price)
                      : costMap[it.product_id] || 0;
                  orderCost += unitCost * qty;
                });

                const orderRev = Math.max(
                  0,
                  Number(o.subtotal || o.grand_total) - Number(o.discount_amount || 0),
                );
                const orderProfit = orderRev - orderCost;

                return (
                  <div
                    key={o.order_number}
                    className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                      <Link
                        to="/admin/pesanan/$orderNumber"
                        params={{ orderNumber: o.order_number }}
                        className="font-mono text-xs font-bold text-primary hover:underline"
                      >
                        {o.order_number}
                      </Link>
                      {isWaitingConfirm ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                          Konfirmasi Bayar
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                          {statusLabel(displayStatus)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Penerima:</span>
                      <span className="font-semibold text-foreground truncate max-w-[180px]">
                        {o.recipient_name}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40 text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Modal HPP</span>
                        <span className="font-medium text-foreground">
                          {isPaid ? formatIDR(orderCost) : "—"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground block">Keuntungan</span>
                        {isPaid ? (
                          <span
                            className={cn(
                              "font-bold",
                              orderProfit > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : orderProfit < 0
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-muted-foreground",
                            )}
                          >
                            {formatIDR(orderProfit)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-[11px]">Belum Lunas</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <span className="text-xs text-muted-foreground">Total Bayar:</span>
                      <span className="text-sm font-extrabold text-foreground">
                        {formatIDR(o.grand_total)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= lg) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left eyebrow text-muted-foreground border-b border-border">
                    <th className="py-2.5">No. Order</th>
                    <th>Penerima</th>
                    <th>Status</th>
                    <th className="text-right">Modal Jersey</th>
                    <th className="text-right">Keuntungan</th>
                    <th className="text-right">Total Bayar</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.data.recent.map((o) => {
                    const payment = Array.isArray(o.payments)
                      ? o.payments[0]
                      : (o.payments as unknown as { status: string } | null);
                    const displayStatus =
                      o.status === "pending" && payment?.status === "waiting_verification"
                        ? "waiting_verification"
                        : o.status;
                    const isWaitingConfirm = displayStatus === "waiting_verification";
                    const isPaid = ["paid", "processing", "shipped", "delivered"].includes(o.status);

                    // Calculate order cost and profit
                    const items = (o as any).order_items || [];
                    let orderCost = 0;
                    items.forEach((it: any) => {
                      const qty = Number(it.quantity) || 1;
                      const unitCost =
                        Number(it.cost_price) > 0
                          ? Number(it.cost_price)
                          : costMap[it.product_id] || 0;
                      orderCost += unitCost * qty;
                    });

                    const orderRev = Math.max(
                      0,
                      Number(o.subtotal || o.grand_total) - Number(o.discount_amount || 0),
                    );
                    const orderProfit = orderRev - orderCost;

                    return (
                      <tr key={o.order_number} className="border-b border-border/50 hover:bg-muted/10">
                        <td className="py-3">
                          <Link
                            to="/admin/pesanan/$orderNumber"
                            params={{ orderNumber: o.order_number }}
                            className="font-mono text-xs font-semibold text-primary hover:underline cursor-pointer"
                          >
                            {o.order_number}
                          </Link>
                        </td>
                        <td className="font-medium text-xs sm:text-sm">{o.recipient_name}</td>
                        <td>
                          {isWaitingConfirm ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                              Konfirmasi Pembayaran
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {statusLabel(displayStatus)}
                            </span>
                          )}
                        </td>
                        <td className="text-right tabular-nums text-xs text-muted-foreground">
                          {isPaid ? formatIDR(orderCost) : "—"}
                        </td>
                        <td className="text-right tabular-nums text-xs font-bold">
                          {isPaid ? (
                            <span
                              className={
                                orderProfit > 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : orderProfit < 0
                                    ? "text-rose-600 dark:text-rose-400"
                                    : "text-muted-foreground"
                              }
                            >
                              {formatIDR(orderProfit)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-normal">Menunggu Lunas</span>
                          )}
                        </td>
                        <td className="text-right tabular-nums font-semibold text-xs sm:text-sm">
                          {formatIDR(o.grand_total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">Belum ada pesanan masuk.</p>
        )}
      </Card>
    </DashboardShell>
  );
}
