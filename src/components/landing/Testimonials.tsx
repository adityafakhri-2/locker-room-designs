import { Section } from "./Section";
import t1 from "@/assets/testimonial-1.jpg";
import t2 from "@/assets/testimonial-2.jpg";
import t3 from "@/assets/testimonial-3.jpg";

const REVIEWS = [
  {
    quote:
      "Kualitas jersey Grade Ori Thailand-nya juara banget! Detail bordir dan bahannya 1:1 mirip official, adem dan nyaman dipakai main futsal.",
    name: "Rizky Pratama",
    city: "Jakarta",
    img: t1,
  },
  {
    quote:
      "Pilihan jersey klub dan retro-nya lengkap. Pengiriman cepat, packing rapi, dan pelayanan adminnya sangat ramah.",
    name: "Bagas Setiawan",
    city: "Bandung",
    img: t2,
  },
  {
    quote:
      "Beli jersey buat hadiah suami, bahannya premium dan ukurannya pas sesuai size chart. Puas banget belanja di AA Jersey.",
    name: "Anindya Larasati",
    city: "Surabaya",
    img: t3,
  },
];

export function Testimonials() {
  return (
    <Section eyebrow="N° 08 — Testimoni" number="Kata Pelanggan">
      <div className="grid lg:grid-cols-12 gap-10 mb-14">
        <h2 className="lg:col-span-8 display-lg">
          Apa kata para
          <br />
          <span className="italic font-light">pelanggan kami?</span>
        </h2>
      </div>

      <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
        {REVIEWS.map((r) => (
          <figure
            key={r.name}
            className="flex flex-col justify-between bg-muted p-8 md:p-10 min-h-[340px]"
          >
            <blockquote className="text-base md:text-lg leading-relaxed text-foreground">
              <span className="text-primary">“</span>
              {r.quote}
              <span className="text-primary">”</span>
            </blockquote>
            <figcaption className="mt-8 flex items-center gap-4">
              <img
                src={r.img}
                alt={r.name}
                loading="lazy"
                width={56}
                height={56}
                className="size-12 rounded-full object-cover"
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.city}</div>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}
