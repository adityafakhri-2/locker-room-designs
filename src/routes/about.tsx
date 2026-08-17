import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Shirt, Sparkles, ShieldCheck, Truck, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "Tentang Kami — AA Jersey" },
      {
        name: "description",
        content: "Destinasi utama jersey sepak bola terlengkap di Indonesia. Jersey Grade Ori Import Thailand kualitas 1:1, new season, dan retro klasik.",
      },
    ],
  }),
  component: () => (
    <>
      <Navbar />
      <main
        id="main-content"
        className="pt-28 md:pt-36 pb-24 container-swiss min-h-screen max-w-5xl"
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block size-2 bg-primary rounded-full" />
          <span className="eyebrow text-muted-foreground">N° 09 — Tentang Kami</span>
        </div>

        <h1 className="display-lg mt-2">
          Jersey Kualitas Juara, <em className="italic font-light text-primary">Gaya Sejati.</em>
        </h1>

        <div className="mt-8 space-y-6 text-base md:text-lg leading-relaxed text-foreground/80 max-w-3xl">
          <p>
            <strong className="text-foreground font-semibold">AA Jersey</strong> adalah destinasi utama bagi para pencinta sepak bola dan penikmat jersey di Indonesia. Kami menghadirkan kurasi koleksi jersey terlengkap dengan pilihan variatif — mulai dari <strong className="text-foreground font-semibold">Jersey 100% Original Resmi</strong> (Official Merchandise) hingga <strong className="text-foreground font-semibold">Grade Ori Import Thailand 1:1</strong> kualitas terbaik.
          </p>
          <p>
            Kami memberikan transparansi penuh untuk setiap penggemar sepak bola: Anda dapat memilih jersey <em>Original Resmi</em> bergaransi keaslian untuk koleksi bernilai tinggi, maupun jersey <em>Grade Ori Import</em> dengan material dry-fit adem, bordir emblem presisi, dan jahitan kokoh yang nyaman dipakai untuk bermain bola atau gaya kasual harian.
          </p>
          <p>
            Koleksi kami mencakup rilisan jersey musim terbaru (new season 2026/27), klub-klub raksasa Eropa, tim nasional dunia, hingga edisi retro klasik legendaris. Dengan sistem pemesanan modern dan kurir terpercaya, AA Jersey siap mengantarkan jersey pilihan Anda dengan aman ke seluruh penjuru Indonesia.
          </p>
        </div>

        {/* 4 Keunggulan Utama AA Jersey */}
        <div className="mt-16 pt-12 border-t border-border">
          <span className="eyebrow text-primary font-bold tracking-wider block mb-6">
            Kenapa Memilih AA Jersey?
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-5 rounded-lg border border-border/70 bg-card/60 space-y-3">
              <div className="p-2.5 rounded-md bg-primary/10 text-primary w-fit">
                <Shirt className="size-5" />
              </div>
              <h3 className="font-bold text-base text-foreground">Original & Grade Ori 1:1</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Pilihan transparan antara jersey 100% Original resmi dan Grade Ori Import kualitas terbaik.
              </p>
            </div>

            <div className="p-5 rounded-lg border border-border/70 bg-card/60 space-y-3">
              <div className="p-2.5 rounded-md bg-primary/10 text-primary w-fit">
                <Sparkles className="size-5" />
              </div>
              <h3 className="font-bold text-base text-foreground">Koleksi Terlengkap</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Dari rilisan jersey terbaru musim 2026/27, edisi player issue, hingga jersey retro bersejarah.
              </p>
            </div>

            <div className="p-5 rounded-lg border border-border/70 bg-card/60 space-y-3">
              <div className="p-2.5 rounded-md bg-primary/10 text-primary w-fit">
                <ShieldCheck className="size-5" />
              </div>
              <h3 className="font-bold text-base text-foreground">Harga Terjangkau</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Kualitas mewah dengan penawaran harga bersahabat dan berbagai promo menarik setiap minggunya.
              </p>
            </div>

            <div className="p-5 rounded-lg border border-border/70 bg-card/60 space-y-3">
              <div className="p-2.5 rounded-md bg-primary/10 text-primary w-fit">
                <Truck className="size-5" />
              </div>
              <h3 className="font-bold text-base text-foreground">Pengiriman Seluruh RI</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Pengemasan rapi dan aman, bekerja sama dengan kurir terpercaya ke seluruh Indonesia.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Banner */}
        <div className="mt-14 p-8 rounded-xl bg-muted/40 border border-border flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-lg md:text-xl font-bold text-foreground">
              Siap Menambah Koleksi Jersey Anda?
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Temukan jersey klub dan timnas favorit Anda dengan harga terbaik sekarang.
            </p>
          </div>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold px-6 py-3 rounded-md hover:bg-secondary transition-all shadow-md shrink-0"
          >
            <span>Jelajahi Katalog</span>
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </main>
      <Footer />
    </>
  ),
});

