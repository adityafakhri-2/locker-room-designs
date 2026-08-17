import { Section } from "./Section";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const ITEMS = [
  {
    q: "Apa yang dimaksud dengan jersey Grade Ori / GO Thailand?",
    a: "Jersey Grade Ori (Import Thailand) adalah jersey replika dengan standar kualitas tertinggi dan tingkat kemiripan 1:1 terhadap rilisan resmi. Menggunakan bahan polyester dry-fit premium yang adem, bordir logo rapi, tag apparel lengkap, dan sangat nyaman dipakai.",
  },
  {
    q: "Apakah AA Jersey juga menyediakan jersey original?",
    a: "Ya, kami juga menyediakan pilihan jersey Original terkurasi. Setiap produk di katalog kami beri label penanda grade yang jelas (Grade Ori atau Original) agar Anda dapat berbelanja secara transparan.",
  },
  {
    q: "Bagaimana cara memilih ukuran jersey yang pas?",
    a: "Setiap halaman produk dilengkapi Size Chart (panduan ukuran) yang memuat panjang dan lebar dada dalam centimeter. Kami menyarankan untuk mengukur kaos/jersey yang biasa Anda kenakan sebagai acuan.",
  },
  {
    q: "Berapa lama estimasi pengiriman dan dari mana dikirim?",
    a: "Seluruh pesanan diproses dan dikirim langsung dari Jakarta. Untuk area Jabodetabek dan pulau Jawa estimasi 1-3 hari kerja, sedangkan luar pulau Jawa 2-5 hari kerja tergantung ekspedisi pilihan Anda.",
  },
  {
    q: "Metode pembayaran apa saja yang didukung?",
    a: "Kami menerima transfer bank, QRIS instan (GoPay, OVO, DANA, ShopeePay), dan kartu kredit dengan verifikasi pembayaran otomatis yang aman.",
  },
];

export function FAQ() {
  return (
    <Section eyebrow="N° 11 — FAQ" number="Tanya Jawab">
      <div className="grid lg:grid-cols-12 gap-10">
        <h2 className="lg:col-span-5 display-lg">
          Pertanyaan
          <br />
          <span className="italic font-light">umum.</span>
        </h2>
        <div className="lg:col-span-7">
          <Accordion type="single" collapsible className="w-full">
            {ITEMS.map((it, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-b border-border">
                <AccordionTrigger className="text-left text-base md:text-lg font-semibold py-5">
                  <span className="grid grid-cols-[auto_minmax(0,1fr)] gap-5 items-baseline">
                    <span className="eyebrow text-muted-foreground tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{it.q}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-6 pl-12">
                  {it.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </Section>
  );
}
