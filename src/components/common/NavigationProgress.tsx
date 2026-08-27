import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/**
 * Top Progress Bar yang aktif di setiap perpindahan halaman
 * Memberikan animasi loading halus, glow gradient hijau brand, dan feedback instan.
 */
export function NavigationProgress() {
  const routerState = useRouterState();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const pathname = routerState.location.pathname;
  const isRouterLoading = routerState.status === "pending" || routerState.isLoading;

  // Efek ketika router sedang loading (async data loader / route pending)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRouterLoading) {
      setVisible(true);
      setProgress(25);
      timer = setTimeout(() => {
        setProgress(75);
      }, 200);
    } else {
      if (visible) {
        setProgress(100);
        timer = setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 300);
      }
    }
    return () => clearTimeout(timer);
  }, [isRouterLoading]);

  // Efek micro-progress bar di setiap perpindahan rute URL
  useEffect(() => {
    setVisible(true);
    setProgress(35);

    const midTimer = setTimeout(() => {
      setProgress(85);
    }, 80);

    const finishTimer = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 250);
    }, 280);

    return () => {
      clearTimeout(midTimer);
      clearTimeout(finishTimer);
    };
  }, [pathname]);

  if (!visible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {/* Background Track Glow */}
      <div
        className="h-full bg-gradient-to-r from-primary via-emerald-400 to-green-500 shadow-[0_0_12px_rgba(22,163,74,0.8),0_0_4px_rgba(16,185,129,0.9)] transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
        }}
      />
      {/* Leading Edge Shimmer Point */}
      <div
        className="absolute top-0 h-[3px] w-24 bg-white/60 blur-[1px] -translate-y-[0px] shadow-[0_0_8px_#ffffff] transition-all duration-200 ease-out"
        style={{
          left: `calc(${progress}% - 96px)`,
          opacity: progress > 10 && progress < 100 ? 1 : 0,
        }}
      />
    </div>
  );
}
