import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatIDR, formatDateTime } from "@/lib/format";
import { getPublicStoreInfo } from "@/lib/api/shipping.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, Share2, Check, Receipt, FileText } from "lucide-react";
import { toast } from "sonner";

export interface OrderReceiptData {
  id: string;
  order_number: string;
  created_at: string;
  recipient_name: string;
  recipient_no_hp?: string | null;
  recipient_alamat?: string | null;
  recipient_kota?: string | null;
  subtotal: number;
  shipping_cost?: number;
  discount_amount?: number;
  grand_total: number;
  note?: string | null;
  status: string;
  payments?: any;
  order_items?: Array<{
    id?: string;
    product_name: string;
    size?: string | null;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
}

export function OrderReceiptModal({
  order,
  isOpen,
  onClose,
}: {
  order: OrderReceiptData | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [viewMode, setViewMode] = useState<"thermal" | "invoice">("thermal");
  const [copied, setCopied] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Dynamic store profile info from admin settings
  const { data: storeInfo } = useQuery({
    queryKey: ["public-store-info"],
    queryFn: async () => await getPublicStoreInfo(),
    staleTime: 1000 * 60 * 5, // 5 menit cache
  });

  if (!order) return null;

  const storeLocation =
    storeInfo?.kota && storeInfo?.provinsi
      ? `${storeInfo.kota.replace(/^(Kota|Kabupaten)\s+/i, "")}, ${storeInfo.provinsi}`
      : "Cimahi, Jawa Barat";
  const storePhone = storeInfo?.noHp || "0895-8088-60080";

  const payment = Array.isArray(order.payments) ? order.payments[0] : order.payments;
  const paymentMethod =
    payment?.bank ||
    payment?.method ||
    (order.note?.toLowerCase().includes("cash") ? "Tunai / Cash" : "Transfer Bank");

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      toast.info("Sedang menyiapkan file PDF...");

      const elementId = viewMode === "thermal" ? "printable-receipt" : "printable-invoice";
      const element = document.getElementById(elementId);

      if (!element) {
        toast.error("Gagal menemukan template dokumen.");
        setDownloadingPdf(false);
        return;
      }

      // Dynamic import to support OKLCH / modern CSS with html2canvas-pro and jsPDF
      // @ts-ignore
      const { default: html2canvas } = await import("html2canvas-pro");
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);

      if (viewMode === "thermal") {
        // Thermal receipt: 80mm width, dynamic height matching aspect ratio
        const pdfWidth = 80;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        const doc = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: [pdfWidth, pdfHeight + 4],
        });
        doc.addImage(imgData, "JPEG", 0, 2, pdfWidth, pdfHeight);
        doc.save(`Struk-${order.order_number}.pdf`);
      } else {
        // A4 Invoice
        const doc = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
        });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
        const printWidth = pageWidth - margin * 2;
        const printHeight = (canvas.height * printWidth) / canvas.width;

        doc.addImage(imgData, "JPEG", margin, margin, printWidth, Math.min(printHeight, pageHeight - margin * 2));
        doc.save(`Invoice-${order.order_number}.pdf`);
      }

      toast.success("File PDF berhasil diunduh!");
    } catch (err: any) {
      console.error("PDF generation error:", err);
      toast.error("Gagal mengunduh PDF: " + (err?.message || "Kesalahan"));
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleCopySummary = () => {
    const itemsText = (order.order_items || [])
      .map(
        (it, i) =>
          `${i + 1}. ${it.product_name} (${it.size || "All Size"}) x${it.quantity} = ${formatIDR(it.subtotal)}`,
      )
      .join("\n");

    const summary = `*STRUK PEMBELIAN — AA JERSEY*
No. Order: ${order.order_number}
Tanggal: ${formatDateTime(order.created_at)}
Pelanggan: ${order.recipient_name}
Pembayaran: ${paymentMethod}

*Rincian Jersey:*
${itemsText}

Subtotal: ${formatIDR(order.subtotal)}
${order.discount_amount ? `Diskon: -${formatIDR(order.discount_amount)}\n` : ""}${
      order.shipping_cost ? `Ongkir: ${formatIDR(order.shipping_cost)}\n` : ""
    }*TOTAL BAYAR: ${formatIDR(order.grand_total)}*

Alamat Toko: ${storeLocation}
WhatsApp: ${storePhone}
Terima kasih telah berbelanja di AA Jersey!`;

    navigator.clipboard.writeText(summary);
    setCopied(true);
    toast.success("Ringkasan pesanan disalin ke clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden receipt-modal-dialog">
        {/* Header Dialog (Hidden on Print) */}
        <div className="p-5 border-b border-border flex items-center justify-between print:hidden">
          <div>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Receipt className="size-5 text-primary" />
              Struk & Invoice Pesanan
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              #{order.order_number} · {formatDateTime(order.created_at)}
            </p>
          </div>

          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode("thermal")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                viewMode === "thermal"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Struk Kasir
            </button>
            <button
              type="button"
              onClick={() => setViewMode("invoice")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                viewMode === "invoice"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Invoice A4
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-100/60 dark:bg-zinc-950 flex justify-center receipt-scroll-area">
          {viewMode === "thermal" ? (
            /* THERMAL RECEIPT VIEW (58mm / 80mm format) */
            <div
              id="printable-receipt"
              className="w-full max-w-[340px] bg-white text-zinc-900 p-6 rounded-lg shadow-sm border border-zinc-200 font-mono text-xs leading-relaxed printable-document print:w-full print:max-w-none print:shadow-none print:border-none print:p-0 print:m-0"
            >
              {/* Logo & Store Header */}
              <div className="text-center pb-4 border-b border-dashed border-zinc-300">
                <img
                  src="/logo-aa-jersey-dark.png"
                  alt="AA Jersey"
                  className="size-10 object-contain mx-auto mb-1.5"
                />
                <h2 className="font-black text-base tracking-widest text-zinc-900">
                  AA JERSEY
                </h2>
                <p className="text-[10px] text-zinc-600 font-sans mt-0.5">
                  Authentic & Grade Ori Football Kits
                </p>
                <p className="text-[9px] text-zinc-500 font-sans mt-1">
                  {storeLocation}
                </p>
                <p className="text-[9px] text-zinc-500 font-sans">
                  WA: {storePhone} · hello@jerseyaa.com
                </p>
              </div>

              {/* Order Meta */}
              <div className="py-3 border-b border-dashed border-zinc-300 space-y-1 text-[11px]">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-zinc-500 shrink-0">No. Order:</span>
                  <span className="font-bold font-mono text-right">{order.order_number}</span>
                </div>
                <div className="flex justify-between items-start gap-2">
                  <span className="text-zinc-500 shrink-0">Waktu:</span>
                  <span className="text-right">{formatDateTime(order.created_at)}</span>
                </div>
                <div className="flex justify-between items-start gap-2">
                  <span className="text-zinc-500 shrink-0">Pelanggan:</span>
                  <span className="font-bold text-right break-words">{order.recipient_name}</span>
                </div>
                <div className="flex justify-between items-start gap-2">
                  <span className="text-zinc-500 shrink-0">Bayar:</span>
                  <span className="font-bold uppercase text-right">{paymentMethod}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="py-3 border-b border-dashed border-zinc-300">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-[10px] text-zinc-500">
                      <th className="pb-1 font-semibold">ITEM</th>
                      <th className="pb-1 text-center font-semibold px-1">QTY</th>
                      <th className="pb-1 text-right font-semibold">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(order.order_items || []).map((it, idx) => (
                      <tr key={idx} className="align-top">
                        <td className="py-1.5 pr-2">
                          <div className="font-bold text-zinc-800 leading-tight">
                            {it.product_name}
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-0.5">
                            Size: {it.size || "All Size"} @{formatIDR(it.unit_price)}
                          </div>
                        </td>
                        <td className="py-1.5 text-center font-bold px-1 whitespace-nowrap">x{it.quantity}</td>
                        <td className="py-1.5 text-right font-bold tabular-nums whitespace-nowrap">
                          {formatIDR(it.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Calculation */}
              <div className="py-3 space-y-1.5 text-[11px]">
                <div className="flex justify-between text-zinc-600">
                  <span>Subtotal:</span>
                  <span className="tabular-nums font-semibold">{formatIDR(order.subtotal)}</span>
                </div>
                {Boolean(order.discount_amount && order.discount_amount > 0) && (
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>Diskon:</span>
                    <span className="tabular-nums">-{formatIDR(order.discount_amount!)}</span>
                  </div>
                )}
                {Boolean(order.shipping_cost && order.shipping_cost > 0) && (
                  <div className="flex justify-between text-zinc-600">
                    <span>Ongkir:</span>
                    <span className="tabular-nums">{formatIDR(order.shipping_cost!)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-zinc-900 font-extrabold text-sm text-zinc-900">
                  <span>TOTAL:</span>
                  <span className="tabular-nums">{formatIDR(order.grand_total)}</span>
                </div>
              </div>

              {/* Footer Note */}
              <div className="text-center pt-4 border-t border-dashed border-zinc-300 font-sans text-[10px] text-zinc-500 space-y-1.5">
                <p className="font-semibold text-zinc-800">
                  Terima kasih atas pesanan Anda!
                </p>
                <p className="text-[9px] leading-relaxed text-zinc-600">
                  Barang yang sudah dibeli dapat dikembalikan 1x24 jam apabila tidak sesuai dengan pesanan.
                </p>
                <p className="text-[8px] text-zinc-400 mt-2 font-mono">
                  *** www.jerseyaa.com ***
                </p>
              </div>
            </div>
          ) : (
            /* OFFICIAL INVOICE VIEW (A4 Document format) */
            <div
              id="printable-invoice"
              className="w-full bg-white text-zinc-900 p-8 rounded-lg shadow-sm border border-zinc-200 text-xs leading-relaxed printable-document print:w-full print:shadow-none print:border-none print:p-0 print:m-0"
            >
              <div className="flex justify-between items-start pb-6 border-b border-zinc-200">
                <div className="flex items-center gap-3.5">
                  <img
                    src="/logo-aa-jersey-dark.png"
                    alt="Logo AA Jersey"
                    className="size-12 object-contain"
                  />
                  <div>
                    <h1 className="font-black text-xl tracking-tight text-zinc-900">
                      AA JERSEY
                    </h1>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      Official Store & Football Kits Specialist
                    </p>
                    <p className="text-zinc-500 text-xs mt-1">
                      {storeLocation}
                    </p>
                    <p className="text-zinc-500 text-xs">
                      WhatsApp: {storePhone} · Email: hello@jerseyaa.com
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-zinc-900 text-white font-extrabold tracking-wider uppercase text-xs rounded">
                    INVOICE
                  </span>
                  <p className="font-mono font-bold text-sm text-zinc-900 mt-2">
                    {order.order_number}
                  </p>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    {formatDateTime(order.created_at)}
                  </p>
                </div>
              </div>

              {/* Bill To & Payment Meta */}
              <div className="grid grid-cols-2 gap-6 py-5 border-b border-zinc-200 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    DITAGIHKAN KEPADA:
                  </span>
                  <p className="font-bold text-sm text-zinc-900">{order.recipient_name}</p>
                  {order.recipient_no_hp && (
                    <p className="text-zinc-600 mt-0.5 font-mono">No. HP: {order.recipient_no_hp}</p>
                  )}
                  {order.recipient_alamat && (
                    <p className="text-zinc-600 mt-0.5 leading-relaxed">
                      {order.recipient_alamat}
                      {order.recipient_kota ? `, ${order.recipient_kota}` : ""}
                    </p>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    DETAIL PEMBAYARAN:
                  </span>
                  <p className="font-bold text-zinc-900 uppercase">{paymentMethod}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    Status: <span className="font-semibold text-emerald-600">LUNAS / SELESAI</span>
                  </p>
                  {order.note && (
                    <p className="text-zinc-500 text-xs mt-1 italic">
                      Catatan: {order.note}
                    </p>
                  )}
                </div>
              </div>

              {/* Item List Table */}
              <div className="py-6 border-b border-zinc-200">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-300 text-zinc-500 text-[11px]">
                      <th className="pb-2 text-left font-semibold w-8">NO</th>
                      <th className="pb-2 text-left font-semibold pr-3">DESKRIPSI PRODUK</th>
                      <th className="pb-2 text-center font-semibold px-2 w-20">UKURAN</th>
                      <th className="pb-2 text-center font-semibold px-2 w-16">JUMLAH</th>
                      <th className="pb-2 text-right font-semibold px-2 w-28">HARGA SATUAN</th>
                      <th className="pb-2 text-right font-semibold pl-2 w-28">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(order.order_items || []).map((it, idx) => (
                      <tr key={idx} className="py-2.5">
                        <td className="py-2.5 text-zinc-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 font-semibold text-zinc-900 pr-3">
                          {it.product_name}
                        </td>
                        <td className="py-2.5 text-center font-medium text-zinc-700 px-2">
                          {it.size || "All Size"}
                        </td>
                        <td className="py-2.5 text-center font-medium text-zinc-700 px-2">
                          {it.quantity}
                        </td>
                        <td className="py-2.5 text-right font-mono tabular-nums text-zinc-700 px-2">
                          {formatIDR(it.unit_price)}
                        </td>
                        <td className="py-2.5 text-right font-mono font-bold tabular-nums text-zinc-900 pl-2">
                          {formatIDR(it.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Calculations */}
              <div className="py-5 flex justify-end">
                <div className="w-64 space-y-2 text-xs">
                  <div className="flex justify-between text-zinc-600">
                    <span>Subtotal Produk:</span>
                    <span className="font-mono tabular-nums font-semibold">
                      {formatIDR(order.subtotal)}
                    </span>
                  </div>
                  {Boolean(order.discount_amount && order.discount_amount > 0) && (
                    <div className="flex justify-between text-rose-600 font-semibold">
                      <span>Potongan Diskon:</span>
                      <span className="font-mono tabular-nums">
                        -{formatIDR(order.discount_amount!)}
                      </span>
                    </div>
                  )}
                  {Boolean(order.shipping_cost && order.shipping_cost > 0) && (
                    <div className="flex justify-between text-zinc-600">
                      <span>Biaya Pengiriman:</span>
                      <span className="font-mono tabular-nums">
                        {formatIDR(order.shipping_cost!)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t-2 border-zinc-900 font-black text-sm text-zinc-900">
                    <span>TOTAL TAGIHAN:</span>
                    <span className="font-mono tabular-nums">
                      {formatIDR(order.grand_total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signature & Footer Notes */}
              <div className="mt-8 pt-6 border-t border-zinc-200 flex justify-between items-end text-zinc-600">
                <div className="text-[10px] space-y-1 max-w-sm">
                  <p className="font-bold text-zinc-800">Catatan & Ketentuan:</p>
                  <p className="leading-relaxed">1. Simpan invoice ini sebagai bukti transaksi resmi AA Jersey.</p>
                  <p className="leading-relaxed">2. Barang yang sudah dibeli dapat dikembalikan 1x24 jam apabila tidak sesuai dengan pesanan.</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-zinc-500 mb-8">Hormat Kami, AA Jersey</p>
                  <div className="border-b border-zinc-400 w-32 mx-auto"></div>
                  <p className="text-[10px] font-bold text-zinc-800 mt-1">Authorized Cashier</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions (Hidden on Print) */}
        <div className="p-4 border-t border-border bg-card flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopySummary}
            className="gap-1.5 text-xs cursor-pointer"
          >
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Share2 className="size-3.5" />}
            {copied ? "Tersalin!" : "Salin Format WhatsApp"}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs cursor-pointer"
            >
              Tutup
            </Button>
            
            {/* Tombol 1: Cetak via Print Dialog Browser */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 font-semibold text-xs border-zinc-300 dark:border-zinc-700 hover:bg-muted cursor-pointer"
            >
              <Printer className="size-3.5 text-zinc-700 dark:text-zinc-300" />
              Cetak
            </Button>

            {/* Tombol 2: Download Langsung PDF Otomatis */}
            <Button
              type="button"
              size="sm"
              disabled={downloadingPdf}
              onClick={handleDownloadPdf}
              className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs cursor-pointer shadow-sm"
            >
              <Download className="size-3.5" />
              {downloadingPdf ? "Mengunduh..." : "Download PDF"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
