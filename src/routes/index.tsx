import { createFileRoute } from "@tanstack/react-router";

import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { TrustStats } from "@/components/landing/TrustStats";
import { NewArrivals, BestSellers } from "@/components/landing/ProductGrid";
import { VintageSpotlight } from "@/components/landing/VintageSpotlight";
import { AuthenticityPromise } from "@/components/landing/AuthenticityPromise";
import { WhyChooseUs } from "@/components/landing/WhyChooseUs";
import { FootballMemories } from "@/components/landing/FootballMemories";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AA Jersey — Spesialis Jersey Grade Ori Thailand & Original" },
      {
        name: "description",
        content:
          "Pusat jersey sepak bola Grade Ori import Thailand 1:1 dan jersey original terlengkap di Indonesia. Bahan dry-fit premium, detail presisi, dan harga terbaik.",
      },
      {
        property: "og:title",
        content: "AA Jersey — Spesialis Jersey Grade Ori Thailand & Original",
      },
      {
        property: "og:description",
        content:
          "Koleksi jersey Grade Ori Thailand 1:1, retro legendaris, dan original pilihan untuk fans sejati.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="bg-background text-foreground">
      <Navbar overHero />
      <Hero />
      <TrustStats />
      <NewArrivals />
      <BestSellers />
      <VintageSpotlight />
      <AuthenticityPromise />
      <WhyChooseUs />
      <FootballMemories />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}
