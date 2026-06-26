import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const Route = createFileRoute("/collections")({
  head: () => ({ meta: [{ title: "Collections — The Locker Room" }] }),
  component: CollectionsPage,
});

function CollectionsPage() {
  const q = useQuery({
    queryKey: ["featured-collections"],
    queryFn: async () =>
      (
        await supabase
          .from("featured_collections")
          .select("*")
          .eq("is_active", true)
          .order("sort_order")
      ).data ?? [],
  });
  return (
    <>
      <Navbar />
      <main id="main-content" className="pt-28 md:pt-36 pb-20 container-swiss min-h-screen">
        <span className="eyebrow text-muted-foreground">N° 03 — Collections</span>
        <h1 className="display-lg mt-3">Featured Collections</h1>
        <p className="text-muted-foreground mt-4 max-w-xl">
          Koleksi pilihan kurator — vintage, retro, dan limited edition yang menjadi saksi sejarah
          sepak bola.
        </p>

        {q.data?.length ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            {q.data.map((c) => (
              <Link key={c.id} to="/shop" search={{ category: c.slug }} className="group block">
                <div className="aspect-[4/5] bg-muted overflow-hidden">
                  {c.cover_url && (
                    <img
                      src={c.cover_url}
                      alt={c.title}
                      className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  )}
                </div>
                <h3 className="font-extrabold text-xl mt-4">{c.title}</h3>
                {c.subtitle && <p className="text-muted-foreground text-sm mt-1">{c.subtitle}</p>}
              </Link>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-border p-16 text-center mt-12">
            <p className="text-muted-foreground">
              Belum ada koleksi unggulan. Admin dapat menambahkan dari panel admin.
            </p>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
