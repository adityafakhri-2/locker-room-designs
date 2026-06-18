import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/checkout/success/$orderNumber")({
  component: SuccessPage,
});

function SuccessPage() {
  const { orderNumber } = useParams({ from: "/checkout/success/$orderNumber" });
  return (
    <>
      <Navbar />
      <div className="min-h-screen pt-32 pb-20 container-swiss text-center">
        <CheckCircle2 className="size-16 text-primary mx-auto" strokeWidth={1.5} />
        <h1 className="display-lg mt-6">Pesanan Berhasil Dibuat</h1>
        <p className="mt-4 text-muted-foreground">Nomor pesanan kamu:</p>
        <p className="font-mono text-2xl font-bold mt-2">{orderNumber}</p>
        <p className="mt-6 text-muted-foreground max-w-lg mx-auto">Silakan lakukan transfer dan upload bukti pembayaran di halaman detail pesanan.</p>
        <div className="mt-8 flex gap-3 justify-center">
          <Button asChild><Link to="/dashboard/pesanan/$orderNumber" params={{ orderNumber }}>Lihat Detail Pesanan</Link></Button>
          <Button variant="outline" asChild><Link to="/shop">Lanjut Belanja</Link></Button>
        </div>
      </div>
      <Footer />
    </>
  );
}
