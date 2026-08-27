import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Initial Brand Splash Loader
 * Menampilkan animasi loading brand yang elegan & premium saat pertama kali membuka website / landing page.
 * Dirender langsung dari frame pertama tanpa flash, menggunakan logo hitam yang tajam dan kontras.
 */
export function InitialBrandLoader() {
  const [isDone, setIsDone] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    // Timer durasi tampilan splash loader (cepat & sat-set di bawah 1 detik)
    const timer = setTimeout(() => {
      setIsDone(true);
    }, 450);

    // Hapus elemen dari DOM setelah animasi fade-out selesai
    const removeTimer = setTimeout(() => {
      setShouldRender(false);
    }, 800);

    return () => {
      clearTimeout(timer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!shouldRender) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-background transition-all duration-350 ease-out pointer-events-none",
        isDone ? "opacity-0 invisible scale-101" : "opacity-100 visible scale-100",
      )}
    >
      <div className="flex flex-col items-center gap-5 p-6 text-center max-w-xs animate-in fade-in zoom-in-95 duration-400">
        {/* Logo Container with Ambient Emerald Glow */}
        <div className="relative flex items-center justify-center size-24">
          <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl animate-pulse" />
          <div className="relative size-20 rounded-2xl bg-card border border-border/80 shadow-2xl flex items-center justify-center p-3">
            <img
              src="/logo-aa-jersey-dark.png"
              alt="Logo AA Jersey"
              className="size-full object-contain animate-pulse"
            />
          </div>
        </div>

        {/* Brand Name & Tagline */}
        <div className="space-y-1">
          <h1 className="font-display text-xl font-extrabold tracking-tight text-foreground">
            AA JERSEY
          </h1>
          <p className="text-[11px] font-medium text-muted-foreground tracking-widest uppercase">
            Jersey Asli, Gaya Sejati
          </p>
        </div>

        {/* Shimmering Loading Progress Line */}
        <div className="w-36 h-1 bg-muted rounded-full overflow-hidden relative mt-2">
          <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-primary via-emerald-400 to-green-500 rounded-full animate-[shimmer_1.2s_infinite_linear] shadow-[0_0_8px_rgba(22,163,74,0.8)]" />
        </div>
      </div>
    </div>
  );
}
