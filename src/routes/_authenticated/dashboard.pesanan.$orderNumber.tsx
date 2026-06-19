import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { CUSTOMER_NAV } from "./dashboard.index";
import { Button } from "@/components/ui/button";
import { formatIDR, formatDateTime, statusLabel, BANKS } from "@/lib/format";
import { uploadFile, signedUrl } from "@/lib/storage";
import { Clock, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/pesanan/$orderNumber")({
  component: OrderDetail,
});

function OrderDetail() {
  const { orderNumber } = useParams({ from: "/_authenticated/dashboard/pesanan/$orderNumber" });
  const { user } = useAuth();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const q = useQuery({
    queryKey: ["order", orderNumber],
    queryFn: async () => {
      // Call RPC check first
      await supabase.rpc("check_and_cancel_expired_orders");
      
      const { data: order } = await supabase.from("orders").select("*, order_items(*), payments(*), shipments(*)").eq("order_number", orderNumber).maybeSingle();
      if (!order) return null;
      let proofUrl = "";
      const payment = Array.isArray(order.payments) ? order.payments[0] : (order.payments as { id: string } | null);
      if (payment) {
        const { data: proofs } = await supabase.from("payment_proofs").select("*").eq("payment_id", payment.id).order("uploaded_at", { ascending: false }).limit(1);
        if (proofs && proofs[0]) proofUrl = await signedUrl("payment-proofs", proofs[0].image_url);
      }
      return { order, proofUrl };
    },
  });

  const order = q.data?.order;
  const payment = order ? ((Array.isArray(order.payments) ? order.payments[0] : (order.payments as Record<string, any> | null)) as { id: string; status: string; bank: string | null; reject_reason: string | null } | null) : null;
  const bank = payment ? BANKS.find((b) => b.code === payment.bank) : null;

  const createdAt = order ? new Date(order.created_at) : null;
  const deadline = createdAt ? new Date(createdAt.getTime() + 24 * 60 * 60 * 1000) : null;

  useEffect(() => {
    if (!order || order.status !== "pending" || !payment || !["waiting_payment", "rejected"].includes(payment.status) || !deadline) {
      setTimeLeft(null);
      return;
    }
    const updateTimer = async () => {
      const diff = deadline.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft(0);
        await supabase.rpc("check_and_cancel_expired_orders");
        qc.invalidateQueries({ queryKey: ["order", orderNumber] });
      } else {
        setTimeLeft(Math.floor(diff / 1000));
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [order, payment, deadline, orderNumber, qc]);

  const formatTimeLeft = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h} jam ${m} menit ${s} detik`;
  };

  if (q.isLoading) return (<DashboardShell items={CUSTOMER_NAV} title="Akun Saya">Memuat...</DashboardShell>);
  if (!order) return (<DashboardShell items={CUSTOMER_NAV} title="Akun Saya">Pesanan tidak ditemukan.</DashboardShell>);

  const displayStatus = (order.status === "pending" && payment?.status === "waiting_verification")
    ? "waiting_verification"
    : order.status;

  const timeline = [...((Array.isArray(order.timeline) ? order.timeline : []) as Array<{ status: string; at: string }>)];
  if (order.status === "pending" && payment?.status === "waiting_verification") {
    if (timeline.length > 0 && timeline[timeline.length - 1].status !== "waiting_verification") {
      timeline.push({ status: "waiting_verification", at: order.updated_at });
    }
  }

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
        title={statusLabel(displayStatus)}
        action={<Link to="/dashboard/pesanan" className="text-sm text-muted-foreground hover:underline">← Kembali</Link>}
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div className="space-y-6">
          <Card>
            <h3 className="font-extrabold mb-3">Timeline</h3>
            <ol className="space-y-2 text-sm">
              {timeline.map((t, i) => (
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
            
            {payment && payment.status === "waiting_payment" && order.status === "pending" && timeLeft !== null && timeLeft > 0 && (
              <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs rounded flex items-center gap-2">
                <Clock className="size-4 animate-pulse flex-shrink-0" />
                <div>
                  <div className="font-semibold">Sisa Waktu Pembayaran:</div>
                  <div className="font-mono mt-0.5">{formatTimeLeft(timeLeft)}</div>
                </div>
              </div>
            )}

            {order.status === "cancelled" && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded flex items-center gap-2">
                <AlertCircle className="size-4 flex-shrink-0" />
                <div>
                  <div className="font-semibold">Pesanan Dibatalkan</div>
                  <div className="mt-0.5">Waktu pembayaran telah habis atau pesanan dibatalkan.</div>
                </div>
              </div>
            )}

            {payment && payment.status === "waiting_payment" && order.status === "pending" && (
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
                {order.status === "pending" && (
                  <label className="block mt-3">
                    <span className="text-sm font-semibold">Upload ulang</span>
                    <input type="file" accept="image/*" onChange={handleUpload} disabled={uploading} className="mt-2 block w-full text-xs" />
                  </label>
                )}
              </div>
            )}
            {q.data?.proofUrl && <img src={q.data.proofUrl} alt="Bukti transfer" className="mt-4 w-full border border-border" />}
          </Card>
        </aside>
      </div>
    </DashboardShell>
  );
}
