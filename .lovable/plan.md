# The Locker Room — Full E-Commerce Build

Stack stays as-is: **TanStack Start (React 19 + Vite) + Lovable Cloud (Supabase) + Tailwind v4 + shadcn/ui**. UI copy in Bahasa Indonesia. Existing landing page is kept and progressively wired to live data.

## 1. Backend — Lovable Cloud

Enable Cloud, then ship one migration with the full schema, RLS, GRANTs, helper functions, and triggers.

**Enums**
`app_role` (admin, customer), `order_status` (pending, paid, processing, shipped, delivered, cancelled), `payment_status` (waiting_payment, waiting_verification, approved, rejected), `condition_rating` (mint, excellent, good, fair), `authenticity_badge` (original_verified, match_worn, collector_item, limited_edition).

**Tables** (all in `public`, RLS on, GRANTs to authenticated + service_role; anon SELECT only on public catalog tables)

- `profiles` (id=auth.users.id, nama_lengkap, email, no_hp, alata, prmat, koovinsi, kode_pos)
- `user_roles` (user_id, role) — separate table, security-definer `has_role()`
- `categories` (slug, name, sort_order)
- `products` (slug, name, price, stock, category_id, brand, team, league, country, release_year, condition, sizes text[], description, story, collector_score 1–3, authenticity_badge, video_url, is_active, created_at)
- `product_images` (product_id, url, sort_order)
- `product_certificates` (product_id, certificate_number, proof_image_url, notes)
- `featured_collections` (slug, title, cover_url, sort_order) + `featured_collection_products`
- `wishlists` (user_id, product_id)
- `cart_items` (user_id, product_id, size, quantity)
- `addresses` (user_id, …shipping fields)
- `orders` (order_number `TLR-YYYY-NNNNNN`, user_id, status, subtotal, shipping_cost, grand_total, courier, tracking_number, recipient_*, note, created_at + timeline jsonb)
- `order_items` (order_id, product_id snapshot of name/price/size/qty)
- `payments` (order_id, status, bank, amount, verified_by, verified_at)
- `payment_proofs` (payment_id, image_url, uploaded_at)
- `shipments` (order_id, courier, tracking_number, status, updated_at)
- `reviews` (order_id, product_id, user_id, rating, body, photos text[], approved, hidden)

**Storage buckets** (created via tool)

- `product-images` (public)
- `payment-proofs` (private, owner read + admin read)
- `review-photos` (public)
- `certificates` (public)

**Functions & triggers**

- `has_role(uuid, app_role)` SECURITY DEFINER.
- `handle_new_user()` trigger on `auth.users`: insert profile; if it's the **first** user (`count(*)=0` in `user_roles`) grant `admin`, else `customer`.
- `generate_order_number()` — `TLR-{year}-{6-digit seq}` via sequence.
- `set_order_total()` — recompute on order_items change.
- `decrement_stock_on_payment_approved()` — trigger on payments → approved.
- `append_order_timeline()` — on status change.

**RLS highlights**

- Catalog (`products`, `product_images`, `categories`, `featured_*`, approved `reviews`): public SELECT.
- `profiles`, `wishlists`, `cart_items`, `addresses`, `orders`, `order_items`, `payments`, `payment_proofs`, `shipments`, own `reviews`: owner via `auth.uid()`.
- Admin full access on everything via `has_role(auth.uid(),'admin')`.

## 2. Server layer

- Browser `supabase` client for direct reads (catalog, cart, wishlist) under RLS.
- `createServerFn` + `requireSupabaseAuth` for: checkout (`create_order`), `upload_payment_proof`, admin actions (`approve_payment`, `reject_payment`, `update_order_status`, `set_tracking`), product CRUD, review moderation, report aggregates.
- Public read-only server fn for landing page sections (new arrivals, best sellers, featured collections) using publishable client.
- `_authenticated/route.tsx` gate (integration-managed) for `/dashboard/*`.
- `_authenticated/_admin` nested layout gating on `has_role(...,'admin')`.

## 3. Routes (file-based, Bahasa Indonesia copy)

**Public**

