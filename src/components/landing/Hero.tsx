import { ArrowUpRight, Check } from "lucide-react";
import hero from "@/assets/hero-jersey.jpg";

const TRUST = [
  "100% Original",
  "Keaslian Terverifikasi",
  "Kolektor Terpercaya",
  "Pengiriman Seluruh Indonesia",
];

export function Hero() {
  return (
    <section id="top" className="relative bg-foreground text-background overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={hero}
          alt="Jersey sepak bola premium di ruang ganti yang diterangi cahaya temaram"
          width={1280}
          height={1600}
          className="size-full object-cover opacity-55"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/40 to-foreground/70" />
      </div>

      <div className="relative container-swiss pt-32 md:pt-40 lg:pt-48 pb-16 md:pb-24">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 mb-12 md:mb-20">
          <span className="eyebrow text-white/70">N° 01 — Utama</span>
          <span className="eyebrow text-white/70 hidden sm:block">
            Est. Jakarta · Indonesia
          </span>
        </div>

        <h1 className="display-xl text-white">
          Jersey Original.
          <br />
          <span className="italic font-light tracking-tight">Memori Klasik.</span>
        </h1>

        <div className="mt-12 grid lg:grid-cols-12 gap-10 lg:gap-16 items-end">
          <p className="lg:col-span-6 text-base md:text-lg leading-relaxed text-white/80 max-w-xl">
            Temukan koleksi jersey sepak bola original, vintage, retro, dan edisi
            langka yang telah menjadi bagian dari sejarah sepak bola dunia.
          </p>

          <div className="lg:col-span-6 lg:col-start-7 flex flex-wrap gap-3">
            <a
              href="#new-arrivals"
              className="group inline-flex items-center gap-3 bg-primary text-primary-foreground px-6 py-4 text-sm font-semibold tracking-wide hover:bg-secondary transition-colors"
            >
              Belanja Sekarang
              <ArrowUpRight className="size-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
            <a
              href="#vintage"
              className="inline-flex items-center gap-3 border border-white/30 text-white px-6 py-4 text-sm font-semibold tracking-wide hover:bg-white hover:text-foreground transition-colors"
            >
              Jelajahi Koleksi Vintage
            </a>
          </div>
        </div>

        <div className="mt-16 md:mt-24 border-t border-white/15 pt-6 grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-6">
          {TRUST.map((t) => (
            <div key={t} className="flex items-center gap-2 text-xs md:text-sm text-white/80">
              <Check className="size-3.5 text-primary shrink-0" strokeWidth={2.5} />
              <span className="truncate">{t}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
