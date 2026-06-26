import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { ADMIN_NAV } from "./admin.index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/admin/kategori")({
  component: AdminCategories,
});

function AdminCategories() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const q = useQuery({
    queryKey: ["admin-cats"],
    queryFn: async () =>
      (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("categories")
        .insert({ name, slug: slug || name.toLowerCase().replace(/\s+/g, "-") });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kategori ditambahkan");
      setName("");
      setSlug("");
      qc.invalidateQueries({ queryKey: ["admin-cats"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const del = useMutation({
    mutationFn: async (id: string) =>
      (await supabase.from("categories").delete().eq("id", id)).error,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-cats"] }),
  });
  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader eyebrow="Kategori" title="Manajemen Kategori" />
      <Card className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
          <Input placeholder="Nama" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            placeholder="slug (opsional)"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <Button onClick={() => name && add.mutate()}>Tambah</Button>
        </div>
      </Card>
      <Card>
        {q.data?.map((c) => (
          <div
            key={c.id}
            className="flex justify-between items-center py-2 border-b border-border/50 last:border-0"
          >
            <div>
              <div className="font-semibold">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.slug}</div>
            </div>
            <button onClick={() => del.mutate(c.id)} className="text-destructive">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </Card>
    </DashboardShell>
  );
}