- `/` (existing landing, wire dynamic sections to DB; keep mock fallback if empty)
- `/shop` — filters (klub, negara, liga, tahun, ukuran, harga, kondisi, availability), sort, pagination
- `/product/$slug` — gallery + zoom, video, story, size guide, authenticity badge, certificate, related, reviews, add to cart/wishlist
- `/collections`, `/collections/$slug`
- `/search?q=`
- `/about`, `/contact`
- `/cart`, `/checkout`, `/checkout/success/$orderNumber`
- `/auth` (login + register tabs, email/password)

**Customer (`_authenticated/`)**

- `/dashboard` — totals (pesanan, aktif, wishlist, status terakhir)
- `/dashboard/pesanan` + `/dashboard/pesanan/$orderNumber` (timeline, upload bukti transfer, lihat status verifikasi, tracking)
- `/dashboard/wishlist`
- `/dashboard/profil`

**Admin (`_authenticated/_admin/`)**

- `/admin` — revenue, orders, products, customers, recent orders, best sellers, monthly revenue chart (Recharts), status summary
- `/admin/produk` (list + create/edit/delete with images upload, sizes, badge, story, collector score, certificate)
- `/admin/kategori`
- `/admin/koleksi` (featured collections)
- `/admin/pesanan` + detail (approve/reject payment with proof viewer, set courier + tracking, change status, generate printable invoice)
- `/admin/pelanggan` + detail
- `/admin/ulasan` (approve/hide)
- `/admin/laporan` — revenue/order/customer/product/best-seller; export CSV (Excel-compatible) and print-to-PDF view

## 4. Frontend system

Reuse existing Swiss design tokens in `src/styles.css` (brand green already aligned conceptually — switch primary to football green `#1E7D32` / dark `#145A24` per spec, keep the navy as deprecated). Reuse `Section`, `container-swiss`, `display-*`, `eyebrow`.

**Shared components** (new under `src/components/`)

- `app/AppShell`, `app/Sidebar` (customer + admin variants), `app/PageHeader`
- `commerce/ProductCard`, `ProductGallery` (with zoom), `PriceTag`, `AuthenticityBadge`, `CollectorScore`, `ConditionBadge`, `SizePicker`, `QuantityStepper`
- `commerce/CartDrawer`, `CheckoutSteps`, `OrderTimeline`, `PaymentProofUploader`, `BankTransferInstructions`
- `admin/StatCard`, `DataTable` (Tanstack Table), `ImageUploader`, `RichTextArea`
- `forms/*` powered by react-hook-form + zod
- `Toaster` (already present via sonner)

**State**: TanStack Query for all reads/mutations. Cart and wishlist live in DB (auth-required); guest cart in `localStorage` and merged on login.

## 5. Automation behavior

- Order number generated server-side on insert.
- Totals + shipping computed in `create_order` server fn (flat rates per courier table seeded in code: JNE/J&T/SiCepat/AnterAja; configurable later).
- Payment approval → trigger decrements stock and sets order to `paid`; admin then moves to `processing` → `shipped` (requires tracking) → `delivered`.
- Reviews only allowed if user has a `delivered` order containing that product.

## 6. Future-ready scaffolding (schema only, no UI)

Tables/columns added but inert: `payment_methods` (manual_transfer seeded; midtrans/qris/ewallet rows ready), `loyalty_points`, `referrals`, `auctions`, `match_worn_listings`. No code paths wired yet.

## 7. Seeding & first admin

- Empty catalog as requested.
- Categories seeded: New Season, Vintage, Retro, National Teams, Club Teams, Limited Edition.
- Banks seeded: BCA / BRI / Mandiri (account holder placeholder editable in `/admin/pengaturan` later — for now stored as constants).
- First registered user auto-promoted to `admin` via `handle_new_user()` trigger.

## 8. Out of scope this turn

Real payment gateways, email/SMS notifications, real shipping API, AI features, auction UI, loyalty UI — schema is prepared but UI is not built.

## Technical notes

- All admin/auth-protected server fns import `supabaseAdmin` lazily inside `.handler()` only when needed; default DB access uses `requireSupabaseAuth` so RLS applies.
- `attachSupabaseAuth` middleware is registered in `src/start.ts`.
- Public route loaders only call public server fns (no `requireSupabaseAuth`) to keep SSR/prerender working.
- File uploads go through signed-URL pattern via storage client in browser, then server fn records the row.
- Charts via `recharts` (already in shadcn/chart). Tables via `@tanstack/react-table` (add if missing).

This is a very large single build; expect long generation time and follow-up polish turns for edge cases.