import { ShieldCheck, ScrollText, Eye } from "lucide-react";
import { Section } from "./Section";

const FEATURES = [
  { n: "01", icon: ShieldCheck, title: "Original Verified", desc: "Setiap jersey diverifikasi melalui pengecekan tag, jahitan, material, dan kode produksi resmi." },
  { n: "02", icon: ScrollText, title: "Certificate of Authenticity", desc: "Jersey vintage dan limited edition dilengkapi sertifikat keaslian bernomor seri." },
  { n: "03", icon: Eye, title: "Collector Inspection", desc: "Diperiksa langsung oleh tim kurator kolektor berpengalaman lebih dari 10 tahun." },
];

export function AuthenticityPromise() {
  return (
    <Section id="about" eyebrow="N° 07 — Authenticity" number="Promise">
      <div className="grid lg:grid-cols-12 gap-10 mb-14">
        <h2 className="lg:col-span-8 display-lg">
          Jaminan keaslian
          <br />
          <span className="italic font-light">setiap jersey.</span>
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
