import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, LogOut } from "lucide-react";
import { toast } from "sonner";

// Global event listener for triggering clean logout
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
        await new Promise((res) => setTimeout(res, 550));
        await supabase.auth.signOut();
        toast.success("Sesi berhasil diakhiri. Sampai jumpa kembali!");
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
      className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="flex flex-col items-center gap-3.5 p-6 text-center max-w-sm">
        {/* Clean Static Logout Icon */}
        <div className="flex items-center justify-center size-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 shadow-sm">
          <LogOut className="size-6" />
        </div>

        {/* Text Details */}
        <div className="space-y-1 mt-1">
          <h2 className="font-extrabold text-base text-foreground tracking-tight">
            Mengamankan Sesi & Keluar...
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Menghapus kredensial login dan mengamankan akun Anda.
          </p>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full bg-muted border border-border text-[11px] font-semibold text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" />
          <span>Sesi Berhasil Ditutup</span>
        </div>
      </div>
    </div>
  );
}
