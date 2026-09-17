import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { ADMIN_NAV } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatIDR, formatDateTime, statusLabel } from "@/lib/format";
import { signedUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Printer } from "lucide-react";
import { OrderReceiptModal } from "@/components/commerce/OrderReceiptModal";

export const Route = createFileRoute("/_authenticated/_admin/admin/pesanan/$orderNumber")({
  component: AdminOrderDetail,
});

interface TimelineEvent {
  status: string;
  at: string;
}

interface OrderTimelineData {
  created_at: string;
  updated_at: string;
  timeline?: any;
  status: string;
}

interface PaymentTimelineData {
  status: string;
  updated_at: string;
  verified_at?: string | null;
}

interface AdminPaymentInfo {
  id: string;
  status: string;
  updated_at: string;
  verified_at?: string | null;
  reject_reason?: string | null;
  bank?: string | null;
}

function buildTimeline(
  order: OrderTimelineData,
  payment: PaymentTimelineData | null | undefined,
  proofUploadedAt: string | null,
) {
  const events: Array<{ status: string; at: string }> = [];

  // 1. Menunggu Pembayaran (always first)
  events.push({ status: "pending", at: order.created_at });

  // 2. Sudah Dibayar (Menunggu Konfirmasi)
  const hasPaid =
    proofUploadedAt ||
    (payment && payment.status !== "waiting_payment" && payment.status !== "rejected");
  if (hasPaid) {
    const uploadTime = proofUploadedAt || payment?.updated_at || order.created_at;
    events.push({ status: "waiting_verification", at: uploadTime });
  }

  // 3. Pembayaran Diterima / Disetujui
  if (payment && payment.status === "approved") {
    events.push({
      status: "paid",
      at: payment.verified_at || payment.updated_at || order.updated_at,
    });
  }

  // 4. Sedang Diproses (Dikemas)
  const dbTimeline = Array.isArray(order.timeline) ? (order.timeline as TimelineEvent[]) : [];
  const processingEvent = dbTimeline.find((t) => t.status === "processing");
  if (processingEvent) {
    events.push({ status: "processing", at: processingEvent.at });
  } else if (["processing", "shipped", "delivered"].includes(order.status)) {
    events.push({ status: "processing", at: payment?.verified_at || order.updated_at });
  }

  // 5. Dikirim
  const shippedEvent = dbTimeline.find((t) => t.status === "shipped");
  if (shippedEvent) {
    events.push({ status: "shipped", at: shippedEvent.at });
  } else if (["shipped", "delivered"].includes(order.status)) {
    events.push({ status: "shipped", at: order.updated_at });
  }

  // 6. Selesai
  const deliveredEvent = dbTimeline.find((t) => t.status === "delivered");
  if (deliveredEvent) {
    events.push({ status: "delivered", at: deliveredEvent.at });
  } else if (order.status === "delivered") {
    events.push({ status: "delivered", at: order.updated_at });
  }

  // 7. Dibatalkan
  const cancelledEvent = dbTimeline.find((t) => t.status === "cancelled");
  if (cancelledEvent) {
    events.push({ status: "cancelled", at: cancelledEvent.at });
  } else if (order.status === "cancelled") {
    events.push({ status: "cancelled", at: order.updated_at });
  }

  // Deduplicate and sort
  const seen = new Set<string>();
  const uniqueEvents: Array<{ status: string; at: string }> = [];
  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  events.forEach((e) => {
    if (!seen.has(e.status)) {
      seen.add(e.status);
      uniqueEvents.push(e);
    }
  });

  return uniqueEvents;
}

