import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { ADMIN_NAV } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/_admin/admin/koleksi")({
  component: AdminCollections,
});

function AdminCollections() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ slug: "", title: "", subtitle: "", cover_url: "" });
  const q = useQuery({
    queryKey: ["admin-fc"],
    queryFn: async () =>
      (await supabase.from("featured_collections").select("*").order("sort_order")).data ?? [],
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("featured_collections").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ditambahkan");
      setForm({ slug: "", title: "", subtitle: "", cover_url: "" });
      qc.invalidateQueries({ queryKey: ["admin-fc"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader eyebrow="Koleksi" title="Featured Collections" />
      <Card className="mb-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Slug</Label>
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </div>
          <div>
            <Label>Judul</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <Label>Subjudul</Label>
            <Input
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
            />
          </div>
          <div>
            <Label>Cover URL</Label>
            <Input
              value={form.cover_url}
              onChange={(e) => setForm({ ...form, cover_url: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={() => add.mutate()}>Tambah Koleksi</Button>
          </div>
        </div>
      </Card>
      <Card>
        {q.data?.length ? (
          q.data.map((c) => (
            <div
              key={c.id}
              className="flex justify-between py-2 border-b border-border/50 last:border-0"
            >
              <div>
                <div className="font-semibold">{c.title}</div>
                <div className="text-xs text-muted-foreground">{c.slug}</div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada koleksi.</p>
        )}
      </Card>
    </DashboardShell>
  );
}
