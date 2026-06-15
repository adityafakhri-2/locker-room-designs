import { ArrowUpRight } from "lucide-react";
import { Section } from "./Section";
import newSeason from "@/assets/collection-new-season.jpg";
import vintage from "@/assets/collection-vintage.jpg";
import retro from "@/assets/collection-retro.jpg";
import limited from "@/assets/collection-limited.jpg";

const COLLECTIONS = [
  { title: "New Season Jerseys", desc: "Koleksi jersey musim terbaru dari klub dan tim nasional favorit.", img: newSeason, tag: "01" },
  { title: "Vintage Jerseys", desc: "Jersey bersejarah yang membawa kembali kenangan sepak bola.", img: vintage, tag: "02" },
  { title: "Retro Collection", desc: "Reproduksi jersey legendaris dari era keemasan sepak bola.", img: retro, tag: "03" },
  { title: "Limited Edition", desc: "Koleksi eksklusif dengan jumlah terbatas.", img: limited, tag: "04" },
];

export function FeaturedCollections() {
  return (
    <Section id="collections" eyebrow="N° 03 — Collections" number="Temukan Koleksi">
      <div className="grid lg:grid-cols-12 gap-10 mb-14">
        <h2 className="lg:col-span-7 display-lg">
          Temukan koleksi <span className="italic font-light">favoritmu.</span>
        </h2>
        <p className="lg:col-span-4 lg:col-start-9 text-muted-foreground self-end max-w-md">
          Empat pintu masuk ke arsip jersey kami — dari kit musim ini hingga
          potongan langka yang sulit ditemukan di pasar lain.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
        {COLLECTIONS.map((c) => (
          <a key={c.title} href="#new-arrivals" className="group flex flex-col">
            <div className="relative aspect-[4/5] overflow-hidden bg-muted">
              <img
                src={c.img}
                alt={c.title}
                loading="lazy"
                width={1024}
                height={1280}
                className="size-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
              />
              <span className="absolute top-4 left-4 eyebrow text-white mix-blend-difference">
                {c.tag}
              </span>
              <span className="absolute bottom-4 right-4 size-10 grid place-items-center bg-background/95 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowUpRight className="size-4" />
              </span>
            </div>
            <div className="pt-5 grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-baseline">
              <h3 className="text-base md:text-lg font-extrabold tracking-tight">{c.title}</h3>
              <span className="eyebrow text-muted-foreground">Shop</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{c.desc}</p>
          </a>
        ))}
      </div>
    </Section>
  );
}
