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

      let proofUrl = "";
      const payment = Array.isArray(order.payments) ? order.payments[0] : (order.payments as { id: string } | null);
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
        qc.invalidateQueries({ queryKey: ["order-success", orderNumber] });
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
      await supabase.from("payments").update({ 
        status: "waiting_verification",
        updated_at: new Date().toISOString()
      }).eq("id", payment.id);
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

  if (authLoading) return (<><Navbar /><div className="pt-32 container-swiss">Memuat...</div></>);
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
        <div className="min-h-screen pt-32 pb-20 container-swiss text-center">
          <AlertCircle className="size-16 text-destructive mx-auto" />
          <h1 className="display-lg mt-6">Pesanan Tidak Ditemukan</h1>
          <p className="mt-4 text-muted-foreground">Kami tidak dapat menemukan pesanan dengan nomor tersebut.</p>
          <div className="mt-8">
            <Button asChild className="cursor-pointer"><Link to="/shop" className="cursor-pointer">Kembali Belanja</Link></Button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen pt-24 md:pt-28 pb-20 container-swiss">
        <div className="max-w-3xl mx-auto space-y-8">
          
          {/* Header */}
          <div className="text-center space-y-3">
            <CheckCircle2 className="size-16 text-primary mx-auto" strokeWidth={1.5} />
            <h1 className="display-lg">Pesanan Berhasil Dibuat!</h1>
            <p className="text-muted-foreground">Selesaikan pembayaran Anda untuk memproses pesanan.</p>
            <div className="inline-block bg-muted/60 px-4 py-2 border border-border text-sm font-mono font-bold">
              ID Pesanan: {order.order_number}
            </div>
          </div>

          {/* Timer Section */}
          {payment && payment.status === "waiting_payment" && order.status === "pending" && timeLeft !== null && (
            <div className="bg-amber-500/5 border border-amber-500/30 p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <Clock className="size-8 text-amber-500 animate-pulse flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-extrabold text-amber-600 dark:text-amber-400">Sisa Waktu Pembayaran</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Segera lakukan transfer sebelum waktu habis agar pesanan tidak dibatalkan otomatis.</p>
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
                <p className="text-xs text-muted-foreground">Silakan transfer nominal berikut tepat hingga rupiah terakhir.</p>
              </div>

              <div className="bg-muted/40 p-4 border border-border relative group">
                <div className="text-xs eyebrow text-muted-foreground">Total Tagihan</div>
                <div className="text-2xl font-black text-primary mt-1 tracking-tight tabular-nums">
                  {formatIDR(order.grand_total)}
                </div>
                <button 
                  onClick={() => copyToClipboard(order.grand_total.toString(), "Nominal tagihan disalin")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-muted border border-transparent hover:border-border rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="Salin nominal"
                >
                  <Copy className="size-4 text-muted-foreground" />
                </button>
              </div>

              {bank ? (
                <div className="space-y-4">
                  <div className="text-sm">
                    <strong>Metode Pembayaran:</strong> Transfer Bank Manual
                  </div>
                  <div className="p-4 border border-border space-y-3 relative group">
                    <div className="text-xs eyebrow text-muted-foreground">Rekening Tujuan</div>
                    <div className="font-extrabold text-sm">{bank.name}</div>
                    <div className="font-mono text-xl font-bold tracking-wider tabular-nums">{bank.account}</div>
                    <div className="text-xs text-muted-foreground">a.n {bank.holder}</div>
                    <button 
                      onClick={() => copyToClipboard(bank.account, "Nomor rekening disalin")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-muted border border-transparent hover:border-border rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Salin nomor rekening"
                    >
                      <Copy className="size-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-destructive">Detail bank tidak ditemukan.</p>
              )}

              <div className="text-xs space-y-2 border-t border-border pt-4 text-muted-foreground">
                <h4 className="font-bold text-foreground">Instruksi Transfer:</h4>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Gunakan ATM, Mobile Banking, atau Internet Banking.</li>
                  <li>Masukkan nomor rekening tujuan di atas.</li>
                  <li>Masukkan nominal transfer tepat sebesar <strong className="text-foreground">{formatIDR(order.grand_total)}</strong>.</li>
                  <li>Simpan struk / bukti transfer sebagai gambar.</li>
                  <li>Unggah bukti transfer di kolom sebelah kanan.</li>
                </ol>
              </div>
            </div>

            {/* Right Card: Upload Form */}
            <div className="border border-border bg-background p-6 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-extrabold text-base mb-1">Bukti Transfer</h3>
                  <p className="text-xs text-muted-foreground">Unggah foto atau screenshot bukti transfer agar admin dapat langsung memverifikasi pembayaran.</p>
                </div>

                {payment && payment.status === "waiting_payment" && order.status === "pending" && (
                  <div className="space-y-3">
                    {(!q.data?.proofUrl || forceShowUpload) ? (
                      <div className="border-2 border-dashed border-border p-6 text-center space-y-3 rounded">
                        <Upload className="size-8 mx-auto text-muted-foreground animate-pulse" />
                        <div className="text-xs text-muted-foreground">
                          Format file: JPG, JPEG, PNG. Maks. 5MB.
                        </div>
                        <label className="inline-block">
                          <span className="bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold px-4 py-2 cursor-pointer transition-all shadow-sm">
                            Pilih File Bukti
                          </span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleUpload} 
                            disabled={uploading} 
                            className="hidden" 
                          />
                        </label>
                        {uploading && <div className="text-xs text-primary font-semibold animate-pulse mt-2">Mengunggah...</div>}
                        {q.data?.proofUrl && (
                          <Button 
                            variant="ghost" 
                            onClick={() => setForceShowUpload(false)} 
                            className="w-full text-xs h-8 text-muted-foreground hover:text-foreground cursor-pointer mt-2"
                          >
                            Batal Unggah Ulang
                          </Button>
                        )}
                      </div>
                    ) : (
                      <Button 
                        variant="outline" 
                        onClick={() => setForceShowUpload(true)} 
                        className="w-full text-xs h-9 border-primary/30 text-primary hover:bg-primary/5 cursor-pointer"
                      >
                        Unggah Ulang Bukti Pembayaran
                      </Button>
                    )}
                  </div>
                )}

                {payment && payment.status === "waiting_verification" && (
                  <div className="bg-primary/5 border border-primary/20 p-4 space-y-2 text-center rounded">
                    <CheckCircle2 className="size-8 text-primary mx-auto" />
                    <h4 className="font-bold text-sm">Menunggu Verifikasi</h4>
                    <p className="text-xs text-muted-foreground">Bukti pembayaran telah berhasil diunggah. Kami sedang memproses verifikasi transaksi Anda.</p>
                    {q.data?.proofUrl && (
                      <div className="pt-2 border-t border-primary/10 mt-2">
                        {forceShowUpload ? (
                          <div className="space-y-2">
                            <label className="block text-center mt-2">
                              <span className="bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold px-4 py-2 cursor-pointer transition-all shadow-sm">
                                Pilih File Baru
                              </span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                onChange={handleUpload} 
                                disabled={uploading} 
                                className="hidden" 
                              />
                            </label>
                            {uploading && <div className="text-xs text-primary font-semibold animate-pulse mt-2">Mengunggah...</div>}
                            <Button 
                              variant="ghost" 
                              onClick={() => setForceShowUpload(false)} 
                              className="w-full text-[11px] h-8 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              Batal
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            variant="outline" 
                            onClick={() => setForceShowUpload(true)} 
                            className="w-full text-xs h-9 border-primary/20 text-primary hover:bg-primary/5 cursor-pointer mt-1"
                          >
                            Unggah Ulang Bukti Pembayaran
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {payment && payment.status === "rejected" && (
                  <div className="bg-destructive/5 border border-destructive/20 p-4 space-y-3 rounded">
                    <AlertCircle className="size-8 text-destructive mx-auto" />
                    <h4 className="font-bold text-sm text-destructive">Pembayaran Ditolak</h4>
                    {payment.reject_reason && <p className="text-xs text-muted-foreground">Alasan: {payment.reject_reason}</p>}
                    {order.status === "pending" && (
                      <div className="border-t border-destructive/15 pt-3">
                        {(!q.data?.proofUrl || forceShowUpload) ? (
                          <div className="space-y-2">
                            <label className="block text-center">
                              <span className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs font-semibold px-4 py-2 cursor-pointer transition-all shadow-sm">
                                Pilih File Bukti Baru
                              </span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                onChange={handleUpload} 
                                disabled={uploading} 
                                className="hidden" 
                              />
                            </label>
                            {uploading && <div className="text-xs text-destructive font-semibold animate-pulse mt-2">Mengunggah...</div>}
                            {q.data?.proofUrl && (
                              <Button 
                                variant="ghost" 
                                onClick={() => setForceShowUpload(false)} 
                                className="w-full text-xs h-8 text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                Batal Unggah Ulang
                              </Button>
                            )}
                          </div>
                        ) : (
                          <Button 
                            variant="outline" 
                            onClick={() => setForceShowUpload(true)} 
                            className="w-full text-xs h-9 border-destructive/30 text-destructive hover:bg-destructive/5 cursor-pointer"
                          >
                            Unggah Ulang Bukti Pembayaran
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {payment && (payment.status === "approved" || payment.status === "paid") && (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 text-center space-y-1.5 rounded">
                    <CheckCircle2 className="size-8 text-emerald-500 mx-auto" />
                    <h4 className="font-bold text-sm text-emerald-600">Pembayaran Berhasil</h4>
                    <p className="text-xs text-muted-foreground">Pembayaran Anda telah diverifikasi oleh admin. Pesanan Anda segera kami proses.</p>
                  </div>
                )}

                {q.data?.proofUrl && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold">Pratinjau Bukti:</div>
                    <div className="border border-border overflow-hidden bg-muted/30">
                      <img src={q.data.proofUrl} alt="Bukti Transfer" className="w-full h-auto object-contain max-h-[180px]" />
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Action Buttons */}
              <div className="flex flex-col gap-2.5 pt-4 border-t border-border">
                <Button variant="outline" className="w-full cursor-pointer flex items-center justify-center gap-2" asChild>
                  <Link to="/dashboard/pesanan" className="cursor-pointer">
                    Lihat Daftar Pesanan <ArrowRight className="size-4" />
                  </Link>
                </Button>
                {order.status === "pending" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/10 cursor-pointer">
                        Batalkan Pesanan
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Batalkan Pesanan?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Apakah Anda yakin ingin membatalkan pesanan ini? Stok produk akan dikembalikan dan tindakan ini tidak dapat dibatalkan.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="cursor-pointer">Kembali</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancelOrder} className="bg-destructive text-destructive-foreground hover:bg-destructive/95 cursor-pointer">
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
      </div>
      <Footer />
    </>
  );
}
