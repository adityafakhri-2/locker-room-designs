import { ArrowUpRight } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="bg-primary text-primary-foreground border-t border-primary">
      <div className="container-swiss py-24 md:py-36 lg:py-44">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 mb-12">
          <span className="eyebrow text-primary-foreground/70">N° 10 — Belanja</span>
          <span className="eyebrow text-primary-foreground/70">Dukungan Tim Favorit</span>
        </div>
        <h2 className="display-xl">
          Temukan jersey
          <br />
          <span className="italic font-light">impianmu hari ini.</span>
        </h2>
        <div className="mt-12 grid lg:grid-cols-12 gap-10 items-end">
          <p className="lg:col-span-6 text-base md:text-lg text-primary-foreground/85 max-w-xl">
            Lengkapi koleksi jersey tim kebanggaanmu dengan kualitas Grade Ori Thailand 1:1 terbaik
            dan jersey original pilihan. Siap pakai untuk nobar maupun tanding di lapangan.
          </p>
          <div className="lg:col-span-6 lg:col-start-7 flex flex-wrap gap-3">
            <a
              href="#new-arrivals"
              className="group inline-flex items-center gap-3 bg-background text-foreground px-7 py-4 text-sm font-semibold hover:bg-foreground hover:text-background transition-colors"
            >
              Belanja Sekarang
              <ArrowUpRight className="size-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </a>
            <a
              href="#vintage"
              className="inline-flex items-center gap-3 border border-primary-foreground/40 text-primary-foreground px-7 py-4 text-sm font-semibold hover:bg-primary-foreground hover:text-primary transition-colors"
            >
              Koleksi Retro
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
