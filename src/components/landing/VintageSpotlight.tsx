import { ArrowUpRight } from "lucide-react";
import img from "@/assets/vintage-spotlight.jpg";

const META = [
  { k: "Condition Rating", v: "9.2 / 10" },
  { k: "Collector Score", v: "AAA" },
  { k: "Year", v: "1998 / 1999" },
  { k: "Authenticity", v: "Certificate Included" },
];

export function VintageSpotlight() {
  return (
    <section id="vintage" className="bg-foreground text-background border-t border-foreground">
      <div className="container-swiss py-20 md:py-28 lg:py-36">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 mb-12 md:mb-16">
          <span className="eyebrow text-white/70">N° 06 — Vintage Spotlight</span>
          <span className="eyebrow text-white/70">Museum Piece</span>
        </div>

        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          <div className="lg:col-span-7 relative aspect-[16/11] overflow-hidden bg-foreground">
            <img
              src={img}
              alt="Manchester United Treble Winners 1998/1999 jersey"
              loading="lazy"
              width={1600}
              height={1200}
              className="size-full object-cover"
            />
          </div>

          <div className="lg:col-span-5">
            <span className="eyebrow text-primary">Legenda yang Bisa Kamu Miliki</span>
            <h2 className="display-lg mt-4 text-white">
              Manchester United
              <br />
              <span className="italic font-light">Treble Winners 98/99.</span>
            </h2>
            <p className="mt-6 text-white/75 leading-relaxed">
              Jersey ini menjadi saksi musim paling bersejarah Manchester United
              saat meraih Treble Winners pada tahun 1999 — Premier League, FA Cup,
              dan UEFA Champions League dalam satu musim.
            </p>

            <dl className="mt-10 grid grid-cols-2 gap-px bg-white/15">
              {META.map((m) => (
                <div key={m.k} className="bg-foreground p-5">
                  <dt className="eyebrow text-white/60">{m.k}</dt>
                  <dd className="mt-2 text-base font-semibold text-white">{m.v}</dd>
                </div>
              ))}
            </dl>

            <a
              href="#new-arrivals"
              className="mt-10 inline-flex items-center gap-3 bg-primary text-primary-foreground px-6 py-4 text-sm font-semibold tracking-wide hover:bg-secondary transition-colors"
            >
              Lihat Detail Koleksi
              <ArrowUpRight className="size-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
