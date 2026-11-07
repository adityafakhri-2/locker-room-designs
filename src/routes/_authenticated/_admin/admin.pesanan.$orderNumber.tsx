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
import { getOrderPlatformFee } from "@/lib/orderFee";
import { signedUrl, uploadFile } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Printer, HandCoins, MapPin, Calendar, MessageCircle, CheckCircle2, Clock, AlertCircle, Phone } from "lucide-react";
import { OrderReceiptModal } from "@/components/commerce/OrderReceiptModal";
import { isCodOrder, parseCodInfo } from "@/lib/orderCod";
import { createWebpFile } from "@/lib/imageCompression";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

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
  isCod: boolean = false,
) {
  if (isCod) {
    const events: Array<{ status: string; at: string }> = [];
    events.push({ status: "cod_pending", at: order.created_at });
    if (["processing", "shipped", "delivered"].includes(order.status)) {
      events.push({ status: "cod_scheduled", at: order.updated_at });
    }
    if (order.status === "delivered") {
      events.push({ status: "cod_completed", at: order.updated_at });
    }
    if (order.status === "cancelled") {
      events.push({ status: "cod_rejected", at: order.updated_at });
    }
    return events;
  }

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
      let codProofUrl = "";
      if ((data as any)?.cod_proof_url) {
        try {
          codProofUrl = await signedUrl("payment-proofs", (data as any).cod_proof_url);
        } catch {}
      }
      if (!codProofUrl && proofUrl) codProofUrl = proofUrl;

      return { order: data, payment, proofUrl, proofUploadedAt, buyerProfile, codProofUrl };
    },
  });

  if (!q.data?.order)
    return (
      <DashboardShell items={ADMIN_NAV} title="Admin Panel">
        Memuat...
      </DashboardShell>
    );
  const { order, payment, proofUrl, proofUploadedAt, buyerProfile, codProofUrl } = q.data;

  const isCod = isCodOrder(order);
  const codInfo = parseCodInfo(order);

  // COD Admin Dialogs & States
  const [codRejectDialogOpen, setCodRejectDialogOpen] = useState(false);
  const [codRejectReason, setCodRejectReason] = useState("");
  const [rejectingCod, setRejectingCod] = useState(false);

  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [codProofFile, setCodProofFile] = useState<File | null>(null);
  const [codProofPreview, setCodProofPreview] = useState<string | null>(null);
  const [completingCod, setCompletingCod] = useState(false);

  async function handleAccCod() {
    try {
      const updatePayload: Record<string, any> = {
        status: "processing",
        cod_status: "scheduled",
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("orders").update(updatePayload).eq("id", order.id);
      if (error) {
        const { error: fErr } = await supabase
          .from("orders")
          .update({ status: "processing", updated_at: new Date().toISOString() })
          .eq("id", order.id);
        if (fErr) throw fErr;
      }
      toast.success("Pesanan COD berhasil di-ACC & dijadwalkan!");
      qc.invalidateQueries({ queryKey: ["admin-order", orderNumber] });
    } catch (e) {
      toast.error("Gagal meng-ACC COD: " + (e as Error).message);
    }
  }

  async function handleRejectCod() {
    if (!codRejectReason.trim()) return toast.error("Masukkan alasan penolakan COD");
    setRejectingCod(true);
    try {
      const reason = `COD Ditolak: ${codRejectReason.trim()}`;
      const updatePayload: Record<string, any> = {
        status: "cancelled",
        cancel_reason: reason,
        cod_status: "rejected",
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("orders").update(updatePayload).eq("id", order.id);
      if (error) {
        const { error: fErr } = await supabase
          .from("orders")
          .update({ status: "cancelled", cancel_reason: reason, updated_at: new Date().toISOString() })
          .eq("id", order.id);
        if (fErr) throw fErr;
      }

      if (payment) {
        await supabase
          .from("payments")
          .update({ status: "rejected", reject_reason: codRejectReason.trim() })
          .eq("id", payment.id);
      }

      toast.success("Pengajuan COD berhasil ditolak. Stok produk dikembalikan.");
      setCodRejectDialogOpen(false);
      setCodRejectReason("");
      qc.invalidateQueries({ queryKey: ["admin-order", orderNumber] });
    } catch (e) {
      toast.error("Gagal menolak COD: " + (e as Error).message);
    } finally {
      setRejectingCod(false);
    }
  }

  async function handleAdminCompleteCod() {
    setCompletingCod(true);
    try {
      let uploadedPath: string | null = null;
      if (codProofFile) {
        uploadedPath = `cod-proofs/${order.id}-${Date.now()}.webp`;
        await uploadFile("payment-proofs", uploadedPath, codProofFile);
      }

      const updatePayload: Record<string, any> = {
        status: "delivered",
        updated_at: new Date().toISOString(),
      };
      if (uploadedPath) {
        updatePayload.cod_proof_url = uploadedPath;
        updatePayload.cod_status = "delivered";
      }

      const { error: oErr } = await supabase.from("orders").update(updatePayload).eq("id", order.id);
      if (oErr) {
        const { error: fErr } = await supabase
          .from("orders")
          .update({ status: "delivered", updated_at: new Date().toISOString() })
          .eq("id", order.id);
        if (fErr) throw fErr;
      }

      if (payment) {
        await supabase
          .from("payments")
          .update({ status: "approved", verified_at: new Date().toISOString() })
          .eq("id", payment.id);

        if (uploadedPath) {
          await supabase.from("payment_proofs").insert({
            payment_id: payment.id,
            image_url: uploadedPath,
          });
        }
      }

      toast.success("Pesanan COD berhasil diselesaikan! Transaksi ditutup.");
      setCompleteDialogOpen(false);
      setCodProofFile(null);
      setCodProofPreview(null);
      qc.invalidateQueries({ queryKey: ["admin-order", orderNumber] });
    } catch (err) {
      toast.error("Gagal menyelesaikan COD: " + (err as Error).message);
    } finally {
      setCompletingCod(false);
    }
  }

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

  const displayStatus = isCod
    ? order.status === "pending"
      ? "cod_pending"
      : order.status === "processing"
        ? "cod_scheduled"
        : order.status === "delivered"
          ? "cod_completed"
          : order.status === "cancelled"
            ? "cod_rejected"
            : order.status
    : order.status === "pending" && payment?.status === "waiting_verification"
      ? "waiting_verification"
      : order.status;

  const timeline = buildTimeline(order, payment, proofUploadedAt, isCod);

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
              {Boolean((order as any).discount_amount && (order as any).discount_amount > 0) && (
                <div className="text-rose-600">
                  Potongan Diskon: <span className="font-semibold">-{formatIDR((order as any).discount_amount)}</span>
                </div>
              )}
              {Boolean(getOrderPlatformFee(order as any) > 0) && (
                <div className="text-amber-600 dark:text-amber-400">
                  Biaya Platform: <span className="font-semibold">-{formatIDR(getOrderPlatformFee(order as any))}</span>
                </div>
              )}
              <div>
                Ongkir ({order.courier}):{" "}
                <span className="font-semibold">{formatIDR(order.shipping_cost)}</span>
              </div>
              <div className="text-base font-extrabold">Total: {formatIDR(order.grand_total)}</div>
            </div>
          </Card>

          {isCod ? (
            /* KARTU INFORMASI COD (ADMIN) */
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-extrabold flex items-center gap-2">
                  <HandCoins className="size-4 text-emerald-600" /> Informasi Janji Temu COD
                </h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  COD (Ketemuan Langsung)
                </span>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">Lokasi Ketemuan COD:</span>
                  <div className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                    <MapPin className="size-4 text-primary flex-shrink-0" />
                    <span>{codInfo.location}</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Jadwal Tanggal & Waktu:</span>
                  <div className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                    <Calendar className="size-4 text-primary flex-shrink-0" />
                    <span>
                      {codInfo.date || "—"} {codInfo.timeSlot ? `(${codInfo.timeSlot})` : ""}
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-border/50">
                  <span className="text-xs text-muted-foreground block">Pelanggan / Pemesan:</span>
                  <div className="flex items-center justify-between flex-wrap gap-2 mt-0.5">
                    <div>
                      <span className="font-bold text-foreground">
                        {order.recipient_name}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1.5">
                        ({order.recipient_no_hp})
                      </span>
                      {codInfo.altPhone && (
                        <span className="text-xs text-muted-foreground block mt-0.5">
                          No. Cadangan: <strong>{codInfo.altPhone}</strong>
                        </span>
                      )}
                    </div>
                    {order.recipient_no_hp && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 gap-1 border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                        asChild
                      >
                        <a
                          href={`https://wa.me/${order.recipient_no_hp.replace(/^0/, "62").replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle className="size-3.5" /> WhatsApp Pembeli
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
                {order.note && (
                  <div className="p-3 bg-muted/40 border border-border/60 rounded text-xs text-muted-foreground">
                    <strong className="text-foreground">Catatan Customer:</strong> {order.note}
                  </div>
                )}
              </div>
            </Card>
          ) : (
            /* KARTU INFORMASI PENGIRIMAN STANDAR / POS */
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
          )}
        </div>

        <aside className="space-y-6">
          {isCod ? (
            /* ASIDE KHUSUS COD (ADMIN) */
            <>
              {order.status === "pending" && (
                <Card className="border-amber-500/20 bg-amber-500/5 space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <Clock className="size-4 animate-pulse" /> Pengajuan COD Masuk
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Customer mengajukan COD di <strong>{codInfo.location}</strong> pada <strong>{codInfo.date} ({codInfo.timeSlot})</strong>.
                    </p>
                  </div>

                  <div className="p-3 bg-background/80 border border-amber-500/20 rounded text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Tagihan:</span>
                      <span className="font-extrabold text-foreground">{formatIDR(order.grand_total)}</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border">
                    <Button
                      onClick={handleAccCod}
                      className="w-full text-xs h-9 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <CheckCircle2 className="size-4" /> ACC & Jadwalkan COD
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => setCodRejectDialogOpen(true)}
                      className="w-full text-xs h-9 cursor-pointer text-destructive border-destructive/30 hover:bg-destructive/10"
                    >
                      Tolak Pengajuan COD
                    </Button>
                  </div>
                </Card>
              )}

              {order.status === "processing" && (
                <Card className="border-emerald-500/20 bg-emerald-500/5 space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="size-4" /> COD Telah Dijadwalkan
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Jadwal COD telah disetujui. Selesaikan pesanan setelah bertemu customer dan transaksi pembayaran selesai.
                    </p>
                  </div>

                  <div className="p-3 bg-background/80 border border-emerald-500/20 rounded text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lokasi:</span>
                      <span className="font-semibold text-foreground text-right">{codInfo.location}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Waktu:</span>
                      <span className="font-semibold text-foreground">{codInfo.date} ({codInfo.timeSlot})</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-border/50">
                      <span className="text-muted-foreground">Tagihan:</span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{formatIDR(order.grand_total)}</span>
                    </div>
                  </div>

                  <Button
                    onClick={() => setCompleteDialogOpen(true)}
                    className="w-full text-xs h-9 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <CheckCircle2 className="size-4" /> Selesaikan Pesanan COD
                  </Button>
                </Card>
              )}

              {order.status === "delivered" && (
                <Card className="border-emerald-500/20 bg-emerald-500/5 space-y-3 p-5">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-extrabold text-sm">
                    <CheckCircle2 className="size-5" />
                    <span>Pesanan COD Selesai</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Transaksi serah terima barang secara langsung telah selesai dilaksanakan.
                  </p>
                  {codProofUrl && (
                    <div className="pt-2 border-t border-emerald-500/20 space-y-1.5">
                      <span className="text-[11px] font-bold text-muted-foreground">Foto Bukti COD:</span>
                      <a href={codProofUrl} target="_blank" rel="noopener noreferrer">
                        <img
                          src={codProofUrl}
                          alt="Bukti COD"
                          className="w-full max-h-48 object-contain rounded border border-border bg-background"
                        />
                      </a>
                    </div>
                  )}
                </Card>
              )}

              {order.status === "cancelled" && (
                <Card className="border-destructive/20 bg-destructive/5 space-y-3 p-5">
                  <div className="flex items-center gap-2 text-destructive font-extrabold text-sm">
                    <AlertCircle className="size-5" />
                    <span>Pengajuan COD Ditolak / Batal</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {order.cancel_reason?.startsWith("COD Ditolak:")
                      ? order.cancel_reason
                      : (order.cancel_reason || "Pengajuan COD ini telah dibatalkan.")}
                  </p>
                </Card>
              )}
            </>
          ) : (
            /* ASIDE PENGIRIMAN STANDAR / MAYAR */
            <>
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
            </>
          )}
        </aside>
      </div>

      {/* Modal Tolak Pengajuan COD (Admin) */}
      <Dialog open={codRejectDialogOpen} onOpenChange={setCodRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive text-base font-bold">
              <AlertCircle className="size-5" /> Tolak Pengajuan COD
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Beri tahu customer alasan penolakan COD (misal: lokasi terlalu jauh, jadwal tidak tersedia, dsb).
              Stok produk akan otomatis dikembalikan ke sistem.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <label className="text-xs font-bold block mb-1.5 text-foreground">
              Alasan Penolakan <span className="text-destructive">*</span>
            </label>
            <Textarea
              placeholder="Contoh: Maaf min, jadwal pada jam tersebut sedang bentrok atau toko tutup..."
              value={codRejectReason}
              onChange={(e) => setCodRejectReason(e.target.value)}
              className="text-xs sm:text-sm min-h-[90px]"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCodRejectDialogOpen(false);
                setCodRejectReason("");
              }}
              disabled={rejectingCod}
              className="cursor-pointer text-xs"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleRejectCod}
              disabled={rejectingCod || !codRejectReason.trim()}
              className="cursor-pointer text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rejectingCod ? "Menolak..." : "Ya, Tolak Pengajuan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Selesaikan Pesanan COD (Admin) */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <CheckCircle2 className="size-5 text-emerald-600" /> Selesaikan Pesanan COD (Admin)
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Konfirmasi transaksi COD telah selesai dilakukan. Status pesanan akan ditutup menjadi Selesai.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold block mb-1 text-foreground">
                Unggah Foto Bukti Serah Terima <span className="text-muted-foreground font-normal">(Opsional)</span>
              </label>
              <p className="text-[11px] text-muted-foreground mb-2">
                Foto bukti pertemuan / produk diserahkan. Gambar akan otomatis dikompres dan dikonversi ke format WebP.
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const webpFile = await createWebpFile(file);
                    setCodProofFile(webpFile);
                    setCodProofPreview(URL.createObjectURL(webpFile));
                  } catch (err) {
                    toast.error("Gagal memproses gambar");
                  }
                }}
                className="text-xs w-full file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-border file:text-xs file:font-semibold file:bg-muted hover:file:bg-muted/80 cursor-pointer"
              />
            </div>

            {codProofPreview && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-muted-foreground">Pratinjau Foto WebP:</span>
                <div className="relative border border-border rounded overflow-hidden max-h-48 bg-muted/20">
                  <img src={codProofPreview} alt="Preview" className="w-full h-auto max-h-48 object-contain mx-auto" />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCompleteDialogOpen(false);
                setCodProofFile(null);
                setCodProofPreview(null);
              }}
              disabled={completingCod}
              className="cursor-pointer text-xs"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAdminCompleteCod}
              disabled={completingCod}
              className="cursor-pointer text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {completingCod ? "Menyelesaikan..." : "Selesaikan Pesanan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Cetak Struk & Invoice */}
      <OrderReceiptModal
        order={order as any}
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
      />
    </DashboardShell>
  );
}
