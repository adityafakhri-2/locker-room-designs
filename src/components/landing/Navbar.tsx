import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, Heart, ShoppingBag, User, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth, useIsAdmin } from "@/hooks/use-auth";
import { useCart, useWishlist } from "@/hooks/use-commerce";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const NAV = [
  { label: "Shop", to: "/shop" },
  { label: "Collections", to: "/collections" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
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
      (await supabase.from("profiles").select("nama_lengkap").eq("id", user!.id).maybeSingle()).data,
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
        <Link to="/" className="flex items-center gap-2 min-w-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none rounded-sm">
          <span className="inline-block size-2.5 bg-primary" aria-hidden="true" />
          <span className="font-display font-extrabold tracking-tight text-base md:text-lg uppercase whitespace-nowrap">
            The Locker Room
          </span>
        </Link>

        <nav aria-label="Navigasi Utama" className="hidden sm:flex items-center justify-center gap-8 lg:gap-10">
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

        <button
          aria-label={open ? "Tutup menu" : "Buka menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="sm:hidden justify-self-end cursor-pointer size-11 flex items-center justify-center -mr-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none rounded-md"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="sm:hidden border-t border-border bg-background text-foreground">
          <nav aria-label="Navigasi Mobile" className="container-swiss py-6 flex flex-col gap-1">
            {NAV.map((n) => (
              <Link
                key={n.label}
                to={n.to}
                onClick={() => setOpen(false)}
                className="text-base font-semibold py-2.5 hover:opacity-60 transition-opacity cursor-pointer block focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none rounded-sm px-2"
              >
                {n.label}
              </Link>
            ))}
            <Link
              to="/cart"
              onClick={() => setOpen(false)}
              className="text-base font-semibold py-2.5 hover:opacity-60 transition-opacity cursor-pointer block focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none rounded-sm px-2"
            >
              Keranjang ({cartCount})
            </Link>
            <Link
              to={user ? (isAdmin ? "/admin" : "/dashboard") : "/auth"}
              onClick={() => setOpen(false)}
              className="text-base font-semibold py-2.5 hover:opacity-60 transition-opacity cursor-pointer block focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none rounded-sm px-2"
            >
              {user
                ? isAdmin
                  ? `Admin Panel (${displayName})`
                  : `Dashboard (${displayName})`
                : "Login / Daftar"}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
