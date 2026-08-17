import { Instagram, Youtube } from "lucide-react";

const COLS = [
  { title: "Produk", links: ["Semua Jersey", "Jersey Terbaru", "Jersey Retro", "Paling Laris"] },
  { title: "Layanan Pelanggan", links: ["FAQ", "Kontak", "Panduan Ukuran", "Konfirmasi Pembayaran"] },
  { title: "Media Sosial", links: ["Instagram", "TikTok", "YouTube"] },
  {
    title: "Kontak & Alamat",
    links: ["hello@jerseyaa.com", "WhatsApp +62 812 0000 0000", "Jakarta, Indonesia"],
  },
];

export function Footer() {
  return (
    <footer className="bg-foreground text-background">
      <div className="container-swiss pt-20 md:pt-28 pb-10">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-2">
              <span className="inline-block size-2.5 bg-primary" aria-hidden />
              <span className="font-display font-extrabold uppercase tracking-tight text-lg">
              AA Jersey
              </span>
            </div>
            <p className="mt-6 display-md max-w-md">
              Jersey Kualitas Juara, <span className="italic font-light">Gaya Sejati.</span>
            </p>
            <div className="mt-10 flex items-center gap-4 text-background/80">
              <a href="#" aria-label="Instagram" className="hover:text-primary transition-colors">
                <Instagram className="size-5" strokeWidth={1.5} />
              </a>
              <a
                href="#"
                aria-label="TikTok"
                className="hover:text-primary transition-colors text-sm font-semibold tracking-wider"
              >
                TIKTOK
              </a>
              <a href="#" aria-label="YouTube" className="hover:text-primary transition-colors">
                <Youtube className="size-5" strokeWidth={1.5} />
              </a>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-8">
            {COLS.map((c) => (
              <div key={c.title}>
                <h4 className="eyebrow text-background/60">{c.title}</h4>
                <ul className="mt-5 space-y-3">
                  {c.links.map((l) => (
                    <li key={l}>
                      <a
                        href="#"
                        className="text-sm text-background/85 hover:text-primary transition-colors"
                      >
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-20 pt-6 border-t border-background/15 grid grid-cols-[minmax(0,1fr)_auto] gap-4 items-baseline">
          <p className="text-xs text-background/60">
            © 2026 AA Jersey. Jersey Berkualitas, Gaya Sejati.
          </p>
          <p className="eyebrow text-background/60 hidden sm:block">Jakarta · ID</p>
        </div>
      </div>
    </footer>
  );
}
