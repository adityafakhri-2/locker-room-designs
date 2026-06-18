import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { TrustStats } from "@/components/landing/TrustStats";
import { FeaturedCollections } from "@/components/landing/FeaturedCollections";
import { NewArrivals, BestSellers } from "@/components/landing/ProductGrid";
import { VintageSpotlight } from "@/components/landing/VintageSpotlight";
import { AuthenticityPromise } from "@/components/landing/AuthenticityPromise";
import { WhyChooseUs } from "@/components/landing/WhyChooseUs";
import { Testimonials } from "@/components/landing/Testimonials";
import { FootballMemories } from "@/components/landing/FootballMemories";
import { Newsletter } from "@/components/landing/Newsletter";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Locker Room — Where Football Memories Live" },
      {
        name: "description",
        content:
          "Toko jersey sepak bola premium di Indonesia. Original, vintage, retro, dan edisi langka — terverifikasi keasliannya untuk fans dan kolektor sejati.",
      },
      { property: "og:title", content: "The Locker Room — Where Football Memories Live" },
      {
        property: "og:description",
        content:
          "Original. Vintage. Retro. Limited edition. Jersey sepak bola yang telah menjadi bagian dari sejarah.",
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
      <FeaturedCollections />
      <NewArrivals />
      <BestSellers />
      <VintageSpotlight />
      <AuthenticityPromise />
      <WhyChooseUs />
      <Testimonials />
      <FootballMemories />
      <Newsletter />
      <FAQ />
      <FinalCTA />
      <Footer />
      <Toaster position="bottom-right" />
    </main>
  );
}
