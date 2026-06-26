import { Section } from "./Section";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const ITEMS = [
  {
    q: "Apakah semua jersey original?",
    a: "Ya. Kami hanya menjual jersey original. Setiap produk melalui pemeriksaan tag, jahitan, dan kode produksi sebelum masuk ke katalog.",
  },
  {
    q: "Bagaimana proses verifikasi keaslian?",
    a: "Tim kurator kami memeriksa material, label, hologram, dan menyandingkan dengan database referensi. Jersey vintage dan limited edition juga dilengkapi sertifikat keaslian bernomor seri.",
  },
  {
    q: "Apakah tersedia size guide?",
    a: "Setiap halaman produk memiliki size guide lengkap dengan tabel ukuran dada, panjang badan, dan rekomendasi fit (slim / regular / loose).",
  },
  {
    q: "Bisakah mengembalikan barang?",
    a: "Bisa dalam 7 hari setelah barang diterima, selama dalam kondisi asli dan tag belum dilepas. Khusus item limited edition berlaku ketentuan tambahan.",
  },
  {
    q: "Bagaimana cara pembayaran?",
    a: "Transfer bank, e-wallet (GoPay, OVO, Dana, ShopeePay), kartu kredit, dan cicilan 0% via bank rekanan.",
  },
];

export function FAQ() {
  return (
    <Section eyebrow="N° 12 — FAQ" number="Bantuan">
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
