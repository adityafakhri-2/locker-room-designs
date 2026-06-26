import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { formatIDR, BANKS, statusLabel } from "@/lib/format";
import { uploadFile, signedUrl } from "@/lib/storage";
import { CheckCircle2, Clock, AlertCircle, Copy, ArrowRight, Upload } from "lucide-react";
import { checkMayarPaymentStatus } from "@/lib/api/payment.functions";
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

export const Route = createFileRoute("/checkout/success/$orderNumber")({
  component: PaymentPage,
});

function PaymentPage() {
  const { orderNumber } = useParams({ from: "/checkout/success/$orderNumber" });
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [uploading, setUploading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [forceShowUpload, setForceShowUpload] = useState(false);

  const q = useQuery({
    queryKey: ["order-success", orderNumber],
    queryFn: async () => {
      // 1. Call RPC check
      await supabase.rpc("check_and_cancel_expired_orders");

      // 2. Fetch order with order_items, payments, shipments
      const { data: order, error } = await supabase
        .from("orders")
        .select("*, order_items(*), payments(*)")
        .eq("order_number", orderNumber)
        .maybeSingle();

      if (error) throw error;
      if (!order) return null;

      const payment = Array.isArray(order.payments) ? order.payments[0] : (order.payments as any);

      // Jika pembayaran menggunakan Mayar, statusnya masih menunggu, dan ada ID invoice, cek ke Mayar API
      if (
        payment &&
        payment.method === "mayar" &&
        payment.status === "waiting_payment" &&
        payment.reject_reason
      ) {
        try {
          console.log(
            "[Checkout Success] Memeriksa status pembayaran Mayar secara langsung untuk invoice:",
            payment.reject_reason,
          );
          await checkMayarPaymentStatus({
            data: {
              paymentId: payment.id,
              invoiceId: payment.reject_reason,
            },
          });

          // Ambil ulang data order yang terupdate setelah diperiksa
          const { data: updatedOrder } = await supabase
            .from("orders")
            .select("*, order_items(*), payments(*)")
            .eq("order_number", orderNumber)
            .maybeSingle();

          if (updatedOrder) {
            return { order: updatedOrder, proofUrl: "" };
          }
        } catch (checkErr) {
          console.error("[Checkout Success] Gagal memeriksa status pembayaran Mayar:", checkErr);
        }
      }

      let proofUrl = "";
      if (payment) {
        const { data: proofs } = await supabase
          .from("payment_proofs")
          .select("*")
          .eq("payment_id", payment.id)
          .order("uploaded_at", { ascending: false })
          .limit(1);
        if (proofs && proofs[0]) {
          proofUrl = await signedUrl("payment-proofs", proofs[0].image_url);
        }
      }
      return { order, proofUrl };
    },
  });

  const order = q.data?.order;
  const payment = order
    ? ((Array.isArray(order.payments)
        ? order.payments[0]
        : (order.payments as Record<string, any> | null)) as {
        id: string;
        status: string;
        bank: string | null;
        method: string;
        reject_reason: string | null;
      } | null)
    : null;
  const isMayar = payment?.method === "mayar";
  const bank = !isMayar && payment ? BANKS.find((b) => b.code === payment.bank) : null;

  const createdAt = order ? new Date(order.created_at) : null;
  const deadline = createdAt ? new Date(createdAt.getTime() + 24 * 60 * 60 * 1000) : null;

  useEffect(() => {
    if (
      !order ||
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
        qc.invalidateQueries({ queryKey: ["order-success", orderNumber] });
      } else {
        setTimeLeft(Math.floor(diff / 1000));
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [order, payment, deadline, orderNumber, qc]);

  // Auto-approve mock payments for development
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isMockPaid = urlParams.get("mock_paid") === "true";

    if (isMockPaid && order && payment && payment.status === "waiting_payment") {
      const autoApprove = async () => {
        try {
          const { error } = await supabase
            .from("payments")
            .update({
              status: "approved",
              updated_at: new Date().toISOString(),
            })
            .eq("id", payment.id);

          if (error) throw error;

          toast.success("[Mock] Pembayaran sukses disimulasikan!");
          qc.invalidateQueries({ queryKey: ["order-success", orderNumber] });
        } catch (err) {
          toast.error("Gagal mensimulasikan pembayaran: " + (err as Error).message);
        }
      };
      autoApprove();
    }
  }, [order, payment, orderNumber, qc]);

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

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !payment || !user) return;
    setUploading(true);
    try {
      const path = `${user.id}/${order!.id}-${Date.now()}-${file.name}`;
      await uploadFile("payment-proofs", path, file);
      await supabase.from("payment_proofs").insert({ payment_id: payment.id, image_url: path });
      await supabase
        .from("payments")
        .update({
          status: "waiting_verification",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);
      toast.success("Bukti transfer diunggah");
      setForceShowUpload(false);
      qc.invalidateQueries({ queryKey: ["order-success", orderNumber] });
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
      qc.invalidateQueries({ queryKey: ["order-success", orderNumber] });
    } catch (e) {
      toast.error("Gagal membatalkan pesanan: " + (e as Error).message);
    }
  }

  if (authLoading)
    return (
      <>
        <Navbar />
        <div className="pt-32 container-swiss">Memuat...</div>
      </>
    );
  if (!user) {
    navigate({ to: "/auth" });
    return null;
  }

  if (q.isLoading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen pt-32 pb-20 container-swiss text-center">
          <p className="text-muted-foreground animate-pulse">Memuat halaman pembayaran...</p>
        </div>
        <Footer />
      </>
    );
  }

  if (!order) {
    return (
      <>
        <Navbar />
        <main id="main-content" className="min-h-screen pt-32 pb-20 container-swiss text-center">
          <AlertCircle className="size-16 text-destructive mx-auto" />
          <h1 className="display-lg mt-6">Pesanan Tidak Ditemukan</h1>
          <p className="mt-4 text-muted-foreground">
            Kami tidak dapat menemukan pesanan dengan nomor tersebut.
          </p>
          <div className="mt-8">
            <Button asChild className="cursor-pointer">
              <Link to="/shop" className="cursor-pointer">
                Kembali Belanja
              </Link>
            </Button>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main id="main-content" className="min-h-screen pt-24 md:pt-28 pb-20 container-swiss">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-3">
            <CheckCircle2 className="size-16 text-primary mx-auto" strokeWidth={1.5} />
            <h1 className="display-lg">Pesanan Berhasil Dibuat!</h1>
            <p className="text-muted-foreground">
              Selesaikan pembayaran Anda untuk memproses pesanan.
            </p>
            <div className="inline-block bg-muted/60 px-4 py-2 border border-border text-sm font-mono font-bold">
              ID Pesanan: {order.order_number}
            </div>
          </div>

          {/* Timer Section */}
          {payment &&
            payment.status === "waiting_payment" &&
            order.status === "pending" &&
            timeLeft !== null && (
              <div className="bg-amber-500/5 border border-amber-500/30 p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <Clock className="size-8 text-amber-500 animate-pulse flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-extrabold text-amber-600 dark:text-amber-400">
                    Sisa Waktu Pembayaran
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Segera lakukan transfer sebelum waktu habis agar pesanan tidak dibatalkan
                    otomatis.
                  </p>
                </div>
                <div className="font-mono text-2xl font-black text-amber-600 dark:text-amber-400 whitespace-nowrap bg-amber-500/10 px-4 py-2 border border-amber-500/20">
                  {timeLeft > 0 ? formatTimeLeft(timeLeft) : "Waktu Habis"}
                </div>
              </div>
            )}

          {order.status === "cancelled" && (
            <div className="bg-destructive/5 border border-destructive/30 p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <AlertCircle className="size-8 text-destructive flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-extrabold text-destructive">Pesanan Dibatalkan</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {order.cancel_reason === "customer"
                    ? "Pesanan ini telah dibatalkan atas permintaan Anda."
                    : order.cancel_reason === "admin"
                      ? "Pesanan ini telah dibatalkan oleh Admin."
                      : "Pesanan ini telah dibatalkan secara otomatis karena melewati batas waktu 24 jam."}
                </p>
              </div>
              <div className="font-bold text-destructive bg-destructive/10 px-4 py-2 border border-destructive/20 uppercase text-sm tracking-widest">
                Dibatalkan
              </div>
            </div>
          )}

          {/* Details & Payment Section */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Card: Bill details */}
            <div className="border border-border bg-background p-6 space-y-6">
              <div>
                <h3 className="font-extrabold text-base mb-1">Rincian Pembayaran</h3>
                <p className="text-xs text-muted-foreground">
                  {isMayar
                    ? "Pembayaran diproses secara instan & otomatis."
                    : "Silakan transfer nominal berikut tepat hingga rupiah terakhir."}
                </p>
              </div>

              <div className="bg-muted/40 p-4 border border-border relative group">
                <div className="text-xs eyebrow text-muted-foreground">Total Tagihan</div>
                <div className="text-2xl font-black text-primary mt-1 tracking-tight tabular-nums">
                  {formatIDR(order.grand_total)}
                </div>
                <button
                  onClick={() =>
                    copyToClipboard(order.grand_total.toString(), "Nominal tagihan disalin")
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-muted border border-transparent hover:border-border rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="Salin nominal"
                >
                  <Copy className="size-4 text-muted-foreground" />
                </button>
              </div>

              {order.status !== "cancelled" &&
                (isMayar ? (
                  <>
                    <div className="space-y-4">
                      <div className="text-sm">
                        <strong>Metode Pembayaran:</strong> Mayar.id (Otomatis)
                      </div>
                    </div>
                    <div className="text-xs space-y-2 border-t border-border pt-4 text-muted-foreground">
                      <h4 className="font-bold text-foreground">Instruksi Pembayaran Mayar:</h4>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>
                          Klik tombol <strong className="text-primary">Bayar Sekarang</strong> di
                          sebelah kanan.
                        </li>
                        <li>Pilih metode pembayaran (QRIS, VA, E-Wallet, Kartu Kredit).</li>
                        <li>Selesaikan pembayaran Anda di halaman Mayar.</li>
                        <li>
                          Setelah selesai, halaman ini akan otomatis mendeteksi status pembayaran
                          Anda.
                        </li>
                      </ol>
                    </div>
                  </>
                ) : (
                  <div className="text-sm border border-destructive/20 p-4 bg-destructive/5 rounded text-destructive">
                    <p className="font-bold">Transfer Manual Dinonaktifkan</p>
                    <p className="text-xs mt-1 text-muted-foreground leading-relaxed">
                      Metode pembayaran transfer bank manual tidak lagi didukung. Silakan hubungi
                      admin atau buat pesanan baru menggunakan Mayar.id.
                    </p>
                  </div>
                ))}
            </div>

            {/* Right Card: Upload Form or Mayar Pay Button */}
            <div className="border border-border bg-background p-6 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-extrabold text-base mb-1">
                    {order.status === "cancelled"
                      ? "Status Pembayaran"
                      : isMayar
                        ? "Proses Pembayaran"
                        : "Bukti Transfer"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {order.status === "cancelled"
                      ? "Pesanan dibatalkan. Tidak dapat melakukan pembayaran."
                      : isMayar
                        ? "Pembayaran instan diproses otomatis. Silakan lakukan pembayaran menggunakan tombol di bawah."
                        : "Metode transfer manual dinonaktifkan."}
                  </p>
                </div>

                {isMayar &&
                  payment &&
                  payment.status === "waiting_payment" &&
                  order.status === "pending" && (
                    <div className="space-y-4">
                      <div className="bg-primary/5 border border-primary/20 p-5 text-center rounded space-y-3">
                        <Clock className="size-8 text-primary mx-auto animate-pulse" />
                        <h4 className="font-bold text-sm">Menunggu Pembayaran Mayar</h4>
                        <p className="text-xs text-muted-foreground mb-4">
                          Silakan klik tombol di bawah untuk membayar tagihan Anda.
                        </p>

                        <Button
                          asChild
                          className="w-full h-12 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/95 text-sm font-bold flex items-center justify-center gap-2"
                        >
                          <a href={payment.bank || "#"} target="_self" rel="noopener noreferrer">
                            Bayar Sekarang via Mayar
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}

                {payment && payment.status === "waiting_verification" && (
                  <div className="bg-primary/5 border border-primary/20 p-4 space-y-2 text-center rounded">
                    <CheckCircle2 className="size-8 text-primary mx-auto" />
                    <h4 className="font-bold text-sm">Menunggu Verifikasi</h4>
                    <p className="text-xs text-muted-foreground">
                      Bukti pembayaran telah berhasil diunggah. Kami sedang memproses verifikasi
                      transaksi Anda.
                    </p>
                  </div>
                )}

                {payment && payment.status === "rejected" && (
                  <div className="bg-destructive/5 border border-destructive/20 p-4 space-y-3 rounded text-center">
                    <AlertCircle className="size-8 text-destructive mx-auto" />
                    <h4 className="font-bold text-sm text-destructive">Pembayaran Ditolak</h4>
                    {payment.reject_reason && (
                      <p className="text-xs text-muted-foreground">
                        Alasan: {payment.reject_reason}
                      </p>
                    )}
                  </div>
                )}

                {payment && (payment.status === "approved" || payment.status === "paid") && (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 text-center space-y-1.5 rounded">
                    <CheckCircle2 className="size-8 text-emerald-500 mx-auto" />
                    <h4 className="font-bold text-sm text-emerald-600 font-extrabold">
                      Pembayaran Berhasil
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {isMayar
                        ? "Pembayaran Anda telah diverifikasi otomatis oleh sistem. Pesanan Anda segera kami proses."
                        : "Pembayaran Anda telah diverifikasi. Pesanan Anda segera kami proses."}
                    </p>
                  </div>
                )}

                {!isMayar && q.data?.proofUrl && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold">Pratinjau Bukti:</div>
                    <div className="border border-border overflow-hidden bg-muted/30">
                      <img
                        src={q.data.proofUrl}
                        alt="Bukti Transfer"
                        className="w-full h-auto object-contain max-h-[180px]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Action Buttons */}
              <div className="flex flex-col gap-2.5 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full cursor-pointer flex items-center justify-center gap-2"
                  asChild
                >
                  <Link to="/dashboard/pesanan" className="cursor-pointer">
                    Lihat Daftar Pesanan <ArrowRight className="size-4" />
                  </Link>
                </Button>
                {order.status === "pending" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 cursor-pointer"
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
                )}
                <Button variant="ghost" className="w-full cursor-pointer" asChild>
                  <Link to="/shop" className="cursor-pointer">
                    Lanjut Belanja
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
