import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { ADMIN_NAV } from "@/lib/navigation";
import { Button } from "@/components/ui/button";

interface ReviewItem {
  id: string;
  rating: number;
  body: string | null;
  approved: boolean;
  hidden: boolean;
  products: { name: string } | null;
}

export const Route = createFileRoute("/_authenticated/_admin/admin/ulasan")({
  component: AdminReviews,
});

function AdminReviews() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () =>
      (
        await supabase
          .from("reviews")
          .select("*, products(name)")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const setStatus = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { approved?: boolean; hidden?: boolean };
    }) => {
      const { error } = await supabase.from("reviews").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Diperbarui");
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
  });
  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader eyebrow="Ulasan" title="Moderasi Ulasan" />
      {q.data?.length ? (
        q.data.map((r: ReviewItem) => (
          <Card key={r.id} className="mb-3">
            <div className="flex justify-between">
              <div>
                <div className="text-xs eyebrow text-muted-foreground">{r.products?.name}</div>
                <div className="font-semibold">★ {r.rating}/5</div>
                <p className="text-sm mt-1">{r.body}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Status: {r.approved ? "approved" : "pending"} {r.hidden && "(hidden)"}
                </p>
              </div>
              <div className="flex gap-2">
                {!r.approved && (
                  <Button
                    size="sm"
                    onClick={() => setStatus.mutate({ id: r.id, patch: { approved: true } })}
                  >
                    Approve
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus.mutate({ id: r.id, patch: { hidden: !r.hidden } })}
                >
                  {r.hidden ? "Show" : "Hide"}
                </Button>
              </div>
            </div>
          </Card>
        ))
      ) : (
        <Card>Belum ada ulasan.</Card>
      )}
    </DashboardShell>
  );
}
