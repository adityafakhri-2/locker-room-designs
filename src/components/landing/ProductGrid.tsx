import { Section } from "./Section";
import p1 from "@/assets/product-1.jpg";
import p2 from "@/assets/product-2.jpg";
import p3 from "@/assets/product-3.jpg";
import p4 from "@/assets/product-4.jpg";
import p5 from "@/assets/product-5.jpg";
import p6 from "@/assets/product-6.jpg";

const NEW_ARRIVALS = [
  { img: p1, club: "FC Azzurri", season: "Home 25/26", price: "Rp 1.250.000" },
  { img: p2, club: "Red Stripes FC", season: "Away 25/26", price: "Rp 1.350.000" },
  { img: p3, club: "Atlético Norte", season: "Third 25/26", price: "Rp 1.150.000" },
  { img: p4, club: "Selecao Verde", season: "Home 25/26", price: "Rp 1.400.000" },
];

const BEST_SELLERS = [
  { img: p5, club: "Black Eagles 10", season: "Special Edition", price: "Rp 1.890.000", sold: "Terjual 120+ kali bulan ini" },
  { img: p6, club: "Croatia Classic", season: "Anniversary Kit", price: "Rp 1.650.000", sold: "Terjual 96+ kali bulan ini" },
  { img: p2, club: "Red Stripes FC", season: "Away 25/26", price: "Rp 1.350.000", sold: "Terjual 84+ kali bulan ini" },
  { img: p1, club: "FC Azzurri", season: "Home 25/26", price: "Rp 1.250.000", sold: "Terjual 72+ kali bulan ini" },
];

function Card({ img, club, season, price, sold }: { img: string; club: string; season: string; price: string; sold?: string }) {
  return (
    <article className="group flex flex-col">
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        <img
          src={img}
          alt={`${club} ${season}`}
          loading="lazy"
          width={900}
          height={1100}
          className="size-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
        />
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-background/95 px-2.5 py-1 eyebrow text-[10px]">
          <span className="size-1.5 bg-primary" /> Original Verified
        </span>
      </div>
      <div className="pt-4 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
        <h3 className="text-sm md:text-base font-semibold tracking-tight truncate">{club}</h3>
        <span className="text-sm font-semibold tabular-nums">{price}</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 mt-1">
        <span className="text-xs text-muted-foreground">{season}</span>
        {sold && <span className="text-xs text-primary font-medium">{sold}</span>}
      </div>
    </article>
  );
}

export function NewArrivals() {
  return (
    <Section id="new-arrivals" eyebrow="N° 04 — New Arrivals" number="Koleksi Terbaru">
      <div className="grid lg:grid-cols-12 gap-10 mb-14">
        <h2 className="lg:col-span-7 display-lg">
          Koleksi <span className="italic font-light">terbaru.</span>
        </h2>
        <p className="lg:col-span-4 lg:col-start-9 text-muted-foreground self-end max-w-md">
          Drop minggu ini. Setiap kit telah melalui pemeriksaan keaslian sebelum masuk ke katalog.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
        {NEW_ARRIVALS.map((p) => <Card key={p.club + p.season} {...p} />)}
      </div>
    </Section>
  );
}

export function BestSellers() {
  return (
    <Section eyebrow="N° 05 — Best Sellers" number="Paling Dicari">
      <div className="grid lg:grid-cols-12 gap-10 mb-14">
        <h2 className="lg:col-span-7 display-lg">
          Paling dicari <span className="italic font-light">minggu ini.</span>
        </h2>
        <p className="lg:col-span-4 lg:col-start-9 text-muted-foreground self-end max-w-md">
          Stok terbatas dan terus berkurang. Klik dua kali untuk amankan sebelum kehabisan.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
        {BEST_SELLERS.map((p, i) => <Card key={p.club + i} {...p} />)}
      </div>
    </Section>
  );
}
