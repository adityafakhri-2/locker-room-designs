# The Locker Room — Landing Page Plan

A single-page Swiss-editorial landing site for a premium football jersey store. Predominantly white with football-green accents, oversized Inter typography, photography-led, no clutter.

## Design system (src/styles.css)

- Tokens (oklch equivalents of the brand hexes):
  - `--background` #FFFFFF, `--foreground` #111111
  - `--muted` #F5F5F5, `--muted-foreground` #555555
  - `--primary` #1E7D32 (Field Green), `--primary-foreground` #FFFFFF
  - `--secondary` #145A24 (Dark Green)
  - `--success` #2E7D32, `--border` subtle gray
- Typography: Inter (400 / 600 / 800) loaded via `<link>` in `__root.tsx`; `--font-display` and `--font-sans` both Inter, with tight tracking + large display sizes via custom utilities (`.display-xl`, `.display-lg`, `.eyebrow`).
- Grid: 12-col container, generous gutters, `max-w-[1400px]`, section padding `py-24 md:py-32`.
- Motion: subtle fade/translate on scroll using IntersectionObserver hook; hover image-zoom via `scale-[1.04] transition-transform duration-700`.

## Route

- Replace `src/routes/index.tsx` placeholder with the full landing composition.
- Update root `head()` SEO: title "The Locker Room — Where Football Memories Live", description, og/twitter tags.

## Component breakdown (src/components/landing/)

1. `Navbar.tsx` — transparent over hero, sticky white-on-scroll, logo left / nav center (Shop, Collections, Vintage, About) / icons right (Search, Wishlist, Cart, Login). Mobile sheet menu.
2. `Hero.tsx` — split Swiss grid: oversized headline "Original Jerseys. / Vintage Memories.", Indonesian subheadline, two CTAs (Belanja Sekarang / Jelajahi Koleksi Vintage), 4 trust ticks, large jersey photo right column with eyebrow meta.
3. `TrustStats.tsx` — 4-up stat row (5.000+, 1.500+, 4.9/5, 100%) with hairline dividers.
4. `FeaturedCollections.tsx` — 4-card editorial grid (New Season, Vintage, Retro, Limited Edition) with image-zoom hover.
5. `NewArrivals.tsx` — 4-col product grid: image, club, season, price, "Original Verified" badge.
6. `BestSellers.tsx` — product grid with urgency tag ("Terjual 120+ kali bulan ini").
7. `VintageSpotlight.tsx` — museum-style large feature: Man United 1998/99 Treble, story copy, Condition Rating / Collector Score / Authenticity Certificate meta block.
8. `AuthenticityPromise.tsx` — 3-col (Original Verified, Certificate of Authenticity, Collector Inspection) with numbered steps.
9. `WhyChooseUs.tsx` — 6 icon cards in Swiss grid (Fokus Original, Vintage Langka, Story, Kurasi Kolektor, Premium, Keamanan).
10. `Testimonials.tsx` — card slider (embla/carousel) with photo, name, city.
11. `FootballMemories.tsx` — full-bleed dramatic photo + editorial pull-quote.
12. `Newsletter.tsx` — headline + email input + "Gabung Sekarang".
13. `FAQ.tsx` — shadcn Accordion, 5 questions.
14. `FinalCTA.tsx` — large centered CTA on green or white-on-black variant.
15. `Footer.tsx` — 4 columns (Shop / Customer Service / Social / Contact) + bottom copyright line.

Shared: `Section.tsx` (consistent padding + eyebrow + headline), `ProductCard.tsx`, `useReveal.ts` hook, `Eyebrow.tsx`.

## Imagery

Generate AI photography saved under `src/assets/` (imported as ES6):
- hero jersey (portrait, stadium light)
- 4 collection covers (new-season, vintage, retro, limited)
- 6 product shots for New Arrivals + Best Sellers (reuse some)
- vintage spotlight Man United '99 hero
- football memories full-bleed (locker room / floodlights)
- 3 testimonial portraits

All generated with `imagegen--generate_image` at appropriate sizes; .jpg for photos.

## SEO

- Title <60 chars, description <160, single H1 in Hero ("Original Jerseys. Vintage Memories."), semantic `<section>` / `<header>` / `<footer>`, alt text on every image, viewport already set.

## Out of scope (no backend)

Newsletter, search, cart, login, wishlist are UI-only (no submission handler beyond a toast). No Lovable Cloud needed for this pass; can be added later if the user wants real commerce.

## Verification

After implementation: read runtime errors, view preview at desktop (1440) and mobile (390) widths to confirm hierarchy holds and nothing clips.
