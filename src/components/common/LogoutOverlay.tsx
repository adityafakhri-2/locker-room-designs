import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck, LogOut } from "lucide-react";
import { toast } from "sonner";

// Global event listener for triggering luxury logout
let logoutTriggerFn: (() => void) | null = null;

export function triggerGlobalLogout() {
  if (logoutTriggerFn) {
    logoutTriggerFn();
  } else {
    // Fallback if component not mounted
    supabase.auth.signOut().then(() => {
      window.location.href = "/";
    });
  }
}

export function LogoutOverlay() {
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    logoutTriggerFn = async () => {
      setLoggingOut(true);
      try {
        // Tampilkan animasi logout yang berkesan
        await new Promise((res) => setTimeout(res, 850));
        await supabase.auth.signOut();
        toast.success("Sesi berhasil diakhiri. Sampai jumpa kembali!");
        // Refresh router / redirect ke halaman beranda
        window.location.href = "/";
      } catch (err) {
        console.error("Logout error:", err);
        window.location.href = "/";
      }
    };

    return () => {
      logoutTriggerFn = null;
    };
  }, []);

  if (!loggingOut) return null;

  return (
    <div
      aria-live="assertive"
      className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-background/90 backdrop-blur-md animate-in fade-in duration-300"
    >
      <div className="flex flex-col items-center gap-4 p-6 text-center max-w-sm">
        {/* Animated Icon Ring */}
        <div className="relative flex items-center justify-center size-20">
          <div className="absolute inset-0 rounded-full bg-red-500/10 blur-lg animate-pulse" />
          <div className="relative size-16 rounded-2xl bg-card border border-border shadow-2xl flex items-center justify-center">
            <LogOut className="size-7 text-red-600 dark:text-red-400 animate-bounce" />
          </div>
          <Loader2 className="absolute size-20 text-primary animate-spin opacity-80" strokeWidth={1.5} />
        </div>

        {/* Text Details */}
        <div className="space-y-1.5 mt-2">
          <h2 className="font-extrabold text-base sm:text-lg text-foreground tracking-tight">
            Mengamankan Sesi & Keluar...
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Menghapus kredensial login dan mengamankan akun Anda. Terima kasih telah berbelanja di AA Jersey!
          </p>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-muted border border-border text-[11px] font-semibold text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" />
          <span>Enkripsi Sesi Ditutup</span>
        </div>
      </div>
    </div>
  );
}
