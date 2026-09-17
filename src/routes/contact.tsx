import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Mail, MessageCircle, MapPin, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Hubungi Kami — AA Jersey" }] }),
  component: () => {
    const waUrl =
      "https://wa.me/62895808860080?text=" +
      encodeURIComponent("Halo Admin AA Jersey, saya ingin bertanya seputar produk jersey...");

    const emailUrl =
      "mailto:lavafaaa@gmail.com?subject=" +
      encodeURIComponent("Tanya Produk — AA Jersey");

    const mapCimahiUrl =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent("Jl. KH Usman Domiri, Padasuka, Cimahi Tengah, Kota Cimahi, Jawa Barat");

    const mapSukabumiUrl =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent("Villa Adiprima, Kec. Sukaraja, Kab. Sukabumi, Jawa Barat");

    return (
      <>
        <Navbar />
        <main id="main-content" className="pt-28 md:pt-36 pb-20 container-swiss min-h-screen">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block size-2 bg-primary rounded-full" />
            <span className="eyebrow text-muted-foreground">N° 10 — Hubungi Kami</span>
          </div>
          <h1 className="display-lg mt-3">Layanan Kontak AA Jersey</h1>
          <p className="text-muted-foreground mt-3 max-w-xl text-base">
            Ada pertanyaan seputar ukuran, ketersediaan stok, atau pesanan Anda? Tim kami siap membantu dengan senang hati.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            {/* Email Card */}
            <a
              href={emailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-border p-6 sm:p-8 rounded-xl bg-card/60 hover:border-primary hover:shadow-lg transition-all duration-300 group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-lg bg-primary/10 text-primary">
                    <Mail className="size-6" strokeWidth={1.75} />
                  </div>
                  <ArrowUpRight className="size-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                </div>
                <span className="eyebrow text-primary text-[10px] md:text-xs font-bold tracking-wider block mt-6">
                  EMAIL RESMI
                </span>
                <h3 className="text-base sm:text-lg md:text-xl font-black text-foreground font-mono mt-2 break-all group-hover:text-primary transition-colors">
                  lavafaaa@gmail.com
                </h3>
                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  Kirim pertanyaan, penawaran, atau bantuan pesanan jersey Anda.
                </p>
              </div>
              <span className="text-xs text-primary font-bold mt-6 inline-flex items-center gap-1.5 group-hover:translate-x-1 transition-transform">
                Kirim Email Langsung →
              </span>
            </a>

            {/* WhatsApp Card */}
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-border p-6 sm:p-8 rounded-xl bg-card/60 hover:border-emerald-500 hover:shadow-lg transition-all duration-300 group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-500">
                    <MessageCircle className="size-6" strokeWidth={1.75} />
                  </div>
                  <ArrowUpRight className="size-5 text-muted-foreground group-hover:text-emerald-500 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                </div>
                <span className="eyebrow text-emerald-600 dark:text-emerald-400 text-[10px] md:text-xs font-bold tracking-wider block mt-6">
                  WHATSAPP FAST RESPONSE
                </span>
                <h3 className="text-base sm:text-lg md:text-xl font-black text-foreground font-mono mt-2 group-hover:text-emerald-500 transition-colors">
                  0895-8088-60080
                </h3>
                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  Layanan chat langsung untuk cek stok, panduan ukuran, dan fast order.
                </p>
              </div>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-6 inline-flex items-center gap-1.5 group-hover:translate-x-1 transition-transform">
                Chat WhatsApp Sekarang →
              </span>
            </a>

            {/* Alamat Card 1 - Cimahi */}
            <a
              href={mapCimahiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-border p-6 sm:p-8 rounded-xl bg-card/60 hover:border-rose-500 hover:shadow-lg transition-all duration-300 group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-lg bg-rose-500/10 text-rose-500">
                    <MapPin className="size-6" strokeWidth={1.75} />
                  </div>
                  <ArrowUpRight className="size-5 text-muted-foreground group-hover:text-rose-500 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                </div>
                <span className="eyebrow text-rose-600 dark:text-rose-400 text-[10px] md:text-xs font-bold tracking-wider block mt-6">
                  LOKASI TOKO 1 (CIMAHI)
                </span>
                <h3 className="text-base sm:text-lg font-black text-foreground mt-2 group-hover:text-rose-500 transition-colors leading-snug">
                  Jl. KH Usman Domiri
                </h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Padasuka, Kec. Cimahi Tengah, Kota Cimahi, Jawa Barat
                </p>
              </div>
              <span className="text-xs text-rose-600 dark:text-rose-400 font-bold mt-6 inline-flex items-center gap-1.5 group-hover:translate-x-1 transition-transform">
                Buka di Google Maps →
              </span>
            </a>

            {/* Alamat Card 2 - Sukabumi */}
            <a
              href={mapSukabumiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-border p-6 sm:p-8 rounded-xl bg-card/60 hover:border-amber-500 hover:shadow-lg transition-all duration-300 group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-lg bg-amber-500/10 text-amber-500">
                    <MapPin className="size-6" strokeWidth={1.75} />
                  </div>
                  <ArrowUpRight className="size-5 text-muted-foreground group-hover:text-amber-500 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
                </div>
                <span className="eyebrow text-amber-600 dark:text-amber-400 text-[10px] md:text-xs font-bold tracking-wider block mt-6">
                  LOKASI TOKO 2 (SUKABUMI)
                </span>
                <h3 className="text-base sm:text-lg font-black text-foreground mt-2 group-hover:text-amber-500 transition-colors leading-snug">
                  Villa Adiprima
                </h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Kec. Sukaraja, Kab. Sukabumi, Jawa Barat
                </p>
              </div>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-bold mt-6 inline-flex items-center gap-1.5 group-hover:translate-x-1 transition-transform">
                Buka di Google Maps →
              </span>
            </a>
          </div>
        </main>
        <Footer />
      </>
    );
  },
});

