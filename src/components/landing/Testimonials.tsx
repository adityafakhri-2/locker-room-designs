import { Section } from "./Section";
import t1 from "@/assets/testimonial-1.jpg";
import t2 from "@/assets/testimonial-2.jpg";
import t3 from "@/assets/testimonial-3.jpg";

const REVIEWS = [
  {
    quote:
      "Sulit menemukan jersey vintage original yang terpercaya. The Locker Room menjadi tempat favorit saya untuk berburu koleksi langka.",
    name: "Rizky Pratama",
    city: "Jakarta",
    img: t1,
  },
  {
    quote:
      "Detailnya luar biasa. Kemasan museum-grade, sertifikat keaslian rapi, dan pelayanannya seperti membeli karya seni.",
    name: "Bagas Setiawan",
    city: "Bandung",
    img: t2,
  },
  {
    quote:
      "Beli jersey vintage Italia untuk hadiah suami. Dia langsung bisa bercerita momennya — itulah nilai yang tidak bisa dibeli di tempat lain.",
    name: "Anindya Larasati",
    city: "Surabaya",
    img: t3,
  },
];

export function Testimonials() {
  return (
    <Section eyebrow="N° 09 — Testimonials" number="Kata Kolektor">
      <div className="grid lg:grid-cols-12 gap-10 mb-14">
        <h2 className="lg:col-span-8 display-lg">
          Apa kata para
          <br />
          <span className="italic font-light">kolektor?</span>
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
