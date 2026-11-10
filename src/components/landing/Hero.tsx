import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import heroEditorialGlory from "@/assets/hero-editorial-glory.jpg";
import heroEditorialChelsea from "@/assets/hero-editorial-chelsea.jpg";
import heroEditorialMilan from "@/assets/hero-editorial-milan.jpg";
import { cn } from "@/lib/utils";

export interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaHref: string;
  isInternalRoute?: boolean;
  image: string;
  alt: string;
  objectPosition?: string;
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: "tampil-menyala",
    title: "SAATNYA TAMPIL MENYALA",
    subtitle:
      "Dari tribun sampai tongkrongan, jersey lo harus paling stand out. Grade Ori Thailand 1:1 & Original pilihan—bahan adem, detail presisi, auto ganteng maksimal.",
    ctaText: "Gas Cek Koleksi",
    ctaHref: "#new-arrivals",
    image: heroEditorialGlory,
    alt: "Model cewek mengenakan jersey klasik Jerman putih di depan jaring gawang saat matahari sore",
    objectPosition: "object-[center_18%]",
  },
  {
    id: "musim-baru",
    title: "UPDATE GAYA MUSIM BARU",
    subtitle:
      "Jangan sampai ketinggalan hype musim ini! Koleksi jersey Home, Away, & Third klub Eropa terbaru siap bikin penampilan lo makin segar tiap matchday.",
    ctaText: "Sikat Rilisan Baru",
    ctaHref: "#new-arrivals",
    image: heroEditorialChelsea,
    alt: "Model cowok mengenakan jersey Chelsea biru musim terbaru bersandar di jaring gawang",
    objectPosition: "object-[center_16%]",
  },
  {
    id: "rebut-kejayaan",
    title: "REBUT KEJAYAAN LO",
    subtitle:
      "Nggak ada kata medioker buat fans sejati. Mulai dari rilisan musim terbaru sampai edisi ikonik sepanjang masa, saatnya lo melangkah penuh kebanggaan.",
    ctaText: "Jelajahi Katalog",
    ctaHref: "/shop",
    isInternalRoute: true,
    image: heroEditorialMilan,
    alt: "Model cewek mengenakan jersey ikonik AC Milan merah-hitam di depan jaring gawang",
    objectPosition: "object-[center_18%]",
  },
];

const AUTOPLAY_INTERVAL_MS = 4000;

export function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [previousSlide, setPreviousSlide] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide((prev) => {
      if (prev === index) return prev;
      setPreviousSlide(prev);
      return index;
    });
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => {
      setPreviousSlide(prev);
      return (prev + 1) % HERO_SLIDES.length;
    });
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => {
      setPreviousSlide(prev);
      return (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length;
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(nextSlide, AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [currentSlide, nextSlide]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(deltaX) > 45) {
      if (deltaX < 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
    touchStartX.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      nextSlide();
    } else if (e.key === "ArrowLeft") {
      prevSlide();
    }
  };

  const activeSlide = HERO_SLIDES[currentSlide];

  return (
    <section
      id="top"
      aria-roledescription="carousel"
      aria-label="Sorotan Koleksi Utama AA Jersey"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="relative h-dvh min-h-[620px] w-full bg-neutral-950 text-white overflow-hidden flex flex-col justify-end outline-none"
    >
      {/* Background Slides with Ken Burns Zoom-Out & Seamless Crossfade */}
      <div className="absolute inset-0">
        {HERO_SLIDES.map((slide, index) => {
          const isActive = index === currentSlide;
          const isPrevious = index === previousSlide;

          return (
            <div
              key={slide.id}
              aria-hidden={!isActive}
              className={cn(
                "absolute inset-0 transition-opacity duration-1200 ease-in-out will-change-[opacity]",
                isActive
                  ? "opacity-100 z-10"
                  : isPrevious
                    ? "opacity-0 z-[5] pointer-events-none"
                    : "opacity-0 z-0 pointer-events-none",
              )}
            >
              <img
                key={isActive ? `${slide.id}-${currentSlide}` : `${slide.id}-idle`}
                src={slide.image}
                alt={slide.alt}
                width={1920}
                height={1080}
                fetchPriority={index === 0 ? "high" : "auto"}
                loading="eager"
                decoding="async"
                className={cn(
                  "size-full object-cover will-change-transform",
                  slide.objectPosition ?? "object-center",
                  isActive
                    ? "animate-hero-zoom-out"
                    : isPrevious
                      ? "scale-100"
                      : "scale-[1.12]",
                )}
              />
            </div>
          );
        })}

        {/* Top Scrim for Transparent Navbar Legibility */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/65 via-black/25 to-transparent z-20 pointer-events-none"
        />

        {/* Bottom & Center Editorial Scrim for Text Contrast */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent z-20 pointer-events-none"
        />
      </div>

      {/* Centered Editorial Content */}
      <div className="relative z-30 container-swiss pt-28 pb-16 sm:pb-20 md:pb-24 flex flex-col items-center text-center">
        <div
          key={activeSlide.id}
          aria-live="polite"
          className="max-w-6xl mx-auto flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 duration-700 ease-out"
        >
          <h1 className="font-display font-black uppercase tracking-tight text-white text-3xl sm:text-5xl md:text-6xl lg:text-[4.25rem] xl:text-[4.75rem] leading-[0.98] drop-shadow-[0_4px_24px_rgba(0,0,0,0.55)]">
            {activeSlide.title}
          </h1>

          <p className="mt-3.5 sm:mt-4 text-sm sm:text-base md:text-lg text-white/90 max-w-2xl mx-auto font-normal leading-relaxed drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
            {activeSlide.subtitle}
          </p>

          <div className="mt-6 sm:mt-8">
            {activeSlide.isInternalRoute ? (
              <Link
                to={activeSlide.ctaHref}
                className="inline-flex items-center justify-center rounded-full bg-white text-neutral-950 px-8 py-3.5 sm:px-10 sm:py-4 text-sm sm:text-base font-bold tracking-tight shadow-[0_10px_30px_rgba(0,0,0,0.35)] hover:bg-neutral-100 hover:scale-105 active:scale-95 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 outline-none"
              >
                {activeSlide.ctaText}
              </Link>
            ) : (
              <a
                href={activeSlide.ctaHref}
                className="inline-flex items-center justify-center rounded-full bg-white text-neutral-950 px-8 py-3.5 sm:px-10 sm:py-4 text-sm sm:text-base font-bold tracking-tight shadow-[0_10px_30px_rgba(0,0,0,0.35)] hover:bg-neutral-100 hover:scale-105 active:scale-95 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 outline-none"
              >
                {activeSlide.ctaText}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Segmented Carousel Indicators */}
      <div
        role="tablist"
        aria-label="Pilih slide utama"
        className="absolute bottom-5 sm:bottom-7 inset-x-0 z-30 flex items-center justify-center gap-2.5 px-4"
      >
        {HERO_SLIDES.map((slide, index) => {
          const isActive = index === currentSlide;
          return (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`Tampilkan slide ${index + 1}: ${slide.title}`}
              onClick={() => goToSlide(index)}
              className="group py-2 focus-visible:outline-none cursor-pointer"
            >
              <span
                className={cn(
                  "block h-1 rounded-full transition-all duration-500 ease-out",
                  isActive
                    ? "w-12 sm:w-14 bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                    : "w-10 sm:w-12 bg-white/35 group-hover:bg-white/65",
                )}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
