import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, Heart, ShoppingBag, User, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, useIsAdmin } from "@/hooks/use-auth";
import { useCart, useWishlist } from "@/hooks/use-commerce";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const NAV = [
  { label: "Produk", to: "/shop" },
  { label: "Tentang Kami", to: "/about" },
  { label: "Kontak", to: "/contact" },
];

interface NavbarProps {
  /** When true, navbar starts transparent (over hero). When false, solid from the start. */
  overHero?: boolean;
}

export function Navbar({ overHero = false }: NavbarProps) {
  const [scrolled, setScrolled] = useState(!overHero);
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const { data: cart } = useCart();
  const { data: wishlist } = useWishlist();
  const cartCount = cart?.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const wlCount = wishlist?.length ?? 0;

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("profiles").select("nama_lengkap").eq("id", user!.id).maybeSingle())
        .data,
  });
  const displayName =
    profileQuery.data?.nama_lengkap ||
    user?.user_metadata?.nama_lengkap ||
    user?.user_metadata?.full_name ||
    user?.email ||
    "";

  useEffect(() => {
    if (!overHero) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [overHero]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled
          ? "bg-background/95 backdrop-blur border-b border-border text-foreground"
          : "bg-transparent text-white",
      )}
    >
      <div className="container-swiss grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[1fr_auto_1fr] items-center gap-4 h-16 md:h-20">
        <Link
          to="/"
          className="flex items-center gap-2.5 min-w-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none rounded-sm group"
        >
          <img
            src={scrolled ? "/logo-aa-jersey-dark.png" : "/logo-aa-jersey.png"}
            alt="Logo AA Jersey"
            className="size-7 md:size-8 object-contain drop-shadow-sm group-hover:scale-105 transition-transform"
          />
          <span className="font-display font-extrabold tracking-tight text-base md:text-lg uppercase whitespace-nowrap">
            AA Jersey
          </span>
        </Link>

        <nav
          aria-label="Navigasi Utama"
          className="hidden sm:flex items-center justify-center gap-8 lg:gap-10"
        >
          {NAV.map((n) => (
            <Link
              key={n.label}
              to={n.to}
              className="text-sm font-medium tracking-wide hover:opacity-60 transition-opacity cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none rounded-sm"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden sm:flex items-center justify-end gap-5">
          <Link
            to="/search"
            search={{ q: "" }}
            aria-label="Cari Produk"
            className="hover:opacity-60 transition-opacity cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none rounded-sm p-1"
          >
            <Search className="size-4" strokeWidth={1.5} />
          </Link>
          <Link
            to={user ? "/dashboard/wishlist" : "/auth"}
            aria-label={`Wishlist, ${wlCount} item`}
            className="hover:opacity-60 transition-opacity relative cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none rounded-sm p-1"
          >
            <Heart className="size-4" strokeWidth={1.5} />
            {wlCount > 0 && (
              <span className="absolute -top-1.5 -right-2 text-[10px] font-semibold bg-primary text-primary-foreground rounded-full size-4 grid place-items-center">
                {wlCount}
              </span>
            )}
          </Link>
          <Link
            to="/cart"
            aria-label={`Keranjang Belanja, ${cartCount} item`}
            className="hover:opacity-60 transition-opacity relative cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none rounded-sm p-1"
          >
            <ShoppingBag className="size-4" strokeWidth={1.5} />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 text-[10px] font-semibold bg-primary text-primary-foreground rounded-full size-4 grid place-items-center">
                {cartCount}
              </span>
            )}
          </Link>
          <Link
            to={user ? (isAdmin ? "/admin" : "/dashboard") : "/auth"}
            aria-label={user ? `Akun saya (${displayName})` : "Masuk ke akun"}
            className="hover:opacity-60 transition-opacity flex items-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none rounded-sm p-1"
          >
            {user && (
              <span className="text-xs font-semibold max-w-[120px] truncate">{displayName}</span>
            )}
            <User className="size-4" strokeWidth={1.5} />
          </Link>
        </div>

        {/* Mobile Action Icons + Hamburger */}
        <div className="flex sm:hidden items-center justify-end gap-1 -mr-1">
          <Link
            to="/search"
            search={{ q: "" }}
            aria-label="Cari Produk"
            className="size-10 flex items-center justify-center cursor-pointer hover:opacity-60 transition-opacity rounded-md"
          >
            <Search className="size-4" strokeWidth={1.75} />
          </Link>
          <Link
            to="/cart"
            aria-label={`Keranjang Belanja, ${cartCount} item`}
            className="size-10 flex items-center justify-center relative cursor-pointer hover:opacity-60 transition-opacity rounded-md"
          >
            <ShoppingBag className="size-4" strokeWidth={1.75} />
            {cartCount > 0 && (
              <span className="absolute top-1.5 right-1.5 text-[9px] font-bold bg-primary text-primary-foreground rounded-full size-4 grid place-items-center">
                {cartCount}
              </span>
            )}
          </Link>
          <button
            aria-label={open ? "Tutup menu" : "Buka menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            className="size-10 flex items-center justify-center cursor-pointer hover:opacity-60 transition-opacity rounded-md"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div
          id="mobile-menu"
          className="sm:hidden border-t border-border bg-background text-foreground shadow-2xl animate-in slide-in-from-top-2 duration-200 max-h-[calc(100dvh-4rem)] overflow-y-auto"
        >
          <nav aria-label="Navigasi Mobile" className="container-swiss py-5 flex flex-col gap-1.5">
            {NAV.map((n) => (
              <Link
                key={n.label}
                to={n.to}
                onClick={() => setOpen(false)}
                className="text-base font-semibold py-2.5 px-3 hover:bg-muted rounded-lg transition-colors cursor-pointer block"
              >
                {n.label}
              </Link>
            ))}
            <Link
              to={user ? "/dashboard/wishlist" : "/auth"}
              onClick={() => setOpen(false)}
              className="text-base font-semibold py-2.5 px-3 hover:bg-muted rounded-lg transition-colors cursor-pointer flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <Heart className="size-4 text-muted-foreground" />
                Wishlist
              </span>
              {wlCount > 0 && (
                <span className="text-xs font-bold bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                  {wlCount}
                </span>
              )}
            </Link>
            <Link
              to="/cart"
              onClick={() => setOpen(false)}
              className="text-base font-semibold py-2.5 px-3 hover:bg-muted rounded-lg transition-colors cursor-pointer flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="size-4 text-muted-foreground" />
                Keranjang Belanja
              </span>
              {cartCount > 0 && (
                <span className="text-xs font-bold bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                  {cartCount}
                </span>
              )}
            </Link>
            <div className="my-2 border-t border-border/60" />
            <Link
              to={user ? (isAdmin ? "/admin" : "/dashboard") : "/auth"}
              onClick={() => setOpen(false)}
              className="text-base font-bold py-2.5 px-3 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors cursor-pointer flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <User className="size-4" />
                {user
                  ? isAdmin
                    ? `Admin Panel (${displayName})`
                    : `Dashboard Akun (${displayName})`
                  : "Masuk / Daftar Akun"}
              </span>
              {user && isAdmin && (
                <span className="text-[10px] bg-primary text-primary-foreground font-extrabold px-1.5 py-0.5 rounded">
                  Admin
                </span>
              )}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
