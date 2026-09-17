import { Link } from "@tanstack/react-router";
import { Instagram, Youtube, ArrowUpRight, MessageCircle, Mail, MapPin } from "lucide-react";

export function Footer() {
  const waUrl =
    "https://wa.me/62895808860080?text=" +
    encodeURIComponent("Halo Admin AA Jersey, saya tertarik untuk bertanya seputar katalog produk jersey...");

  const emailUrl =
    "mailto:lavafaaa@gmail.com?subject=" +
    encodeURIComponent("Tanya Produk — AA Jersey") +
    "&body=" +
    encodeURIComponent("Halo Admin AA Jersey,\n\nSaya ingin bertanya mengenai:");

  const mapCimahiUrl =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent("Jl. KH Usman Domiri, Padasuka, Cimahi Tengah, Kota Cimahi, Jawa Barat");

  const mapSukabumiUrl =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent("Villa Adiprima, Kec. Sukaraja, Kab. Sukabumi, Jawa Barat");

  return (
    <footer className="bg-foreground text-background">
      <div className="container-swiss pt-20 md:pt-28 pb-10">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16">
          {/* Brand & Slogan */}
          <div className="lg:col-span-5">
            <Link to="/" className="inline-flex items-center gap-3 group">
              <img
                src="/logo-aa-jersey.png"
                alt="Logo AA Jersey"
                className="size-9 object-contain group-hover:scale-105 transition-transform"
              />
              <span className="font-display font-black uppercase tracking-tight text-xl text-white">
                AA Jersey
              </span>
            </Link>
            <p className="mt-6 display-md max-w-md text-white">
              Jersey Kualitas Juara, <span className="italic font-light text-primary">Gaya Sejati.</span>
            </p>
            <p className="text-xs text-white/60 mt-3 max-w-sm leading-relaxed">
              Koleksi jersey 100% Original & Grade Ori Import Thailand 1:1 terlengkap di Indonesia. Siap kirim cepat ke seluruh nusantara.
            </p>
            <div className="mt-8 flex items-center gap-4 text-background/80">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram AA Jersey"
                className="hover:text-primary transition-colors p-2 rounded-full bg-white/5 hover:bg-white/10"
              >
                <Instagram className="size-4" strokeWidth={1.5} />
              </a>
              <a
                href="https://tiktok.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok AA Jersey"
                className="hover:text-primary transition-colors text-xs font-bold tracking-wider px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10"
              >
                TIKTOK
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube AA Jersey"
                className="hover:text-primary transition-colors p-2 rounded-full bg-white/5 hover:bg-white/10"
              >
                <Youtube className="size-4" strokeWidth={1.5} />
              </a>
            </div>
          </div>

          {/* Navigasi Link Columns */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            {/* Kolom 1: Produk */}
            <div>
              <h4 className="eyebrow text-primary font-bold">Produk</h4>
              <ul className="mt-5 space-y-3">
                <li>
                  <Link
                    to="/shop"
                    className="text-sm text-background/85 hover:text-primary transition-colors inline-flex items-center gap-1 group"
                  >
                    <span>Semua Jersey</span>
                    <ArrowUpRight className="size-3 opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all text-primary" />
                  </Link>
                </li>
                <li>
                  <Link
                    to="/shop"
                    search={{ category: "new-season-jerseys" }}
                    className="text-sm text-background/85 hover:text-primary transition-colors inline-flex items-center gap-1 group"
                  >
                    <span>Jersey Terbaru</span>
                    <ArrowUpRight className="size-3 opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all text-primary" />
                  </Link>
                </li>
                <li>
                  <Link
                    to="/shop"
                    search={{ category: "retro" }}
                    className="text-sm text-background/85 hover:text-primary transition-colors inline-flex items-center gap-1 group"
                  >
                    <span>Jersey Retro</span>
                    <ArrowUpRight className="size-3 opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all text-primary" />
                  </Link>
                </li>
                <li>
                  <Link
                    to="/shop"
                    search={{ sort: "price-desc" }}
                    className="text-sm text-background/85 hover:text-primary transition-colors inline-flex items-center gap-1 group"
                  >
                    <span>Paling Laris</span>
                    <ArrowUpRight className="size-3 opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all text-primary" />
                  </Link>
                </li>
              </ul>
            </div>

            {/* Kolom 2: Layanan Pelanggan */}
            <div>
              <h4 className="eyebrow text-primary font-bold">Layanan Pelanggan</h4>
              <ul className="mt-5 space-y-3">
                <li>
                  <Link
                    to="/about"
                    className="text-sm text-background/85 hover:text-primary transition-colors inline-flex items-center gap-1 group"
                  >
                    <span>Tentang Kami</span>
                    <ArrowUpRight className="size-3 opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all text-primary" />
                  </Link>
                </li>
                <li>
                  <Link
                    to="/contact"
                    className="text-sm text-background/85 hover:text-primary transition-colors inline-flex items-center gap-1 group"
                  >
                    <span>Hubungi Kami</span>
                    <ArrowUpRight className="size-3 opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all text-primary" />
                  </Link>
                </li>
                <li>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-background/85 hover:text-primary transition-colors inline-flex items-center gap-1 group"
                  >
                    <span>Konsultasi Ukuran</span>
                    <ArrowUpRight className="size-3 opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all text-primary" />
                  </a>
                </li>
              </ul>
            </div>

            {/* Kolom 3: Kontak & Alamat */}
            <div>
              <h4 className="eyebrow text-primary font-bold">Kontak & Alamat</h4>
              <ul className="mt-5 space-y-4">
                {/* Email */}
                <li>
                  <a
                    href={emailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-2 text-sm text-background/85 hover:text-primary transition-colors"
                  >
                    <Mail className="size-4 text-primary shrink-0 mt-0.5" />
                    <span className="inline-flex items-center gap-1 font-mono text-xs">
                      lavafaaa@gmail.com
                      <ArrowUpRight className="size-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform text-primary" />
                    </span>
                  </a>
                </li>

                {/* WhatsApp */}
                <li>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-2 text-sm text-background/85 hover:text-primary transition-colors"
                  >
                    <MessageCircle className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-white group-hover:text-primary">
                        +62 895-8088-60080
                        <ArrowUpRight className="size-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform text-primary" />
                      </span>
                      <span className="text-[10px] text-white/50">Chat WhatsApp Langsung</span>
                    </div>
                  </a>
                </li>

                {/* Alamat 1 - Cimahi */}
                <li>
                  <a
                    href={mapCimahiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-2 text-sm text-background/85 hover:text-primary transition-colors"
                  >
                    <MapPin className="size-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Outlet 1 (Cimahi)</span>
                      <span className="inline-flex items-center gap-1 text-xs text-white/90 group-hover:text-primary leading-relaxed">
                        Jl. KH Usman Domiri, Cimahi
                        <ArrowUpRight className="size-3.5 shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform text-primary" />
                      </span>
                    </div>
                  </a>
                </li>

                {/* Alamat 2 - Sukabumi */}
                <li>
                  <a
                    href={mapSukabumiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-2 text-sm text-background/85 hover:text-primary transition-colors"
                  >
                    <MapPin className="size-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Outlet 2 (Sukabumi)</span>
                      <span className="inline-flex items-center gap-1 text-xs text-white/90 group-hover:text-primary leading-relaxed">
                        Villa Adiprima, Sukaraja, Kab. Sukabumi
                        <ArrowUpRight className="size-3.5 shrink-0 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform text-primary" />
                      </span>
                    </div>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-6 border-t border-background/15 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-background/60 text-center sm:text-left">
            © 2026 AA Jersey. Jersey Berkualitas Juara, Gaya Sejati.
          </p>
          <p className="eyebrow text-background/60 text-xs">Cimahi · Jawa Barat · ID</p>
        </div>
      </div>
    </footer>
  );
}

