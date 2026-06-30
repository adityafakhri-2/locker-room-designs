import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Mail, MessageCircle, MapPin } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact — AA Jersey" }] }),
  component: () => (
    <>
      <Navbar />
      <main id="main-content" className="pt-28 md:pt-36 pb-20 container-swiss min-h-screen">
        <span className="eyebrow text-muted-foreground">N° 10 — Contact</span>
        <h1 className="display-lg mt-3">Hubungi Kami</h1>
        <div className="grid sm:grid-cols-3 gap-6 mt-12">
          <div className="border border-border p-8">
            <Mail className="size-5 text-primary" strokeWidth={1.5} />
            <h3 className="display-md mt-4">Email</h3>
            <p className="text-muted-foreground mt-2">hello@jerseyaa.com</p>
          </div>
          <div className="border border-border p-8">
            <MessageCircle className="size-5 text-primary" strokeWidth={1.5} />
            <h3 className="display-md mt-4">WhatsApp</h3>
            <p className="text-muted-foreground mt-2">+62 812 0000 0000</p>
          </div>
          <div className="border border-border p-8">
            <MapPin className="size-5 text-primary" strokeWidth={1.5} />
            <h3 className="display-md mt-4">Studio</h3>
            <p className="text-muted-foreground mt-2">Jakarta, Indonesia</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  ),
});
