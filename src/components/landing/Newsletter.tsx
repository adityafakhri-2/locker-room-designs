import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { Section } from "./Section";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Masukkan email yang valid.");
      return;
    }
    toast.success("Terima kasih! Kamu sudah terdaftar.");
    setEmail("");
  };

  return (
    <Section eyebrow="N° 10 — Buletin" number="Berlangganan">
      <div className="grid lg:grid-cols-12 gap-10 items-end">
        <div className="lg:col-span-7">
          <h2 className="display-lg">
            Jangan lewatkan rilis jersey
            <br />
            <span className="italic font-light">dan promo menarik.</span>
          </h2>
          <p className="mt-6 text-muted-foreground max-w-xl">
            Dapatkan informasi rilis jersey terbaru, koleksi retro favorit, dan voucher diskon
            eksklusif langsung ke email Anda.
          </p>
        </div>

        <form onSubmit={onSubmit} className="lg:col-span-5 flex border border-foreground">
          <Label htmlFor="newsletter-email" className="sr-only">
            Alamat Email
          </Label>
          <input
            id="newsletter-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@kamu.com"
            className="flex-1 min-w-0 px-5 py-4 bg-background text-foreground text-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            className="shrink-0 inline-flex items-center gap-2 bg-foreground text-background px-6 py-4 text-sm font-semibold hover:bg-primary transition-colors"
          >
            Gabung
            <ArrowRight className="size-4" />
          </button>
        </form>
      </div>
    </Section>
  );
}
