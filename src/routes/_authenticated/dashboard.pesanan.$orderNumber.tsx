import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { CUSTOMER_NAV } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { formatIDR, formatDateTime, statusLabel, BANKS } from "@/lib/format";
import { uploadFile, signedUrl } from "@/lib/storage";
import { Clock, AlertCircle, CheckCircle2, Copy, Upload, Image, ExternalLink, HandCoins, MapPin, Calendar, MessageCircle, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { isCodOrder, parseCodInfo, formatCodWhatsAppUrl, STORE_PHONE_DISPLAY } from "@/lib/orderCod";
import { createWebpFile } from "@/lib/imageCompression";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
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

const COURIER_TRACKING_URLS: Record<string, string> = {
  JNE: "https://jne.co.id/tracking-package",
  "J&T": "https://jet.co.id/track",
  SiCepat: "https://www.sicepat.com/checkAwb",
  AnterAja: "https://anteraja.id/tracking",
};

export const Route = createFileRoute("/_authenticated/dashboard/pesanan/$orderNumber")({
  component: OrderDetail,
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

interface DashboardPaymentInfo {
  id: string;
  status: string;
  bank: string | null;
  method: string;
  reject_reason: string | null;
  updated_at: string;
  verified_at?: string | null;
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

function OrderDetail() {
  const { orderNumber } = useParams({ from: "/_authenticated/dashboard/pesanan/$orderNumber" });
  const { user } = useAuth();
  const qc = useQueryClient();

  const [uploading, setUploading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [forceShowUpload, setForceShowUpload] = useState(false);

  const q = useQuery({
    queryKey: ["order", orderNumber],
    queryFn: async () => {
      // Call RPC check first
      await supabase.rpc("check_and_cancel_expired_orders");

      const { data: order } = await supabase
        .from("orders")
        .select("*, order_items(*), payments(*), shipments(*)")
        .eq("order_number", orderNumber)
        .maybeSingle();
      if (!order) return null;

      const payment = Array.isArray(order.payments)
        ? order.payments[0]
        : (order.payments as DashboardPaymentInfo | undefined);

      // Jika menggunakan Mayar dan masih menunggu pembayaran, cek langsung statusnya ke API Mayar
      if (
        payment &&
        payment.method === "mayar" &&
        payment.status === "waiting_payment" &&
        payment.reject_reason
      ) {
        try {
          const { checkMayarPaymentStatus } = await import("@/lib/api/payment.functions");
          await checkMayarPaymentStatus({
            data: {
              paymentId: payment.id,
              invoiceId: payment.reject_reason,
            },
          });

          // Ambil ulang data order yang terupdate setelah diperiksa
          const { data: updatedOrder } = await supabase
            .from("orders")
            .select("*, order_items(*), payments(*), shipments(*)")
            .eq("order_number", orderNumber)
            .maybeSingle();

          if (updatedOrder) {
            return { order: updatedOrder, proofUrl: "", proofUploadedAt: null };
          }
        } catch (checkErr) {
          console.error("[Dashboard Pesanan] Gagal memeriksa status pembayaran Mayar:", checkErr);
        }
      }

      let proofUrl = "";
      let proofUploadedAt = null;
      let codProofUrl = "";

      if ((order as any)?.cod_proof_url) {
        try {
          codProofUrl = await signedUrl("payment-proofs", (order as any).cod_proof_url);
        } catch {}
      }

      if (payment) {
        const { data: proofs } = await supabase
          .from("payment_proofs")
          .select("*")
          .eq("payment_id", payment.id)
          .order("uploaded_at", { ascending: false })
          .limit(1);
        if (proofs && proofs[0]) {
          proofUrl = await signedUrl("payment-proofs", proofs[0].image_url);
          proofUploadedAt = proofs[0].uploaded_at;
          if (!codProofUrl) codProofUrl = proofUrl;
        }
      }
      return { order, proofUrl, proofUploadedAt, codProofUrl };
    },
  });

  const order = q.data?.order;
  const isCod = isCodOrder(order);
  const codInfo = parseCodInfo(order);
  const payment = order
    ? ((Array.isArray(order.payments)
        ? order.payments[0]
        : (order.payments as unknown)) as DashboardPaymentInfo | null)
    : null;
  const isMayar = payment?.method === "mayar";
  const bank = !isMayar && payment ? BANKS.find((b) => b.code === payment.bank) : null;

  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [codProofFile, setCodProofFile] = useState<File | null>(null);
  const [codProofPreview, setCodProofPreview] = useState<string | null>(null);
  const [completingCod, setCompletingCod] = useState(false);

  const deadline = useMemo(() => {
    const createdAt = order ? new Date(order.created_at) : null;
    return createdAt ? new Date(createdAt.getTime() + 24 * 60 * 60 * 1000) : null;
  }, [order]);

  useEffect(() => {
    if (
      !order ||
      isCod ||
      order.status !== "pending" ||
      !payment ||
      !["waiting_payment", "rejected"].includes(payment.status) ||
      !deadline
    ) {
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

  // Clean up object URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
      if (codProofPreview) URL.revokeObjectURL(codProofPreview);
    };
  }, [localPreview, codProofPreview]);

  const formatTimeLeft = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h} jam ${m} menit ${s} detik`;
  };

  const copyToClipboard = (text: string, msg: string) => {
    navigator.clipboard.writeText(text);
    toast.success(msg);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(URL.createObjectURL(file));
  };

  const handleCancelSelection = () => {
    setSelectedFile(null);
    if (localPreview) {
      URL.revokeObjectURL(localPreview);
      setLocalPreview(null);
    }
  };

  async function handleUpload() {
    if (!selectedFile || !payment || !user) return;
    setUploading(true);
    try {
      const path = `${user.id}/${order!.id}-${Date.now()}-${selectedFile.name}`;
      await uploadFile("payment-proofs", path, selectedFile);
      await supabase.from("payment_proofs").insert({ payment_id: payment.id, image_url: path });
      await supabase
        .from("payments")
        .update({
          status: "waiting_verification",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      toast.success("Bukti transfer diunggah");
      setSelectedFile(null);
      setLocalPreview(null);
      setForceShowUpload(false);
      qc.invalidateQueries({ queryKey: ["order", orderNumber] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleCancelOrder() {
    if (!order) return;
    try {
      const { error } = await supabase.rpc("cancel_own_order", { target_order_id: order.id });
      if (error) throw error;
      toast.success("Pesanan berhasil dibatalkan");
      qc.invalidateQueries({ queryKey: ["order", orderNumber] });
    } catch (e) {
      toast.error("Gagal membatalkan pesanan: " + (e as Error).message);
    }
  }

  async function handleConfirmDelivery() {
    if (!order) return;
    try {
      const { error } = await supabase.rpc("confirm_delivery_own_order", {
        target_order_id: order.id,
      });
      if (error) throw error;
      toast.success("Terima kasih! Pesanan Anda telah ditandai sebagai Selesai.");
      qc.invalidateQueries({ queryKey: ["order", orderNumber] });
    } catch (e) {
      toast.error("Gagal mengonfirmasi penerimaan: " + (e as Error).message);
    }
  }

  async function handleCompleteCodOrder() {
    if (!order) return;
    setCompletingCod(true);
    try {
      let uploadedPath: string | null = null;
      if (codProofFile && user) {
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

      toast.success("Terima kasih! Pesanan COD Anda telah diselesaikan.");
      setCompleteDialogOpen(false);
      setCodProofFile(null);
      setCodProofPreview(null);
      qc.invalidateQueries({ queryKey: ["order", orderNumber] });
    } catch (err) {
      toast.error("Gagal menyelesaikan pesanan COD: " + (err as Error).message);
    } finally {
      setCompletingCod(false);
    }
  }

  if (q.isLoading)
    return (
      <DashboardShell items={CUSTOMER_NAV} title="Akun Saya">
        Memuat...
      </DashboardShell>
    );
  if (!order)
    return (
      <DashboardShell items={CUSTOMER_NAV} title="Akun Saya">
        Pesanan tidak ditemukan.
      </DashboardShell>
    );

  const proofUrl = q.data?.proofUrl;
  const proofUploadedAt = q.data?.proofUploadedAt || null;

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
    <DashboardShell items={CUSTOMER_NAV} title="Akun Saya">
      <PageHeader
        eyebrow={order.order_number}
        title={statusLabel(displayStatus)}
        action={
          <Link
            to="/dashboard/pesanan"
            className="text-sm text-muted-foreground hover:underline cursor-pointer"
          >
            ← Kembali
          </Link>
        }
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
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
            <h3 className="font-extrabold mb-4">Item Pesanan</h3>
            {order.order_items?.map((it) => (
              <div key={it.id} className="flex gap-4 py-3 border-b border-border/50 last:border-0">
                <div className="size-16 bg-muted overflow-hidden flex-shrink-0">
                  {it.image_url && (
                    <img src={it.image_url} alt="" className="size-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{it.product_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {it.size} × {it.quantity}
                  </div>
                </div>
                <div className="text-sm tabular-nums">{formatIDR(it.subtotal)}</div>
              </div>
            ))}
            <div className="mt-4 space-y-1 text-sm text-right">
              <div>
                Subtotal:{" "}
                <span className="font-semibold tabular-nums">{formatIDR(order.subtotal)}</span>
              </div>
              <div>
                Ongkir ({order.courier}):{" "}
                <span className="font-semibold tabular-nums">{formatIDR(order.shipping_cost)}</span>
              </div>
              <div className="text-base font-extrabold">Total: {formatIDR(order.grand_total)}</div>
            </div>
          </Card>

          {isCod ? (
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <HandCoins className="size-5 text-emerald-600" />
                <h3 className="font-extrabold">Informasi COD & Lokasi Ketemuan</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">Lokasi Ketemuan:</span>
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
                  <span className="text-xs text-muted-foreground block">Kontak Pemesan:</span>
                  <p className="font-medium text-foreground">
                    {order.recipient_name} · {order.recipient_no_hp}
                    {codInfo.altPhone ? ` (Alternatif: ${codInfo.altPhone})` : ""}
                  </p>
                </div>
                {order.note && (
                  <div className="p-3 bg-muted/40 border border-border/60 rounded text-xs text-muted-foreground">
                    <strong className="text-foreground">Catatan:</strong> {order.note}
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card>
              <h3 className="font-extrabold mb-4">Alamat Pengiriman</h3>
              <p className="text-sm">
                <strong>{order.recipient_name}</strong> · {order.recipient_no_hp}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {order.recipient_alamat}, {order.recipient_kota}, {order.recipient_provinsi}{" "}
                {order.recipient_kode_pos}
              </p>
              {order.tracking_number && (
                <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Resi {order.courier}:</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-foreground">
                      <span>{order.tracking_number}</span>
                      <button
                        onClick={() =>
                          copyToClipboard(order.tracking_number || "", "Nomor resi disalin")
                        }
                        className="p-1 hover:bg-muted border border-transparent hover:border-border rounded cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none"
                        title="Salin nomor resi"
                        aria-label="Salin nomor resi"
                      >
                        <Copy className="size-3 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-7 cursor-pointer flex items-center justify-center gap-1.5"
                    asChild
                  >
                    <a
                      href={
                        (order.courier && COURIER_TRACKING_URLS[order.courier]) ??
                        `https://cekresi.com/?noresi=${order.tracking_number}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Lacak Resi <ExternalLink className="size-3" />
                    </a>
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          {isCod ? (
            /* ==========================================
               SIDEBAR KHUSUS PESANAN COD (CUSTOMER)
               ========================================== */
            <>
              {order.status === "processing" && (
                <Card className="border-emerald-500/20 bg-emerald-500/5 space-y-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="size-4" /> COD Dijadwalkan
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Admin telah menyetujui jadwal dan lokasi ketemuan langsung Anda. Silakan hadir tepat waktu.
                    </p>
                  </div>

                  <div className="p-3 bg-background/80 border border-emerald-500/20 rounded text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lokasi:</span>
                      <span className="font-semibold text-foreground text-right">{codInfo.location}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Waktu:</span>
                      <span className="font-semibold text-foreground">
                        {codInfo.date} ({codInfo.timeSlot})
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-border/50">
                      <span className="text-muted-foreground">Tagihan COD:</span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                        {formatIDR(order.grand_total)}
                      </span>
                    </div>
                  </div>

                  <Button
                    asChild
                    variant="outline"
                    className="w-full text-xs h-9 cursor-pointer border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 flex items-center justify-center gap-1.5"
                  >
                    <a
                      href={formatCodWhatsAppUrl({
                        orderNumber: order.order_number,
                        customerName: order.recipient_name,
                        items: order.order_items as any,
                        total: order.grand_total,
                        location: codInfo.location,
                        date: codInfo.date,
                        timeSlot: codInfo.timeSlot,
                        altPhone: codInfo.altPhone,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="size-4" /> Hubungi Admin via WA
                    </a>
                  </Button>

                  <Button
                    onClick={() => setCompleteDialogOpen(true)}
                    className="w-full text-xs h-9 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <CheckCircle2 className="size-4" /> Selesaikan Pesanan COD
                  </Button>
                </Card>
              )}

              {order.status === "pending" && (
                <Card className="border-amber-500/20 bg-amber-500/5 space-y-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <Clock className="size-4 animate-pulse" /> Menunggu ACC Admin
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Pengajuan lokasi dan jadwal COD Anda sedang ditinjau oleh Admin toko.
                    </p>
                  </div>

                  <div className="p-3 bg-background/80 border border-amber-500/20 rounded text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Tagihan:</span>
                      <span className="font-extrabold text-foreground">{formatIDR(order.grand_total)}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      * Dibayar tunai/transfer saat serah terima barang.
                    </div>
                  </div>

                  <Button
                    asChild
                    className="w-full text-xs h-9 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <a
                      href={formatCodWhatsAppUrl({
                        orderNumber: order.order_number,
                        customerName: order.recipient_name,
                        items: order.order_items as any,
                        total: order.grand_total,
                        location: codInfo.location,
                        date: codInfo.date,
                        timeSlot: codInfo.timeSlot,
                        altPhone: codInfo.altPhone,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="size-4" /> Hubungi Admin via WA
                    </a>
                  </Button>

                  <div className="pt-2 border-t border-border">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 text-xs h-9 cursor-pointer"
                        >
                          Batalkan Pengajuan COD
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Batalkan Pengajuan COD?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Apakah Anda yakin ingin membatalkan pengajuan pesanan COD ini? Stok produk akan
                            dikembalikan dan tindakan ini tidak dapat dibatalkan.
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
                </Card>
              )}

              {order.status === "delivered" && (
                <Card className="border-emerald-500/20 bg-emerald-500/5 space-y-4 text-center p-6">
                  <div className="space-y-2">
                    <CheckCircle2 className="size-10 text-emerald-500 mx-auto" />
                    <h4 className="font-extrabold text-base text-emerald-700">Pesanan COD Selesai!</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Transaksi serah terima barang secara langsung telah selesai. Terima kasih telah
                      berbelanja di <strong>AA Jersey</strong>!
                    </p>
                  </div>
                  {q.data?.codProofUrl && (
                    <div className="text-left space-y-1.5 pt-2 border-t border-emerald-500/20">
                      <span className="text-[11px] font-bold text-muted-foreground">Foto Bukti COD:</span>
                      <a href={q.data.codProofUrl} target="_blank" rel="noopener noreferrer">
                        <img
                          src={q.data.codProofUrl}
                          alt="Bukti COD"
                          className="w-full max-h-48 object-contain rounded border border-border bg-background"
                        />
                      </a>
                    </div>
                  )}
                  <div className="pt-1">
                    <Button
                      className="w-full text-xs h-9 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
                      asChild
                    >
                      <Link to="/shop">Lihat Koleksi Lainnya</Link>
                    </Button>
                  </div>
                </Card>
              )}

              {order.status === "cancelled" && (
                <Card className="border-destructive/20 bg-destructive/5 space-y-3 p-5">
                  <div className="flex items-center gap-2 text-destructive font-extrabold text-sm">
                    <AlertCircle className="size-5" />
                    <span>Pengajuan COD Dibatalkan</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {order.cancel_reason?.startsWith("COD Ditolak:")
                      ? order.cancel_reason
                      : order.cancel_reason === "customer"
                        ? "Pesanan telah dibatalkan atas permintaan Anda."
                        : order.cancel_reason === "admin"
                          ? "Pesanan telah ditolak/dibatalkan oleh Admin."
                          : (order.cancel_reason || "Pesanan COD ini telah dibatalkan.")}
                  </p>
                </Card>
              )}
            </>
          ) : (
            /* ==========================================
               SIDEBAR STANDARD PENGIRIMAN EKSPEDISI
               ========================================== */
            <>
              {order.status === "delivered" && (
                <Card className="border-emerald-500/20 bg-emerald-500/5 space-y-4 text-center p-6">
                  <div className="space-y-2">
                    <CheckCircle2 className="size-10 text-emerald-500 mx-auto animate-bounce" />
                    <h4 className="font-extrabold text-base text-emerald-700">Pesanan Selesai!</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Terima kasih banyak telah berbelanja di <strong>AA Jersey</strong>. Kami
                      harap Anda menyukai produk kami!
                    </p>
                  </div>
                  <div className="pt-1">
                    <Button
                      className="w-full text-xs h-9 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm flex items-center justify-center gap-1.5"
                      asChild
                    >
                      <Link to="/shop">Lihat Koleksi Lainnya</Link>
                    </Button>
                  </div>
                </Card>
              )}

              {order.status === "shipped" && (
                <Card className="border-primary/20 bg-primary/5 space-y-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
                      <CheckCircle2 className="size-4 text-primary" /> Pesanan Telah Dikirim
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Pesanan Anda sedang dalam pengiriman. Silakan konfirmasi jika barang sudah sampai
                      dan diterima dengan baik.
                    </p>
                  </div>

                  {order.tracking_number && (
                    <div className="border border-primary/10 bg-background/50 p-3 rounded-lg space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground font-medium">Jasa Pengiriman:</span>
                        <span className="font-bold text-foreground">{order.courier}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground font-medium">No. Resi:</span>
                        <div className="flex items-center gap-1.5">
                          <code className="font-mono font-bold text-foreground bg-muted/50 px-1.5 py-0.5 rounded text-[11px]">
                            {order.tracking_number}
                          </code>
                          <button
                            onClick={() =>
                              copyToClipboard(order.tracking_number || "", "Nomor resi disalin")
                            }
                            className="p-1 hover:bg-muted border border-transparent hover:border-border rounded cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none"
                            title="Salin nomor resi"
                            aria-label="Salin nomor resi"
                          >
                            <Copy className="size-3 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs h-8 cursor-pointer flex items-center justify-center gap-1.5 border-primary/20 text-primary hover:bg-primary/5"
                        asChild
                      >
                        <a
                          href={
                            (order.courier && COURIER_TRACKING_URLS[order.courier]) ??
                            `https://cekresi.com/?noresi=${order.tracking_number}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Lacak Resi <ExternalLink className="size-3" />
                        </a>
                      </Button>
                    </div>
                  )}

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="w-full text-xs h-9 cursor-pointer bg-primary hover:bg-primary/95 text-primary-foreground font-semibold shadow-sm flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="size-4" /> Konfirmasi Pesanan Diterima
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Konfirmasi Terima Pesanan?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Apakah Anda yakin telah menerima pesanan ini dengan baik? Tindakan ini akan
                          menyelesaikan pesanan Anda dan status akan berubah menjadi Selesai.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="cursor-pointer">Batal</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleConfirmDelivery}
                          className="bg-primary text-primary-foreground hover:bg-primary/95 cursor-pointer"
                        >
                          Ya, Pesanan Diterima
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </Card>
              )}

              {["pending", "cancelled"].includes(order.status) && (
                <Card className="space-y-5">
                  <div>
                    <div className="eyebrow text-muted-foreground">Pembayaran</div>
                    <div className="text-lg font-extrabold mt-1">
                      {order.status === "cancelled"
                        ? order.cancel_reason === "customer"
                          ? "Dibatalkan Pelanggan"
                          : "Dibatalkan"
                        : payment
                          ? statusLabel(payment.status)
                          : "—"}
                    </div>
                  </div>

                  {/* Timer countdown at the very top of Payment status if pending */}
                  {payment &&
                    payment.status === "waiting_payment" &&
                    order.status === "pending" &&
                    timeLeft !== null && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs rounded flex items-center gap-2">
                        <Clock className="size-4 animate-pulse flex-shrink-0" />
                        <div>
                          <div className="font-semibold">Sisa Waktu Pembayaran:</div>
                          <div className="font-mono mt-0.5">
                            {timeLeft > 0 ? formatTimeLeft(timeLeft) : "Waktu Habis"}
                          </div>
                        </div>
                      </div>
                    )}

                  {order.status === "cancelled" && (
                    <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive text-xs rounded flex items-center gap-2">
                      <AlertCircle className="size-4 flex-shrink-0" />
                      <div>
                        <div className="font-semibold">Pesanan Dibatalkan</div>
                        <div className="mt-0.5">
                          {order.cancel_reason === "customer"
                            ? "Pesanan telah dibatalkan oleh pelanggan."
                            : order.cancel_reason === "admin"
                              ? "Pesanan telah dibatalkan oleh Admin."
                              : "Waktu pembayaran telah habis."}
                        </div>
                      </div>
                    </div>
                  )}

                  {order.status !== "cancelled" && (
                    <>
                      {isMayar ? (
                        <div className="text-sm space-y-2 border border-primary/20 p-4 bg-primary/5 rounded relative group">
                          <div className="eyebrow text-xs text-muted-foreground font-semibold">
                            Metode Pembayaran
                          </div>
                          <div className="font-bold text-sm">Mayar.id (Otomatis)</div>
                          <div className="text-sm font-extrabold mt-2 pt-2 border-t border-border/50">
                            Nominal: {formatIDR(order.grand_total)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm border border-destructive/20 p-4 bg-destructive/5 rounded text-destructive">
                          <p className="font-bold">Transfer Manual Dinonaktifkan</p>
                          <p className="text-xs mt-1 text-muted-foreground leading-relaxed">
                            Metode pembayaran transfer bank manual tidak lagi didukung. Silakan hubungi
                            admin atau buat pesanan baru menggunakan Mayar.id.
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Transfer Instructions */}
                  {order.status !== "cancelled" &&
                    payment &&
                    ["waiting_payment", "rejected"].includes(payment.status) &&
                    order.status === "pending" && (
                      <div className="text-xs space-y-1.5 text-muted-foreground border-t border-border pt-4">
                        <h4 className="font-bold text-foreground">Instruksi Pembayaran:</h4>
                        {isMayar ? (
                          <ol className="list-decimal list-inside space-y-0.5">
                            <li>
                              Klik tombol{" "}
                              <strong className="text-primary">Bayar Sekarang via Mayar</strong> di
                              bawah.
                            </li>
                            <li>
                              Selesaikan pembayaran Anda menggunakan opsi QRIS, VA, E-Wallet, dll.
                            </li>
                            <li>
                              Setelah selesai, halaman ini akan otomatis memverifikasi status pembayaran
                              Anda saat direfresh.
                            </li>
                          </ol>
                        ) : (
                          <p className="text-destructive font-semibold">
                            Metode pembayaran transfer manual telah dinonaktifkan. Silakan hubungi admin
                            untuk bantuan pembayaran pesanan ini.
                          </p>
                        )}
                      </div>
                    )}

                  {/* Redesigned Highlighted Upload Box / Mayar Payment Box */}
                  <div className="border-t border-border pt-4 space-y-4">
                    {order.status !== "cancelled" ? (
                      isMayar ? (
                        <>
                          {payment &&
                            payment.status === "waiting_payment" &&
                            order.status === "pending" && (
                              <div className="bg-primary/5 border border-primary/20 p-4 text-center rounded space-y-3">
                                <Clock className="size-6 text-primary mx-auto animate-pulse" />
                                <h4 className="font-bold text-xs">Menunggu Pembayaran</h4>
                                <p className="text-[11px] text-muted-foreground">
                                  Silakan selesaikan pembayaran tagihan Anda via Mayar.id dengan tombol
                                  di bawah.
                                </p>
                                <Button
                                  asChild
                                  className="w-full text-xs h-9 cursor-pointer bg-primary hover:bg-primary/95 text-primary-foreground font-semibold flex items-center justify-center gap-1.5"
                                >
                                  <a
                                    href={payment.bank || "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Bayar Sekarang via Mayar
                                  </a>
                                </Button>
                              </div>
                            )}

                          {payment && (payment.status === "approved" || payment.status === "paid") && (
                            <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 text-center space-y-1.5 rounded">
                              <CheckCircle2 className="size-6 text-emerald-500 mx-auto" />
                              <h4 className="font-bold text-xs text-emerald-600 font-extrabold">
                                Pembayaran Berhasil
                              </h4>
                              <p className="text-[11px] text-muted-foreground">
                                Pembayaran Anda terverifikasi otomatis. Pesanan segera diproses.
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {payment && payment.status === "waiting_verification" && (
                            <div className="bg-primary/5 border border-primary/20 p-4 space-y-2 text-center rounded">
                              <CheckCircle2 className="size-6 text-primary mx-auto" />
                              <h4 className="font-bold text-xs">Menunggu Verifikasi</h4>
                              <p className="text-[11px] text-muted-foreground">
                                Bukti transfer sedang diproses verifikasi oleh admin.
                              </p>
                            </div>
                          )}

                          {payment && payment.status === "rejected" && (
                            <div className="bg-destructive/5 border border-destructive/20 p-3 space-y-1.5 rounded text-center">
                              <AlertCircle className="size-6 text-destructive mx-auto" />
                              <h4 className="font-bold text-xs text-destructive">Pembayaran Ditolak</h4>
                              {payment.reject_reason && (
                                <p className="text-[11px] text-muted-foreground">
                                  Alasan: {payment.reject_reason}
                                </p>
                              )}
                            </div>
                          )}

                          {payment && (payment.status === "approved" || payment.status === "paid") && (
                            <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 text-center space-y-1.5 rounded">
                              <CheckCircle2 className="size-6 text-emerald-500 mx-auto" />
                              <h4 className="font-bold text-xs text-emerald-600 font-extrabold">
                                Pembayaran Berhasil
                              </h4>
                              <p className="text-[11px] text-muted-foreground">
                                Pembayaran terverifikasi. Pesanan segera dikirim.
                              </p>
                            </div>
                          )}

                          {q.data?.proofUrl && (
                            <div className="space-y-1.5 mt-3">
                              <div className="text-[11px] font-bold text-muted-foreground">
                                Bukti Terunggah:
                              </div>
                              <img
                                src={q.data.proofUrl}
                                alt="Bukti transfer"
                                className="w-full border border-border rounded"
                              />
                            </div>
                          )}
                        </>
                      )
                    ) : (
                      q.data?.proofUrl && (
                        <div className="space-y-1.5 mt-3">
                          <div className="text-[11px] font-bold text-muted-foreground">
                            Bukti Terunggah:
                          </div>
                          <img
                            src={q.data.proofUrl}
                            alt="Bukti transfer"
                            className="w-full border border-border rounded"
                          />
                        </div>
                      )
                    )}

                    {/* Batalkan Pesanan Button */}
                    {order.status === "pending" && (
                      <div className="pt-4 border-t border-border mt-4">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 text-xs h-9 cursor-pointer"
                            >
                              Batalkan Pesanan
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Batalkan Pesanan?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Apakah Anda yakin ingin membatalkan pesanan ini? Stok produk akan
                                dikembalikan dan tindakan ini tidak dapat dibatalkan.
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
                  </div>
                </Card>
              )}
            </>
          )}
        </aside>
      </div>

      {/* Modal Selesaikan Pesanan COD (Customer) */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <CheckCircle2 className="size-5 text-emerald-600" /> Selesaikan Pesanan COD
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Konfirmasi bahwa Anda telah bertemu langsung dengan Admin AA Jersey, menerima produk,
              dan menyelesaikan pembayaran di tempat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold block mb-1 text-foreground">
                Unggah Foto Bukti Serah Terima <span className="text-muted-foreground font-normal">(Opsional)</span>
              </label>
              <p className="text-[11px] text-muted-foreground mb-2">
                Foto bukti pertemuan / jersey yang diterima. Gambar akan otomatis dikompres dan dikonversi ke format WebP.
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
              onClick={handleCompleteCodOrder}
              disabled={completingCod}
              className="cursor-pointer text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {completingCod ? "Menyelesaikan..." : "Ya, Selesaikan Pesanan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
