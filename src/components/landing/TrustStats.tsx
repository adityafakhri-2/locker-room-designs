import { Section } from "./Section";

const STATS = [
  { value: "5.000+", label: "Penggemar Sepak Bola" },
  { value: "1.500+", label: "Jersey Terkirim" },
  { value: "4.9/5", label: "Penilaian Pembeli" },
  { value: "100%", label: "Jaminan Kualitas" },
];

export function TrustStats() {
  return (
    <Section eyebrow="N° 02 — Kepercayaan" number="Bukti Nyata">
      <div className="grid lg:grid-cols-12 gap-10">
        <h2 className="lg:col-span-5 display-lg">
          Dipercaya oleh ribuan
          <br />
          <span className="italic font-light">pecinta sepak bola.</span>
        </h2>
        <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
          {STATS.map((s) => (
            <div key={s.label} className="bg-background p-6 md:p-8 flex flex-col gap-2">
              <span className="display-md tabular-nums">{s.value}</span>
              <span className="eyebrow text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
