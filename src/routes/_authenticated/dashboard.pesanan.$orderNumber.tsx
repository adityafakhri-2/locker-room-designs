import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { CUSTOMER_NAV } from "./dashboard.index";
import { Button } from "@/components/ui/button";
import { formatIDR, formatDateTime, statusLabel, BANKS } from "@/lib/format";
import { uploadFile, signedUrl } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/dashboard/pesanan/$orderNumber")({
  component: OrderDetail,
});

function OrderDetail() {
  const { orderNumber } = useParams({ from: "/_authenticated/dashboard/pesanan/$orderNumber" });
  const { user } = useAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const q = useQuery({
    queryKey: ["order", orderNumber],
    queryFn: async () => {
      const { data: order } = await supabase.from("orders").select("*, order_items(*), payments(*), shipments(*)").eq("order_number", orderNumber).maybeSingle();
      if (!order) return null;
      let proofUrl = "";
      const payment = order.payments?.[0];
      if (payment) {
        const { data: proofs } = await supabase.from("payment_proofs").select("*").eq("payment_id", payment.id).order("uploaded_at", { ascending: false }).limit(1);
        if (proofs && proofs[0]) proofUrl = await signedUrl("payment-proofs", proofs[0].image_url);
      }
      return { order, proofUrl };
    },
  });

  if (q.isLoading) return (<DashboardShell items={CUSTOMER_NAV} title="Akun Saya">Memuat...</DashboardShell>);
  const order = q.data?.order;
  if (!order) return (<DashboardShell items={CUSTOMER_NAV} title="Akun Saya">Pesanan tidak ditemukan.</DashboardShell>);
  const payment = order.payments?.[0];
  const bank = BANKS.find((b) => b.code === payment?.bank);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !payment || !user) return;
    setUploading(true);
    try {
      const path = `${user.id}/${order!.id}-${Date.now()}-${file.name}`;
      await uploadFile("payment-proofs", path, file);
      await supabase.from("payment_proofs").insert({ payment_id: payment.id, image_url: path });
      await supabase.from("payments").update({ status: "waiting_verification" }).eq("id", payment.id);
      toast.success("Bukti transfer diunggah");
      qc.invalidateQueries({ queryKey: ["order", orderNumber] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <DashboardShell items={CUSTOMER_NAV} title="Akun Saya">
      <PageHeader
        eyebrow={order.order_number}
        title={statusLabel(order.status)}
        action={<Link to="/dashboard/pesanan" className="text-sm text-muted-foreground hover:underline">← Kembali</Link>}
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div className="space-y-6">
          <Card>
            <h3 className="font-extrabold mb-3">Timeline</h3>
            <ol className="space-y-2 text-sm">
              {(Array.isArray(order.timeline) ? order.timeline : []).map((t, i) => (
                <li key={i} className="flex gap-3"><span className="size-2 bg-primary mt-2" /><div><div className="font-semibold">{statusLabel(t.status)}</div><div className="text-xs text-muted-foreground">{formatDateTime(t.at)}</div></div></li>
              ))}
            </ol>
          </Card>

          <Card>
            <h3 className="font-extrabold mb-4">Item Pesanan</h3>
            {order.order_items?.map((it) => (
              <div key={it.id} className="flex gap-4 py-3 border-b border-border/50 last:border-0">
                <div className="size-16 bg-muted overflow-hidden flex-shrink-0">{it.image_url && <img src={it.image_url} alt="" className="size-full object-cover" />}</div>
                <div className="flex-1 min-w-0"><div className="font-medium truncate">{it.product_name}</div><div className="text-xs text-muted-foreground">{it.size} × {it.quantity}</div></div>
                <div className="text-sm tabular-nums">{formatIDR(it.subtotal)}</div>
              </div>
            ))}
            <div className="mt-4 space-y-1 text-sm text-right">
              <div>Subtotal: <span className="font-semibold tabular-nums">{formatIDR(order.subtotal)}</span></div>
              <div>Ongkir ({order.courier}): <span className="font-semibold tabular-nums">{formatIDR(order.shipping_cost)}</span></div>
              <div className="text-base font-extrabold">Total: {formatIDR(order.grand_total)}</div>
            </div>
          </Card>

          <Card>
            <h3 className="font-extrabold mb-4">Alamat Pengiriman</h3>
            <p className="text-sm"><strong>{order.recipient_name}</strong> · {order.recipient_no_hp}</p>
            <p className="text-sm text-muted-foreground mt-1">{order.recipient_alamat}, {order.recipient_kota}, {order.recipient_provinsi} {order.recipient_kode_pos}</p>
            {order.tracking_number && <p className="text-sm mt-3">Resi {order.courier}: <strong className="font-mono">{order.tracking_number}</strong></p>}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <div className="eyebrow text-muted-foreground">Pembayaran</div>
            <div className="text-lg font-extrabold mt-1">{payment ? statusLabel(payment.status) : "—"}</div>
            {bank && (
              <div className="mt-4 text-sm space-y-1 bg-muted/40 p-4 border border-border">
                <div className="eyebrow text-muted-foreground">Transfer ke</div>
                <div className="font-semibold">{bank.name}</div>
                <div className="font-mono">{bank.account}</div>
                <div className="text-xs text-muted-foreground">a.n {bank.holder}</div>
                <div className="mt-2 text-base font-extrabold">{formatIDR(order.grand_total)}</div>
              </div>
            )}
            {payment && payment.status === "waiting_payment" && (
              <div className="mt-4">
                <label className="block">
                  <span className="text-sm font-semibold">Upload Bukti Transfer</span>
                  <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} className="mt-2 block w-full text-xs" />
                </label>
              </div>
            )}
            {payment && payment.status === "waiting_verification" && (
              <p className="text-sm text-muted-foreground mt-4">Bukti transfer sedang diverifikasi admin.</p>
            )}
            {payment && payment.status === "rejected" && (
              <div className="mt-4 text-sm">
                <p className="text-destructive font-semibold">Pembayaran ditolak</p>
                {payment.reject_reason && <p className="text-muted-foreground">{payment.reject_reason}</p>}
                <label className="block mt-3">
                  <span className="text-sm font-semibold">Upload ulang</span>
                  <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} className="mt-2 block w-full text-xs" />
                </label>
              </div>
            )}
            {q.data?.proofUrl && <img src={q.data.proofUrl} alt="Bukti transfer" className="mt-4 w-full border border-border" />}
          </Card>
        </aside>
      </div>
    </DashboardShell>
  );
}
