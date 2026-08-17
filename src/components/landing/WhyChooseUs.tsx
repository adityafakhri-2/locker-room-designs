import { Shirt, Archive, Sparkles, CheckCircle2, PackageCheck, ShieldAlert } from "lucide-react";
import { Section } from "./Section";

const ITEMS = [
  {
    icon: Shirt,
    title: "Kualitas Grade Ori Terbaik",
    desc: "Bahan adem dan tahan lama, nyaman dipakai bermain bola, futsal, ataupun outfit kasual harian.",
  },
  {
    icon: Archive,
    title: "Koleksi Klub & Negara Lengkap",
    desc: "Dari jersey musim terbaru hingga jersey retro klasik berbagai klub dan tim nasional dunia.",
  },
  {
    icon: Sparkles,
    title: "Harga Jujur & Terjangkau",
    desc: "Dapatkan jersey impian dengan kualitas bintang 5 tanpa perlu merogoh kocek terlalu dalam.",
  },
  {
    icon: CheckCircle2,
    title: "Detail & Sablon Presisi",
    desc: "Bordir apparel rapi dan sablon sponsor berstandar tinggi yang awet tidak mudah mengelupas.",
  },
  {
    icon: PackageCheck,
    title: "Pengemasan Rapi & Cepat",
    desc: "Setiap pesanan dipacking aman dan rapi agar sampai di tangan Anda dalam kondisi prima.",
  },
  {
    icon: ShieldAlert,
    title: "Transaksi Aman & Bergaransi",
    desc: "Layanan customer service responsif dan garansi retur jika barang yang diterima cacat produksi.",
  },
];

export function WhyChooseUs() {
  return (
    <Section eyebrow="N° 07 — Keunggulan" number="Mengapa Kami">
      <div className="grid lg:grid-cols-12 gap-10 mb-14">
        <h2 className="lg:col-span-8 display-lg">
          Lebih dari sekadar
          <br />
          <span className="italic font-light">toko jersey biasa.</span>
        </h2>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border">
        {ITEMS.map((i) => (
          <div
            key={i.title}
            className="bg-background p-8 md:p-10 flex flex-col gap-4 min-h-[220px]"
          >
            <i.icon className="size-6 text-primary" strokeWidth={1.5} />
            <h3 className="text-lg font-extrabold tracking-tight">{i.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{i.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
