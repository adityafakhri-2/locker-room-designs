import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { formatIDR, statusLabel } from "@/lib/format";
import { ADMIN_NAV } from "@/lib/navigation";

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
      
      {/* 4 Financial & Operational Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border">
          <div className="flex items-center justify-between">
            <span className="eyebrow text-muted-foreground">Total Omset Penjualan</span>
            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
              Lunas
            </span>
          </div>
          <div
            className="display-md mt-2 text-2xl sm:text-3xl lg:text-xl xl:text-3xl font-bold truncate"
            title={formatIDR(stats.data?.totalRevenue ?? 0)}
          >
            {formatIDR(stats.data?.totalRevenue ?? 0)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Dari {stats.data?.validOrdersCount ?? 0} pesanan berhasil
          </p>
        </Card>

        <Card className="border-border">
          <div className="flex items-center justify-between">
            <span className="eyebrow text-muted-foreground">Total Modal (HPP Terjual)</span>
            <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
              COGS
            </span>
          </div>
          <div
            className="display-md mt-2 text-2xl sm:text-3xl lg:text-xl xl:text-3xl font-bold text-muted-foreground truncate"
            title={formatIDR(stats.data?.totalCost ?? 0)}
          >
            {formatIDR(stats.data?.totalCost ?? 0)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Modal {stats.data?.totalJerseysSold ?? 0} pcs jersey terjual
          </p>
        </Card>

        <Card className="border-border border-emerald-500/20 bg-emerald-500/[0.02]">
          <div className="flex items-center justify-between">
            <span className="eyebrow text-emerald-600 dark:text-emerald-400 font-bold">
              Total Keuntungan Bersih
            </span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Margin {(stats.data?.profitMargin ?? 0).toFixed(1)}%
            </span>
          </div>
          <div
            className="display-md mt-2 text-2xl sm:text-3xl lg:text-xl xl:text-3xl font-bold text-emerald-600 dark:text-emerald-400 truncate"
            title={formatIDR(stats.data?.totalProfit ?? 0)}
          >
            {formatIDR(stats.data?.totalProfit ?? 0)}
          </div>
          <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1 font-medium">
            Laba kotor dari produk yang sudah terjual
          </p>
        </Card>

        <Card className="border-border">
          <div className="flex items-center justify-between">
            <span className="eyebrow text-muted-foreground">Volume & Katalog</span>
            <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
              Stok
            </span>
          </div>
          <div className="display-md mt-2 text-2xl sm:text-3xl lg:text-xl xl:text-3xl font-bold">
            {stats.data?.totalJerseysSold ?? 0}{" "}
            <span className="text-sm font-normal text-muted-foreground">pcs terjual</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.data?.productsCount ?? 0} jenis produk · {stats.data?.customersCount ?? 0} pelanggan
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[650px]">
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
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">Belum ada pesanan masuk.</p>
        )}
      </Card>
    </DashboardShell>
  );
}
