import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { ADMIN_NAV } from "./admin.index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatIDR, formatDateTime, statusLabel } from "@/lib/format";
import { signedUrl } from "@/lib/storage";

export const Route = createFileRoute("/_authenticated/_admin/admin/pesanan/$orderNumber")({
  component: AdminOrderDetail,
});

function AdminOrderDetail() {
  const { orderNumber } = useParams({ from: "/_authenticated/_admin/admin/pesanan/$orderNumber" });
  const qc = useQueryClient();
  const [tracking, setTracking] = useState("");
  const [courier, setCourier] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const q = useQuery({
    queryKey: ["admin-order", orderNumber],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*, order_items(*), payments(*)").eq("order_number", orderNumber).maybeSingle();
      if (!data) return null;
      const payment = (Array.isArray(data.payments) ? data.payments[0] : data.payments) as any;
      let proofUrl = "";
      if (payment) {
        const { data: proofs } = await supabase.from("payment_proofs").select("*").eq("payment_id", payment.id).order("uploaded_at", { ascending: false }).limit(1);
        if (proofs?.[0]) proofUrl = await signedUrl("payment-proofs", proofs[0].image_url);
      }
      return { order: data, payment, proofUrl };
    },
  });

  if (!q.data?.order) return <DashboardShell items={ADMIN_NAV} title="Admin Panel">Memuat...</DashboardShell>;
  const { order, payment, proofUrl } = q.data;

  async function approve() {
    await supabase.from("payments").update({ status: "approved", verified_at: new Date().toISOString() }).eq("id", payment.id);
    toast.success("Pembayaran disetujui. Stok telah dipotong.");
    qc.invalidateQueries({ queryKey: ["admin-order", orderNumber] });
  }
  async function reject() {
    if (!rejectReason) return toast.error("Beri alasan penolakan");
    await supabase.from("payments").update({ status: "rejected", reject_reason: rejectReason }).eq("id", payment.id);
    toast.success("Pembayaran ditolak");
    qc.invalidateQueries({ queryKey: ["admin-order", orderNumber] });
  }
  async function updateStatus() {
    if (!newStatus) return;
    const payload: any = { status: newStatus };
    if (newStatus === "shipped") {
      if (!tracking) return toast.error("Masukkan nomor resi");
      payload.tracking_number = tracking;
      payload.courier = courier || order.courier;
    }
    await supabase.from("orders").update(payload).eq("id", order.id);
    toast.success("Status diperbarui");
    qc.invalidateQueries({ queryKey: ["admin-order", orderNumber] });
  }

  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader eyebrow={order.order_number} title={statusLabel(order.status)} action={<Link to="/admin/pesanan" className="text-sm text-muted-foreground hover:underline">← Kembali</Link>} />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div className="space-y-6">
          <Card>
            <h3 className="font-extrabold mb-3">Timeline</h3>
            <ol className="space-y-2 text-sm">
              {((Array.isArray(order.timeline) ? order.timeline : []) as Array<{status: string; at: string}>).map((t, i) => (
                <li key={i} className="flex gap-3"><span className="size-2 bg-primary mt-2" /><div><div className="font-semibold">{statusLabel(t.status)}</div><div className="text-xs text-muted-foreground">{formatDateTime(t.at)}</div></div></li>
              ))}
            </ol>
          </Card>

          <Card>
            <h3 className="font-extrabold mb-4">Item</h3>
            {order.order_items?.map((it) => (
              <div key={it.id} className="flex justify-between py-2 border-b border-border/50 last:border-0 text-sm">
                <div><div className="font-medium">{it.product_name}</div><div className="text-xs text-muted-foreground">{it.size} × {it.quantity}</div></div>
                <div className="tabular-nums">{formatIDR(it.subtotal)}</div>
              </div>
            ))}
            <div className="mt-4 text-right text-sm space-y-1">
              <div>Subtotal: <span className="font-semibold">{formatIDR(order.subtotal)}</span></div>
              <div>Ongkir: <span className="font-semibold">{formatIDR(order.shipping_cost)}</span></div>
              <div className="text-base font-extrabold">Total: {formatIDR(order.grand_total)}</div>
            </div>
          </Card>

          <Card>
            <h3 className="font-extrabold mb-3">Penerima</h3>
            <p className="text-sm">{order.recipient_name} · {order.recipient_no_hp}</p>
            <p className="text-sm text-muted-foreground mt-1">{order.recipient_alamat}, {order.recipient_kota}, {order.recipient_provinsi} {order.recipient_kode_pos}</p>
            {order.note && <p className="text-sm mt-3"><strong>Catatan:</strong> {order.note}</p>}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <h3 className="font-extrabold mb-3">Pembayaran</h3>
            <p className="text-sm">{payment ? `${statusLabel(payment.status)} via ${payment.bank}` : "—"}</p>
            {proofUrl ? (
              <a href={proofUrl} target="_blank" rel="noreferrer"><img src={proofUrl} alt="Bukti" className="mt-3 w-full border border-border" /></a>
            ) : <p className="text-xs text-muted-foreground mt-2">Belum ada bukti transfer.</p>}
            {payment?.status === "waiting_verification" && (
              <div className="mt-4 space-y-2">
                <Button className="w-full" onClick={approve}>Setujui Pembayaran</Button>
                <Input placeholder="Alasan penolakan" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
                <Button variant="outline" className="w-full" onClick={reject}>Tolak</Button>
              </div>
            )}
          </Card>

          <Card>
            <h3 className="font-extrabold mb-3">Update Status</h3>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger><SelectValue placeholder="Pilih status" /></SelectTrigger>
              <SelectContent>
                {["pending","paid","processing","shipped","delivered","cancelled"].map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
              </SelectContent>
            </Select>
            {newStatus === "shipped" && (
              <div className="mt-3 space-y-2">
                <Input placeholder="Kurir (JNE/J&T/...)" value={courier} onChange={(e) => setCourier(e.target.value)} />
                <Input placeholder="Nomor Resi" value={tracking} onChange={(e) => setTracking(e.target.value)} />
              </div>
            )}
            <Button className="w-full mt-3" onClick={updateStatus} disabled={!newStatus}>Simpan</Button>
          </Card>
        </aside>
      </div>
    </DashboardShell>
  );
}
