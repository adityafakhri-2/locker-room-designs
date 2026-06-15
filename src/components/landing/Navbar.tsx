import { useEffect, useState } from "react";
import { Search, Heart, ShoppingBag, User, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Shop", href: "#collections" },
  { label: "Collections", href: "#collections" },
  { label: "Vintage", href: "#vintage" },
  { label: "About", href: "#about" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled
          ? "bg-background/95 backdrop-blur border-b border-border text-foreground"
          : "bg-transparent text-white"
      )}
    >
      <div className="container-swiss grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[1fr_auto_1fr] items-center gap-4 h-16 md:h-20">
        <a href="#top" className="flex items-center gap-2 min-w-0">
          <span className="inline-block size-2.5 bg-primary" aria-hidden />
          <span className="font-display font-extrabold tracking-tight text-base md:text-lg uppercase whitespace-nowrap">
            The Locker Room
          </span>
        </a>

        <nav className="hidden sm:flex items-center justify-center gap-8 lg:gap-10">
          {NAV.map((n) => (
            <a
              key={n.label}
              href={n.href}
              className="text-sm font-medium tracking-wide hover:opacity-60 transition-opacity"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="hidden sm:flex items-center justify-end gap-5">
          <button aria-label="Search" className="hover:opacity-60 transition-opacity">
            <Search className="size-4" strokeWidth={1.5} />
          </button>
          <button aria-label="Wishlist" className="hover:opacity-60 transition-opacity">
            <Heart className="size-4" strokeWidth={1.5} />
          </button>
          <button aria-label="Cart" className="hover:opacity-60 transition-opacity relative">
            <ShoppingBag className="size-4" strokeWidth={1.5} />
            <span className="absolute -top-1.5 -right-2 text-[10px] font-semibold bg-primary text-primary-foreground rounded-full size-4 grid place-items-center">
              2
            </span>
          </button>
          <button aria-label="Login" className="hover:opacity-60 transition-opacity">
            <User className="size-4" strokeWidth={1.5} />
          </button>
        </div>

        <button
          aria-label="Menu"
          className="sm:hidden justify-self-end"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="sm:hidden border-t border-border bg-background text-foreground">
          <nav className="container-swiss py-6 flex flex-col gap-4">
            {NAV.map((n) => (
              <a
                key={n.label}
                href={n.href}
                onClick={() => setOpen(false)}
                className="text-base font-medium"
              >
                {n.label}
              </a>
            ))}
            <div className="hairline my-2" />
            <div className="flex items-center gap-6 text-muted-foreground">
              <Search className="size-4" />
              <Heart className="size-4" />
              <ShoppingBag className="size-4" />
              <User className="size-4" />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