function AdminOrderDetail() {
  const { orderNumber } = useParams({ from: "/_authenticated/_admin/admin/pesanan/$orderNumber" });
  const qc = useQueryClient();
  const [tracking, setTracking] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  const q = useQuery({
    queryKey: ["admin-order", orderNumber],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*), payments(*)")
        .eq("order_number", orderNumber)
        .maybeSingle();
      if (!data) return null;
      const payment = (Array.isArray(data.payments) ? data.payments[0] : data.payments) as
        | AdminPaymentInfo
        | undefined;
      let proofUrl = "";
      let proofUploadedAt = null;
      if (payment) {
        const { data: proofs } = await supabase
          .from("payment_proofs")
          .select("*")
          .eq("payment_id", payment.id)
          .order("uploaded_at", { ascending: false })
          .limit(1);
        if (proofs?.[0]) {
          proofUrl = await signedUrl("payment-proofs", proofs[0].image_url);
          proofUploadedAt = proofs[0].uploaded_at;
        }
      }
      let buyerProfile = null;
      if (data?.user_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, email, nama_lengkap, no_hp")
          .eq("id", data.user_id)
          .maybeSingle();
        buyerProfile = prof;
      }
      return { order: data, payment, proofUrl, proofUploadedAt, buyerProfile };
    },
  });

  if (!q.data?.order)
    return (
      <DashboardShell items={ADMIN_NAV} title="Admin Panel">
        Memuat...
      </DashboardShell>
    );
  const { order, payment, proofUrl, proofUploadedAt, buyerProfile } = q.data;

  async function approve() {
    if (!payment) return toast.error("Data pembayaran tidak ditemukan");
    await supabase
      .from("payments")
      .update({ status: "approved", verified_at: new Date().toISOString() })
      .eq("id", payment.id);
    toast.success("Pembayaran disetujui. Stok telah dipotong.");
    qc.invalidateQueries({ queryKey: ["admin-order", orderNumber] });
  }
  async function reject() {
    if (!payment) return toast.error("Data pembayaran tidak ditemukan");
    if (!rejectReason) return toast.error("Beri alasan penolakan");
    await supabase
      .from("payments")
      .update({ status: "rejected", reject_reason: rejectReason })
      .eq("id", payment.id);
    toast.success("Pembayaran ditolak");
    qc.invalidateQueries({ queryKey: ["admin-order", orderNumber] });
  }
  async function handleShipOrder() {
    if (!tracking) return toast.error("Masukkan nomor resi");

    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "shipped",
          tracking_number: tracking,
          courier: order.courier,
        })
        .eq("id", order.id);
      if (error) throw error;
      toast.success("Pesanan telah dikirim");
      qc.invalidateQueries({ queryKey: ["admin-order", orderNumber] });
    } catch (e) {
      toast.error("Gagal mengirim pesanan: " + (e as Error).message);
    }
  }

  async function handleCancelOrder() {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "cancelled", cancel_reason: "admin" })
        .eq("id", order.id);
      if (error) throw error;
      toast.success("Pesanan berhasil dibatalkan");
      qc.invalidateQueries({ queryKey: ["admin-order", orderNumber] });
    } catch (e) {
      toast.error("Gagal membatalkan pesanan: " + (e as Error).message);
    }
  }

  const displayStatus =
    order.status === "pending" && payment?.status === "waiting_verification"
      ? "waiting_verification"
      : order.status;

  const timeline = buildTimeline(order, payment, proofUploadedAt);

  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader
        eyebrow={order.order_number}
        title={statusLabel(displayStatus)}
        action={
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReceiptModalOpen(true)}
              className="gap-1.5 text-xs font-semibold h-9"
            >
              <Printer className="size-4 text-primary" />
              Cetak Struk / Invoice
            </Button>
            <Link
              to="/admin/pesanan"
              className="text-sm text-muted-foreground hover:underline cursor-pointer"
            >
              ← Kembali
            </Link>
          </div>
        }
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <div className="space-y-6">
          <Card>
            <h3 className="font-extrabold mb-5">Timeline</h3>
            <ol className="space-y-4 text-sm relative border-l border-border pl-4 ml-2 my-2">
              {timeline.map((t, i) => {
                const isLatest = i === timeline.length - 1;
                return (
                  <li key={i} className="relative flex flex-col gap-1">
                    {/* The timeline dot */}
                    <span
                      className={cn(
                        "absolute -left-[21px] top-1.5 rounded-full transition-all duration-300",
                        isLatest
                          ? "size-3 bg-primary border-2 border-background"
                          : "size-2 bg-muted-foreground/45 border border-background",
                      )}
                    />
                    {isLatest && (
                      <span className="absolute -left-[21px] top-1.5 size-3 bg-primary rounded-full animate-ping opacity-45 -z-10" />
                    )}

                    <div>
                      <div
                        className={cn(
                          "flex items-center gap-2 transition-all duration-300",
                          isLatest
                            ? "text-primary text-sm font-extrabold"
                            : "text-muted-foreground/80 text-xs font-medium",
                        )}
                      >
                        {statusLabel(t.status)}
                        {isLatest}
                      </div>
                      <div
                        className={cn(
                          "text-muted-foreground transition-all duration-300",
                          isLatest ? "text-xs mt-0.5" : "text-[10px]",
                        )}
                      >
                        {formatDateTime(t.at)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card>
            <h3 className="font-extrabold mb-4">Item</h3>
            {order.order_items?.map((it) => (
              <div
                key={it.id}
                className="flex gap-4 py-3 border-b border-border/50 last:border-0 text-sm items-center"
              >
                <div className="size-12 bg-muted overflow-hidden flex-shrink-0 rounded border border-border">
                  {it.image_url ? (
                    <img src={it.image_url} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="size-full flex items-center justify-center text-[10px] text-muted-foreground">
                      No img
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{it.product_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {it.size} × {it.quantity}
                  </div>
                </div>
                <div className="tabular-nums font-semibold">{formatIDR(it.subtotal)}</div>
              </div>
            ))}
            <div className="mt-4 text-right text-sm space-y-1">
              <div>
                Subtotal: <span className="font-semibold">{formatIDR(order.subtotal)}</span>
              </div>
              <div>
                Ongkir ({order.courier}):{" "}
                <span className="font-semibold">{formatIDR(order.shipping_cost)}</span>
              </div>
              <div className="text-base font-extrabold">Total: {formatIDR(order.grand_total)}</div>
            </div>
          </Card>

          <Card>
            <h3 className="font-extrabold mb-3">
              {order.order_number?.startsWith("POS-")
                ? "Data Pelanggan (Kasir / Walk-in)"
                : "Informasi Pelanggan & Penerima"}
            </h3>
            {order.order_number?.startsWith("POS-") ? (
              <div className="space-y-1.5 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">Nama Pembeli / Pelanggan:</span>
                  <span className="font-semibold text-foreground">{order.recipient_name}</span>
                </div>
                {order.recipient_no_hp && order.recipient_no_hp !== "-" && (
                  <div>
                    <span className="text-xs text-muted-foreground block">No. WhatsApp / HP:</span>
                    <span className="font-medium text-foreground">{order.recipient_no_hp}</span>
                  </div>
                )}
                {order.note && (
                  <p className="text-xs text-muted-foreground pt-2 border-t border-border/40 mt-2">
                    <strong className="text-foreground">Catatan:</strong> {order.note}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">Akun Pemesan (Online):</span>
                  <span className="font-semibold text-foreground">
                    {buyerProfile?.nama_lengkap || "—"}
                    {buyerProfile?.email ? (
                      <span className="text-xs text-muted-foreground font-normal ml-1">
                        ({buyerProfile.email})
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="pt-2 border-t border-border/50">
                  <span className="text-xs text-muted-foreground block">Penerima & Alamat Kirim:</span>
                  <p className="font-semibold">
                    {order.recipient_name} · {order.recipient_no_hp}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {order.recipient_alamat}, {order.recipient_kota}, {order.recipient_provinsi}{" "}
                    {order.recipient_kode_pos}
                  </p>
                </div>
                {order.note && (
                  <p className="text-xs pt-1">
                    <strong className="text-foreground">Catatan:</strong> {order.note}
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          {order.status === "processing" && (
            <Card>
              <h3 className="font-extrabold mb-3">Pengiriman & Resi</h3>
              <div className="space-y-3">
                <div className="text-xs bg-muted/40 border border-border p-3 rounded">
                  <span className="text-muted-foreground">Kurir Pilihan Pelanggan:</span>{" "}
                  <span className="font-bold text-foreground text-sm block mt-0.5">
                    {order.courier}
                  </span>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground">Nomor Resi</label>
                  <Input
                    placeholder="Masukkan Nomor Resi"
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                    className="text-xs h-9 mt-1"
                  />
                </div>
                <Button
                  className="w-full mt-2 cursor-pointer text-xs h-9"
                  onClick={handleShipOrder}
                  disabled={!tracking}
                >
                  Kirim Pesanan (Ubah Status)
                </Button>
              </div>
            </Card>
          )}

          {(order.status === "shipped" || order.status === "delivered") && (
            <Card className="space-y-3">
              <h3 className="font-extrabold mb-3">Informasi Pengiriman</h3>
              <div className="text-xs space-y-1 bg-muted/30 border border-border p-3 rounded">
                <div>
                  <span className="text-muted-foreground">Kurir:</span>{" "}
                  <span className="font-bold text-foreground">{order.courier}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">No. Resi:</span>{" "}
                  <span className="font-mono font-bold text-foreground">
                    {order.tracking_number}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status Pesanan:</span>{" "}
                  <span className="font-bold text-primary">{statusLabel(order.status)}</span>
                </div>
              </div>
            </Card>
          )}

          <Card>
            <h3 className="font-extrabold mb-3">Pembayaran</h3>
            <p className="text-sm">
              {payment ? `${statusLabel(payment.status)} via ${payment.bank}` : "—"}
            </p>
            {proofUrl ? (
              <a href={proofUrl} target="_blank" rel="noreferrer">
                <img src={proofUrl} alt="Bukti" className="mt-3 w-full border border-border" />
              </a>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">Belum ada bukti transfer.</p>
            )}
            {payment?.status === "waiting_verification" && (
              <div className="mt-4 space-y-2">
                <Button className="w-full" onClick={approve}>
                  Setujui Pembayaran
                </Button>
                <Input
                  placeholder="Alasan penolakan"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <Button variant="outline" className="w-full" onClick={reject}>
                  Tolak
                </Button>
              </div>
            )}
          </Card>

          {(order.status === "pending" || order.status === "processing") && (
            <div className="pt-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full text-destructive border-destructive/20 hover:bg-destructive/10 text-xs h-9 cursor-pointer"
                  >
                    Batalkan Pesanan (Admin)
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Batalkan Pesanan ini?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Apakah Anda yakin ingin membatalkan pesanan ini? Stok produk akan dikembalikan
                      dan tindakan ini tidak dapat dibatalkan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="cursor-pointer">Kembali</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleCancelOrder}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/95 cursor-pointer"
                    >
                      Batalkan Pesanan
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </aside>
      </div>

      {/* Modal Cetak Struk & Invoice */}
      <OrderReceiptModal
        order={order as any}
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
      />
    </DashboardShell>
  );
}
