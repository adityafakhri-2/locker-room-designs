import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — AA Jersey" },
      {
        name: "description",
        content: "Toko jersey original, vintage, dan limited edition terpercaya di Indonesia.",
      },
    ],
  }),
  component: () => (
    <>
      <Navbar />
      <main
        id="main-content"
        className="pt-28 md:pt-36 pb-20 container-swiss min-h-screen max-w-3xl"
      >
        <span className="eyebrow text-muted-foreground">N° 09 — About</span>
        <h1 className="display-lg mt-3">
          Jersey Asli, <em className="italic font-light">Gaya Sejati.</em>
        </h1>
        <div className="mt-10 space-y-6 text-lg leading-relaxed text-foreground/80">
          <p>
            AA Jersey adalah destinasi premium untuk kolektor jersey sepak bola di Indonesia.
            Kami percaya setiap jersey adalah artefak sejarah — saksi gol-gol bersejarah, momen
            juara, dan generasi pemain yang membentuk olahraga ini.
          </p>
          <p>
            Sejak hari pertama, fokus kami hanya satu: keaslian. Setiap jersey yang masuk katalog
            kami melewati pengecekan tag, jahitan, material, dan kode produksi resmi. Tidak ada KW.
            Tidak ada kompromi.
          </p>
          <p>
            Koleksi kami mencakup jersey original musim terbaru, vintage langka, retro klasik,
            hingga edisi terbatas. Setiap produk hadir dengan story di baliknya — karena jersey
            bukan sekadar pakaian, melainkan kenangan.
          </p>
        </div>
      </main>
      <Footer />
    </>
  ),
});
