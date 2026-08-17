import { ShieldCheck, Layers, Sparkles } from "lucide-react";
import { Section } from "./Section";

const FEATURES = [
  {
    n: "01",
    icon: Sparkles,
    title: "Grade Ori Import 1:1",
    desc: "Jersey Grade Ori dibuat dengan bahan polyester dry-fit premium, motif, dan detail apparel yang presisi mirip rilisan resmi.",
  },
  {
    n: "02",
    icon: Layers,
    title: "Transparansi Grade Produk",
    desc: "Setiap jersey di katalog kami cantumkan label kategori jelas (Grade Ori atau Original) agar Anda berbelanja dengan tenang.",
  },
  {
    n: "03",
    icon: ShieldCheck,
    title: "Quality Control Teliti",
    desc: "Setiap jahitan, patch sponsor, bordir logo klub, dan ukuran diperiksa langsung oleh tim kami sebelum dikemas dan dikirim.",
  },
];

export function AuthenticityPromise() {
  return (
    <Section id="about" eyebrow="N° 06 — Standar Kualitas" number="Komitmen Kami">
      <div className="grid lg:grid-cols-12 gap-10 mb-14">
        <h2 className="lg:col-span-8 display-lg">
          Standar kualitas
          <br />
          <span className="italic font-light">di setiap helai jersey.</span>
        </h2>
      </div>

      <div className="grid md:grid-cols-3 gap-px bg-border border border-border">
        {FEATURES.map((f) => (
          <div key={f.title} className="bg-background p-8 md:p-10 flex flex-col gap-6">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start">
              <span className="eyebrow text-primary">{f.n}</span>
              <f.icon className="size-6 text-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="display-md">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
