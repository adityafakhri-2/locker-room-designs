import { useState } from "react";
import { formatIDR, formatDateTime } from "@/lib/format";
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

  if (!order) return null;

  const payment = Array.isArray(order.payments) ? order.payments[0] : order.payments;
  const paymentMethod =
    payment?.bank ||
    payment?.payment_type ||
    (order.note?.toLowerCase().includes("cash") ? "Tunai / Cash" : "Transfer Bank");

  const handlePrint = () => {
    window.print();
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

Alamat Toko: Jl. KH Usman Domiri, Padasuka, Cimahi Tengah
WhatsApp: 0895-8088-60080
Terima kasih telah berbelanja di AA Jersey!`;

    navigator.clipboard.writeText(summary);
    setCopied(true);
    toast.success("Ringkasan pesanan disalin ke clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
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
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
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
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
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
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-100/60 dark:bg-zinc-950 flex justify-center">
          {viewMode === "thermal" ? (
            /* THERMAL RECEIPT VIEW (58mm / 80mm format) */
            <div
              id="printable-receipt"
              className="w-full max-w-[340px] bg-white text-zinc-900 p-6 rounded-lg shadow-sm border border-zinc-200 font-mono text-xs leading-relaxed print:w-full print:max-w-none print:shadow-none print:border-none print:p-0 print:m-0"
            >
              {/* Logo & Store Header */}
              <div className="text-center pb-4 border-b border-dashed border-zinc-300">
                <h2 className="font-black text-base tracking-widest text-zinc-900">
                  AA JERSEY
                </h2>
                <p className="text-[10px] text-zinc-600 font-sans mt-0.5">
                  Authentic & Grade Ori Football Kits
                </p>
                <p className="text-[9px] text-zinc-500 font-sans mt-1">
                  Jl. KH Usman Domiri, Padasuka, Cimahi Tengah
                </p>
                <p className="text-[9px] text-zinc-500 font-sans">
                  WA: 0895-8088-60080 · hello@jerseyaa.com
                </p>
              </div>

              {/* Order Meta */}
              <div className="py-3 border-b border-dashed border-zinc-300 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500">No. Order:</span>
                  <span className="font-bold">{order.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Waktu:</span>
                  <span>{formatDateTime(order.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Pelanggan:</span>
                  <span className="font-bold truncate max-w-[160px]">
                    {order.recipient_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Bayar:</span>
                  <span className="font-bold uppercase">{paymentMethod}</span>
                </div>
              </div>

              {/* Items Table */}
              <div className="py-3 border-b border-dashed border-zinc-300">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-[10px] text-zinc-500">
                      <th className="pb-1 font-normal">ITEM</th>
                      <th className="pb-1 text-center font-normal">QTY</th>
                      <th className="pb-1 text-right font-normal">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(order.order_items || []).map((it, idx) => (
                      <tr key={idx} className="align-top">
                        <td className="py-1.5 pr-2">
                          <div className="font-bold text-zinc-800 leading-tight">
                            {it.product_name}
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            Size: {it.size || "All"} @{formatIDR(it.unit_price)}
                          </div>
                        </td>
                        <td className="py-1.5 text-center font-bold">x{it.quantity}</td>
                        <td className="py-1.5 text-right font-bold tabular-nums">
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
              <div className="text-center pt-4 border-t border-dashed border-zinc-300 font-sans text-[10px] text-zinc-500 space-y-1">
                <p className="font-semibold text-zinc-800">
                  Terima kasih atas pesanan Anda!
                </p>
                <p className="text-[9px]">
                  Barang yang sudah dibeli dapat ditukar size maksimal 2 hari dengan tag utuh.
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
              className="w-full bg-white text-zinc-900 p-8 rounded-lg shadow-sm border border-zinc-200 text-xs leading-relaxed print:w-full print:shadow-none print:border-none print:p-0 print:m-0"
            >
              <div className="flex justify-between items-start pb-6 border-b border-zinc-200">
                <div>
                  <h1 className="font-black text-xl tracking-tight text-zinc-900">
                    AA JERSEY
                  </h1>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    Official Store & Football Kits Specialist
                  </p>
                  <p className="text-zinc-500 text-xs mt-1">
                    Jl. KH Usman Domiri, Padasuka, Cimahi Tengah, Jawa Barat
                  </p>
                  <p className="text-zinc-500 text-xs">
                    WhatsApp: 0895-8088-60080 · Email: hello@jerseyaa.com
                  </p>
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
                    <p className="text-zinc-600 mt-0.5">
                      {order.recipient_alamat}
                      {order.recipient_kota ? `, ${order.recipient_kota}` : ""}
                    </p>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    DETAIL PEMBAYARAN:
                  </span>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Metode Bayar:</span>
                      <span className="font-bold text-zinc-800 uppercase">{paymentMethod}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Status Pembayaran:</span>
                      <span className="font-bold text-emerald-600 uppercase">LUNAS</span>
                    </div>
                    {order.note && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Catatan:</span>
                        <span className="text-zinc-700 italic">{order.note}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="py-5">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b-2 border-zinc-900 text-left font-bold text-zinc-900">
                      <th className="py-2">NO</th>
                      <th className="py-2">DESKRIPSI PRODUK</th>
                      <th className="py-2 text-center">UKURAN</th>
                      <th className="py-2 text-center">QTY</th>
                      <th className="py-2 text-right">HARGA SATUAN</th>
                      <th className="py-2 text-right">JUMLAH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {(order.order_items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 text-zinc-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 font-bold text-zinc-900">{it.product_name}</td>
                        <td className="py-2.5 text-center font-semibold text-zinc-700 font-mono">
                          {it.size || "All"}
                        </td>
                        <td className="py-2.5 text-center font-bold font-mono">{it.quantity}</td>
                        <td className="py-2.5 text-right font-mono tabular-nums">
                          {formatIDR(it.unit_price)}
                        </td>
                        <td className="py-2.5 text-right font-bold font-mono tabular-nums">
                          {formatIDR(it.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals */}
              <div className="flex justify-end pt-3 border-t border-zinc-200">
                <div className="w-64 space-y-1.5 text-xs">
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

              {/* Signature & Sign-off */}
              <div className="mt-12 pt-6 border-t border-zinc-200 flex justify-between items-end text-zinc-600">
                <div className="text-[10px] space-y-0.5">
                  <p className="font-semibold text-zinc-800">Syarat & Ketentuan:</p>
                  <p>1. Simpan invoice ini sebagai bukti pembelian sah.</p>
                  <p>2. Komplain wajib menyertakan video unboxing & invoice resmi.</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-zinc-500 mb-10">Hormat Kami, AA Jersey</p>
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
            className="gap-1.5 text-xs"
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
              className="text-xs"
            >
              Tutup
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs"
            >
              <Printer className="size-3.5" />
              Cetak / Simpan PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
