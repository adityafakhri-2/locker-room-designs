import { BadgeCheck, Archive, BookOpen, UserCheck, Sparkles, Lock } from "lucide-react";
import { Section } from "./Section";

const ITEMS = [
  { icon: BadgeCheck, title: "Fokus Jersey Original", desc: "Tidak ada KW. Tidak ada kompromi. Hanya produk resmi." },
  { icon: Archive, title: "Koleksi Vintage Langka", desc: "Arsip terus diperbarui dengan jersey edisi langka dari berbagai era." },
  { icon: BookOpen, title: "Story di Balik Jersey", desc: "Setiap produk hadir dengan konteks sejarah dan momen pentingnya." },
  { icon: UserCheck, title: "Kurasi Kolektor", desc: "Dipilih dan diverifikasi langsung oleh kolektor berpengalaman." },
  { icon: Sparkles, title: "Pengalaman Premium", desc: "Kemasan museum-grade dan layanan personal di setiap pesanan." },
  { icon: Lock, title: "Keamanan Transaksi", desc: "Pembayaran terenkripsi dan garansi pengembalian dana." },
];

export function WhyChooseUs() {
  return (
    <Section eyebrow="N° 08 — Why Us" number="Editorial">
      <div className="grid lg:grid-cols-12 gap-10 mb-14">
        <h2 className="lg:col-span-8 display-lg">
          Lebih dari sekadar
          <br />
          <span className="italic font-light">toko jersey.</span>
        </h2>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border">
        {ITEMS.map((i) => (
          <div key={i.title} className="bg-background p-8 md:p-10 flex flex-col gap-4 min-h-[220px]">
            <i.icon className="size-6 text-primary" strokeWidth={1.5} />
            <h3 className="text-lg font-extrabold tracking-tight">{i.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{i.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
