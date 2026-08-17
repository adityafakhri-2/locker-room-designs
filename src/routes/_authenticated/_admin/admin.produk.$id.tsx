import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { generateProductDescription, suggestProductPrice } from "@/lib/api/ai.functions";
import { ADMIN_NAV } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadFile, signedUrl } from "@/lib/storage";
import { Switch } from "@/components/ui/switch";
import {
  Trash2,
  ChevronDown,
  Calendar as CalendarIcon,
  Plus,
  X,
  ShieldCheck,
  Shirt,
  Gem,
  Sparkles,
  Loader2,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Star,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function compressAndConvertToWebp(
  file: File,
  quality = 0.8,
): Promise<{ blob: Blob; originalSize: number; compressedSize: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const maxDim = 1600;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Gagal memuat canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Gagal mengompres gambar"));
              return;
            }
            resolve({
              blob,
              originalSize: file.size,
              compressedSize: blob.size,
            });
          },
          "image/webp",
          quality,
        );
      };
      img.onerror = () => reject(new Error("Gagal memuat gambar"));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsDataURL(file);
  });
}

import { formatIDR } from "@/lib/format";

interface PFormState {
  slug: string;
  name: string;
  cost_price: string;
  price: string;
  category_ids: string[];
  brand: string;
  team: string;
  league: string;
  country: string;
  release_year: string;
  condition: string;
  sizes: string;
  description: string;
  story: string;
  authenticity_badge: string;
  video_url: string;
  is_active: boolean;
}

function formatThousand(val: string | number): string {
  const numStr = String(val).replace(/\D/g, "");
  if (!numStr) return "";
  return Number(numStr).toLocaleString("id-ID");
}

const emptyForm: PFormState = {
  slug: "",
  name: "",
  cost_price: "0",
  price: "0",
  category_ids: [],
  brand: "",
  team: "",
  league: "",
  country: "",
  release_year: "",
  condition: "",
  sizes: "S,M,L,XL",
  description: "",
  story: "",
  authenticity_badge: "",
  video_url: "",
  is_active: true,
};

const BADGES = [
  { value: "original_verified", label: "Original Terverifikasi", icon: ShieldCheck },
  { value: "grade_ori", label: "Grade Ori", icon: Shirt },
];

export const Route = createFileRoute("/_authenticated/_admin/admin/produk/$id")({
  component: ProductForm,
});

function ProductForm() {
  const { id } = useParams({ from: "/_authenticated/_admin/admin/produk/$id" });
  const isNew = id === "baru";
  const navigate = useNavigate();
  const [form, setForm] = useState<PFormState>(emptyForm);
  const [sizeStocks, setSizeStocks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isSuggestingPrice, setIsSuggestingPrice] = useState(false);
  const [priceSuggestion, setPriceSuggestion] = useState<{
    suggestedPrice: number;
    analysis: string;
  } | null>(null);
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false);
  const [images, setImages] = useState<
    {
      id?: string;
      url: string;
      previewUrl?: string;
      storage_path?: string;
      originalSize?: number;
      compressedSize?: number;
    }[]
  >([]);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);
  const [deletedStoragePaths, setDeletedStoragePaths] = useState<string[]>([]);

  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);
  const [showLeagueSuggestions, setShowLeagueSuggestions] = useState(false);
  const [showTeamSuggestions, setShowTeamSuggestions] = useState(false);
  const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);

  const [newConditionVal, setNewConditionVal] = useState("");
  const [editingConditionId, setEditingConditionId] = useState<string | null>(null);
  const [editingConditionVal, setEditingConditionVal] = useState("");
  const [conditionToDelete, setConditionToDelete] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [imageUploading, setImageUploading] = useState(false);

  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });

  const metadataSuggestions = useQuery({
    queryKey: ["unique-product-metadata"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("brand, league, team, country");
      const bSet = new Set<string>();
      const lSet = new Set<string>();
      const tSet = new Set<string>();
      const cSet = new Set<string>();
      (data ?? []).forEach((p) => {
        if (p.brand) bSet.add(p.brand);
        if (p.league) lSet.add(p.league);
        if (p.team) tSet.add(p.team);
        if (p.country) cSet.add(p.country);
      });
      return {
        brands: Array.from(bSet).sort(),
        leagues: Array.from(lSet).sort(),
        teams: Array.from(tSet).sort(),
        countries: Array.from(cSet).sort(),
      };
    },
  });

  const conditionsQuery = useQuery({
    queryKey: ["product-conditions"],
    queryFn: async () =>
      (await supabase.from("product_conditions").select("*").order("name")).data ?? [],
  });

  const addConditionMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("product_conditions").insert({ name: name.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kondisi baru berhasil ditambahkan");
      conditionsQuery.refetch();
    },
    onError: (err) => {
      toast.error("Gagal menambahkan kondisi: " + err.message);
    },
  });

  const deleteConditionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_conditions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pilihan kondisi berhasil dihapus");
      conditionsQuery.refetch();
    },
    onError: (err) => {
      toast.error("Gagal menghapus kondisi: " + err.message);
    },
  });

  const editConditionMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("product_conditions")
        .update({ name: name.trim() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kondisi berhasil diubah");
      conditionsQuery.refetch();
    },
    onError: (err) => {
      toast.error("Gagal mengubah kondisi: " + err.message);
    },
  });

  const existing = useQuery({
    queryKey: ["product-edit", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, product_images(*)")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!existing.data) return;
    const p = existing.data;
    setForm({
      slug: p.slug,
      name: p.name,
      cost_price: formatThousand((p as any).cost_price ?? 0),
      price: formatThousand(p.price),
      category_ids: p.category_ids ?? (p.category_id ? [p.category_id] : []),
      brand: p.brand ?? "",
      team: p.team ?? "",
      league: p.league ?? "",
      country: p.country ?? "",
      release_year: String(p.release_year ?? ""),
      condition: p.condition ?? "",
      sizes: (p.sizes ?? []).join(","),
      description: p.description ?? "",
      story: p.story ?? "",
      authenticity_badge: p.authenticity_badge ?? "",
      video_url: p.video_url ?? "",
      is_active: p.is_active,
    });

    if (p.size_stock) {
      setSizeStocks(p.size_stock as Record<string, number>);
    } else {
      const szs = p.sizes ?? [];
      const initStocks: Record<string, number> = {};
      szs.forEach((s) => {
        initStocks[s] = Math.ceil(p.stock / Math.max(szs.length, 1));
      });
      setSizeStocks(initStocks);
    }

    const loadedImages = ((p.product_images as { id: string; url: string }[]) ?? []).map((i) => ({
      id: i.id,
      storage_path: i.url,
      url: supabase.storage.from("product-images").getPublicUrl(i.url).data.publicUrl,
    }));
    setImages(loadedImages);
  }, [existing.data]);

  function set<K extends keyof PFormState>(k: K, v: PFormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setLoading(true);
    setImageUploading(true);
    try {
      const fileList = Array.from(files);
      toast.info(`Mengompres ${fileList.length} gambar ke WebP...`);

      const newImages: {
        storage_path: string;
        url: string;
        previewUrl?: string;
        originalSize: number;
        compressedSize: number;
      }[] = [];

      for (const file of fileList) {
        try {
          const result = await compressAndConvertToWebp(file, 0.8);
          const compressedFile = new File(
            [result.blob],
            `${file.name.substring(0, file.name.lastIndexOf(".")) || file.name}.webp`,
            { type: "image/webp" },
          );

          const path = `${Date.now()}-${compressedFile.name}`;
          const uploadedPath = await uploadFile("product-images", path, compressedFile);

          const { data } = supabase.storage.from("product-images").getPublicUrl(uploadedPath);
          const url = data.publicUrl;
          const localPreview = URL.createObjectURL(compressedFile);

          newImages.push({
            storage_path: uploadedPath,
            url: url || localPreview,
            previewUrl: localPreview,
            originalSize: result.originalSize,
            compressedSize: result.compressedSize,
          });
        } catch (singleErr) {
          console.error(`Gagal mengunggah ${file.name}:`, singleErr);
          toast.error(`Gagal mengunggah ${file.name}: ${(singleErr as Error).message}`);
        }
      }

      if (newImages.length > 0) {
        setImages((arr) => [...arr, ...newImages]);
        toast.success(`${newImages.length} gambar berhasil diunggah`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal mengunggah gambar: " + (err as Error).message);
    } finally {
      setLoading(false);
      setImageUploading(false);
      e.target.value = "";
    }
  }

  const currentSizes = form.sizes
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const totalStockCalculated = currentSizes.reduce((sum, s) => sum + (sizeStocks[s] ?? 0), 0);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1950 + 1 }, (_, i) => currentYear - i);

  const suggestions = metadataSuggestions.data ?? {
    brands: [],
    leagues: [],
    teams: [],
    countries: [],
  };

  const allBrands = suggestions.brands;
  const filteredBrands = allBrands.filter(
    (b: string) =>
      b.toLowerCase().includes(form.brand.toLowerCase()) &&
      b.toLowerCase() !== form.brand.toLowerCase(),
  );

  const allLeagues = suggestions.leagues;
  const filteredLeagues = allLeagues.filter(
    (l: string) =>
      l.toLowerCase().includes(form.league.toLowerCase()) &&
      l.toLowerCase() !== form.league.toLowerCase(),
  );

  const allTeams = suggestions.teams;
  const filteredTeams = allTeams.filter(
    (t: string) =>
      t.toLowerCase().includes(form.team.toLowerCase()) &&
      t.toLowerCase() !== form.team.toLowerCase(),
  );

  const allCountries = suggestions.countries;
  const filteredCountries = allCountries.filter(
    (c: string) =>
      c.toLowerCase().includes(form.country.toLowerCase()) &&
      c.toLowerCase() !== form.country.toLowerCase(),
  );

  async function handleGenerateDescription() {
    if (!form.name.trim()) {
      toast.error("Nama produk tidak boleh kosong!");
      return;
    }

    setIsGeneratingAI(true);
    try {
      const categoryNames = cats.data
        ? cats.data
            .filter((c) => form.category_ids.includes(c.id))
            .map((c) => c.name)
            .join(", ")
        : "";

      const badgeObj = BADGES.find((b) => b.value === form.authenticity_badge);
      const badgeLabel = badgeObj ? badgeObj.label : form.authenticity_badge;

      const result = await generateProductDescription({
        data: {
          name: form.name,
          categories: categoryNames,
          price: form.price,
          brand: form.brand,
          team: form.team,
          league: form.league,
          country: form.country,
          release_year: form.release_year,
          condition: form.condition || "",
          authenticity_badge: badgeLabel,
        },
      });

      if (result?.description) {
        set("description", result.description);
        toast.success("Deskripsi berhasil digenerasi oleh AI!");
      } else {
        toast.error("Gagal mendapatkan deskripsi dari AI.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan saat menggenerasi deskripsi: " + (err as Error).message);
    } finally {
      setIsGeneratingAI(false);
    }
  }

  async function handleAIPriceSuggest() {
    if (!form.name.trim()) {
      toast.error("Nama produk tidak boleh kosong!");
      return;
    }

    setIsSuggestingPrice(true);
    try {
      const categoryNames = cats.data
        ? cats.data
            .filter((c) => form.category_ids.includes(c.id))
            .map((c) => c.name)
            .join(", ")
        : "";

      const badgeObj = BADGES.find((b) => b.value === form.authenticity_badge);
      const badgeLabel = badgeObj ? badgeObj.label : form.authenticity_badge;

      const result = await suggestProductPrice({
        data: {
          name: form.name,
          categories: categoryNames,
          brand: form.brand,
          team: form.team,
          league: form.league,
          country: form.country,
          release_year: form.release_year,
          condition: form.condition || "",
          authenticity_badge: badgeLabel,
        },
      });

      if (result) {
        setPriceSuggestion({
          suggestedPrice: result.suggestedPrice,
          analysis: result.analysis,
        });
        setIsPriceDialogOpen(true);
      } else {
        toast.error("Gagal mendapatkan saran harga dari AI.");
      }
    } catch (err) {
      console.error(err);
      const errMessage = err instanceof Error ? err.message : String(err);
      toast.error("Gagal menganalisis harga pasaran: " + errMessage);
    } finally {
      setIsSuggestingPrice(false);
    }
  }

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, index: number) {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  }

  function handleDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    setImages((prev) => {
      const updated = [...prev];
      const [movedItem] = updated.splice(draggedIndex, 1);
      updated.splice(targetIndex, 0, movedItem);
      return updated;
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
    toast.success("Urutan gambar berhasil diperbarui");
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  function moveImage(from: number, to: number) {
    if (to < 0 || to >= images.length) return;
    setImages((prev) => {
      const updated = [...prev];
      const [movedItem] = updated.splice(from, 1);
      updated.splice(to, 0, movedItem);
      return updated;
    });
  }

  function handleDeleteImage(index: number) {
    const img = images[index];
    if (img.id) {
      setDeletedImageIds((prev) => [...prev, img.id!]);
    }
    if (img.storage_path) {
      setDeletedStoragePaths((prev) => [...prev, img.storage_path!]);
    }
    setImages((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const filteredSizeStock: Record<string, number> = {};
      currentSizes.forEach((s) => {
        filteredSizeStock[s] = sizeStocks[s] ?? 0;
      });

      const firstImage = images[0];
      const coverUrl = firstImage?.url || (firstImage?.storage_path ? supabase.storage.from("product-images").getPublicUrl(firstImage.storage_path).data.publicUrl : null);

      const payload: any = {
        slug:
          form.slug ||
          form.name
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, ""),
        name: form.name,
        cost_price: Number(form.cost_price.replace(/\D/g, "")),
        price: Number(form.price.replace(/\D/g, "")),
        stock: totalStockCalculated,
        size_stock: filteredSizeStock,
        category_ids: form.category_ids,
        category_id: form.category_ids[0] || null,
        brand: form.brand || null,
        team: form.team || null,
        league: form.league || null,
        country: form.country || null,
        release_year: form.release_year ? Number(form.release_year) : null,
        condition: form.condition || null,
        sizes: currentSizes,
        description: form.description || null,
        story: form.story || null,
        collector_score: 1,
        authenticity_badge: (form.authenticity_badge || null) as any,
        video_url: form.video_url || null,
        cover_image_url: coverUrl,
        is_active: form.is_active,
      };

      let productId = isNew ? null : id;
      let currentPayload = { ...payload };

      if (isNew) {
        let res = await supabase
          .from("products")
          .insert(currentPayload)
          .select("id")
          .single();

        // 1. Fallback retry if authenticity_badge enum rejects custom value like 'grade_ori'
        if (res.error && res.error.message.includes("authenticity_badge")) {
          console.warn("Retrying product insert without custom authenticity_badge enum...");
          currentPayload = { ...currentPayload, authenticity_badge: null };
          res = await supabase
            .from("products")
            .insert(currentPayload)
            .select("id")
            .single();
        }

        // 2. Fallback retry if cost_price column is not yet in Supabase schema cache
        if (res.error && (res.error.message.includes("cost_price") || res.error.code === "PGRST204")) {
          console.warn("Retrying product insert without cost_price...");
          const { cost_price, ...restPayload } = currentPayload;
          currentPayload = restPayload as any;
          res = await supabase
            .from("products")
            .insert(currentPayload)
            .select("id")
            .single();
        }

        if (res.error) throw res.error;
        productId = res.data!.id;
      } else {
        let res = await supabase.from("products").update(currentPayload).eq("id", id);

        // 1. Fallback retry if authenticity_badge enum rejects custom value like 'grade_ori'
        if (res.error && res.error.message.includes("authenticity_badge")) {
          console.warn("Retrying product update without custom authenticity_badge enum...");
          currentPayload = { ...currentPayload, authenticity_badge: null };
          res = await supabase.from("products").update(currentPayload).eq("id", id);
        }

        // 2. Fallback retry if cost_price column is not yet in Supabase schema cache
        if (res.error && (res.error.message.includes("cost_price") || res.error.code === "PGRST204")) {
          console.warn("Retrying product update without cost_price...");
          const { cost_price, ...restPayload } = currentPayload;
          currentPayload = restPayload as any;
          res = await supabase.from("products").update(currentPayload).eq("id", id);
        }

        if (res.error) throw res.error;
      }

      // Sync images: insert any without id
      const newOnes = images
        .filter((i) => !i.id && i.storage_path)
        .map((i, idx) => ({
          product_id: productId!,
          url: i.storage_path!,
          sort_order: idx,
        }));
      if (newOnes.length) await supabase.from("product_images").insert(newOnes);

      // Delete removed images from database
      if (deletedImageIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("product_images")
          .delete()
          .in("id", deletedImageIds);
        if (deleteError) throw deleteError;
      }

      // Delete removed files from Supabase Storage
      if (deletedStoragePaths.length > 0) {
        await supabase.storage.from("product-images").remove(deletedStoragePaths);
      }
      toast.success(isNew ? "Produk dibuat" : "Produk disimpan");
      navigate({ to: "/admin/produk" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const numCost = Number(form.cost_price.replace(/\D/g, "")) || 0;
  const numPrice = Number(form.price.replace(/\D/g, "")) || 0;
  const profitPerUnit = numPrice - numCost;
  const profitMarginPercent = numPrice > 0 ? (profitPerUnit / numPrice) * 100 : 0;
  const markupPercent = numCost > 0 ? (profitPerUnit / numCost) * 100 : 0;
  const totalEstimatedProfit = profitPerUnit * totalStockCalculated;

  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader
        eyebrow={isNew ? "Produk Baru" : "Edit Produk"}
        title={isNew ? "Tambah Jersey" : form.name || "Edit"}
      />
      <form onSubmit={submit} className="space-y-6">
        <Card>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block">Nama Produk</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Masukkan nama produk jersey..."
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Slug (otomatis jika kosong)</Label>
              <Input
                value={form.slug}
                onChange={(e) => set("slug", e.target.value)}
                placeholder="slug-produk-otomatis"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Kategori</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full flex items-center justify-between font-normal hover:bg-background border-border h-10 px-3 py-2 text-sm text-foreground bg-background rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <span className="truncate">
                      {form.category_ids.length > 0
                        ? cats.data
                            ?.filter((c) => form.category_ids.includes(c.id))
                            .map((c) => c.name)
                            .join(", ")
                        : "Pilih kategori"}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2 bg-popover border border-border rounded-md shadow-md max-h-[200px] overflow-y-auto">
                  <div className="space-y-1">
                    {cats.data?.map((c) => {
                      const checked = form.category_ids.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-muted/70 p-1.5 rounded transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              const newIds = isChecked
                                ? [...form.category_ids, c.id]
                                : form.category_ids.filter((id) => id !== c.id);
                              set("category_ids", newIds);
                            }}
                            className="rounded border-border size-4 text-primary focus:ring-primary cursor-pointer"
                          />
                          <span className="truncate">{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <div className="flex items-center justify-between h-5 mb-1.5">
                <Label>Harga Modal / HPP (Rp)</Label>
              </div>
              <Input
                type="text"
                value={form.cost_price}
                onChange={(e) => set("cost_price", formatThousand(e.target.value))}
                placeholder="Contoh: 120.000"
              />
            </div>

            <div>
              <div className="flex items-center justify-between h-5 mb-1.5">
                <Label>Harga Jual (Rp)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAIPriceSuggest}
                  disabled={isSuggestingPrice}
                  className="h-5 text-xs text-primary hover:text-primary hover:bg-primary/5 gap-1 px-1.5 font-semibold transition-all duration-200"
                >
                  {isSuggestingPrice ? (
                    <>
                      <Loader2 className="size-3 animate-spin" />
                      <span>Menganalisis...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3" />
                      <span>Saran Harga AI</span>
                    </>
                  )}
                </Button>
              </div>
              <Input
                type="text"
                required
                value={form.price}
                onChange={(e) => set("price", formatThousand(e.target.value))}
                placeholder="Contoh: 180.000"
              />
            </div>

            {/* Live Profit Analysis Box */}
            <div className="sm:col-span-2 rounded-lg border p-4 bg-muted/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Analisis Keuntungan (Estimasi)
                  </span>
                </div>
                {profitPerUnit > 0 ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Untung {profitMarginPercent.toFixed(1)}%
                  </span>
                ) : profitPerUnit < 0 ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    Rugi {Math.abs(profitMarginPercent).toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-500/10 text-muted-foreground">
                    Titik Impas (0%)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="p-2.5 rounded bg-background border border-border">
                  <div className="text-[11px] text-muted-foreground">Keuntungan / Pcs</div>
                  <div
                    className={cn(
                      "text-sm sm:text-base font-bold mt-0.5",
                      profitPerUnit > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : profitPerUnit < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-foreground",
                    )}
                  >
                    {formatIDR(profitPerUnit)}
                  </div>
                </div>

                <div className="p-2.5 rounded bg-background border border-border">
                  <div className="text-[11px] text-muted-foreground">Profit Margin</div>
                  <div
                    className={cn(
                      "text-sm sm:text-base font-bold mt-0.5",
                      profitPerUnit > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : profitPerUnit < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-foreground",
                    )}
                  >
                    {profitMarginPercent.toFixed(1)}%
                  </div>
                </div>

                <div className="p-2.5 rounded bg-background border border-border">
                  <div className="text-[11px] text-muted-foreground">Markup Modal</div>
                  <div className="text-sm sm:text-base font-bold mt-0.5 text-foreground">
                    {markupPercent.toFixed(1)}%
                  </div>
                </div>

                <div className="p-2.5 rounded bg-background border border-border">
                  <div className="text-[11px] text-muted-foreground">Potensi Total Untung</div>
                  <div
                    className={cn(
                      "text-sm sm:text-base font-bold mt-0.5",
                      totalEstimatedProfit > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : totalEstimatedProfit < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-foreground",
                    )}
                  >
                    {formatIDR(totalEstimatedProfit)}
                  </div>
                </div>
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Stok Total (Otomatis dari ukuran)</Label>
              <Input
                type="number"
                disabled
                value={totalStockCalculated}
                className="bg-muted cursor-not-allowed"
                placeholder="Total stok otomatis"
              />
            </div>

            <div className="relative">
              <Label className="mb-1.5 block">Brand</Label>
              <Input
                value={form.brand}
                onChange={(e) => set("brand", e.target.value)}
                placeholder="Ketik atau pilih brand"
                onFocus={() => setShowBrandSuggestions(true)}
                onBlur={() => setTimeout(() => setShowBrandSuggestions(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setShowBrandSuggestions(false);
                  }
                }}
              />
              {showBrandSuggestions && filteredBrands.length > 0 && (
                <ul className="absolute z-10 w-full bg-background border border-border mt-1 max-h-40 overflow-y-auto shadow-lg rounded-md divide-y divide-border">
                  {filteredBrands.map((b) => (
                    <li
                      key={b}
                      onMouseDown={() => set("brand", b)}
                      className="px-3 py-2 text-sm hover:bg-muted cursor-pointer transition-colors"
                    >
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="relative">
              <Label className="mb-1.5 block">Tim</Label>
              <Input
                value={form.team}
                onChange={(e) => set("team", e.target.value)}
                placeholder="Ketik atau pilih tim"
                onFocus={() => setShowTeamSuggestions(true)}
                onBlur={() => setTimeout(() => setShowTeamSuggestions(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setShowTeamSuggestions(false);
                  }
                }}
              />
              {showTeamSuggestions && filteredTeams.length > 0 && (
                <ul className="absolute z-10 w-full bg-background border border-border mt-1 max-h-40 overflow-y-auto shadow-lg rounded-md divide-y divide-border">
                  {filteredTeams.map((t) => (
                    <li
                      key={t}
                      onMouseDown={() => set("team", t)}
                      className="px-3 py-2 text-sm hover:bg-muted cursor-pointer transition-colors"
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="relative">
              <Label className="mb-1.5 block">Liga</Label>
              <Input
                value={form.league}
                onChange={(e) => set("league", e.target.value)}
                placeholder="Ketik atau pilih liga"
                onFocus={() => setShowLeagueSuggestions(true)}
                onBlur={() => setTimeout(() => setShowLeagueSuggestions(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setShowLeagueSuggestions(false);
                  }
                }}
              />
              {showLeagueSuggestions && filteredLeagues.length > 0 && (
                <ul className="absolute z-10 w-full bg-background border border-border mt-1 max-h-40 overflow-y-auto shadow-lg rounded-md divide-y divide-border">
                  {filteredLeagues.map((l) => (
                    <li
                      key={l}
                      onMouseDown={() => set("league", l)}
                      className="px-3 py-2 text-sm hover:bg-muted cursor-pointer transition-colors"
                    >
                      {l}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="relative">
              <Label className="mb-1.5 block">Negara</Label>
              <Input
                value={form.country}
                onChange={(e) => set("country", e.target.value)}
                placeholder="Ketik atau pilih negara"
                onFocus={() => setShowCountrySuggestions(true)}
                onBlur={() => setTimeout(() => setShowCountrySuggestions(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setShowCountrySuggestions(false);
                  }
                }}
              />
              {showCountrySuggestions && filteredCountries.length > 0 && (
                <ul className="absolute z-10 w-full bg-background border border-border mt-1 max-h-40 overflow-y-auto shadow-lg rounded-md divide-y divide-border">
                  {filteredCountries.map((c) => (
                    <li
                      key={c}
                      onMouseDown={() => set("country", c)}
                      className="px-3 py-2 text-sm hover:bg-muted cursor-pointer transition-colors"
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="relative">
              <Label className="mb-1.5 block">Tahun Rilis</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full flex items-center justify-between font-normal hover:bg-background border-border h-10 px-3 py-2 text-sm text-foreground bg-background rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <span>{form.release_year || "Pilih Tahun Rilis"}</span>
                    <CalendarIcon className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3 bg-popover border border-border rounded-md shadow-md">
                  <div className="text-sm font-semibold mb-2 text-center text-foreground">
                    Tahun Rilis
                  </div>
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                    {years.map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => set("release_year", String(y))}
                        className={cn(
                          "p-1.5 text-xs rounded transition-colors cursor-pointer text-center",
                          form.release_year === String(y)
                            ? "bg-[#1E7D32] text-white font-bold"
                            : "bg-[#F3F4F6] dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-[#1E7D32] hover:text-white",
                        )}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="mb-1.5 block">Ukuran (pisahkan koma)</Label>
              <Input
                value={form.sizes}
                onChange={(e) => set("sizes", e.target.value)}
                placeholder="Contoh: S, M, L, XL"
              />
            </div>

            <div className="sm:col-span-2 border border-border p-4 rounded-lg bg-muted/20">
              <span className="text-sm font-semibold block mb-2">
                Atur Stok per Ukuran ({currentSizes.length} Ukuran)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {currentSizes.map((s) => (
                  <div key={s} className="bg-background border border-border p-3 rounded shadow-sm">
                    <Label className="font-semibold text-xs uppercase text-muted-foreground block mb-1">
                      Stok Ukuran {s}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={sizeStocks[s] ?? 0}
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setSizeStocks((prev) => ({ ...prev, [s]: val }));
                      }}
                    />
                  </div>
                ))}
                {currentSizes.length === 0 && (
                  <p className="text-xs text-muted-foreground col-span-2 sm:col-span-4">
                    Ketik ukuran terlebih dahulu di kolom Ukuran di atas.
                  </p>
                )}
              </div>
            </div>

            <div className="relative">
              <Label className="mb-1.5 block">Kondisi</Label>
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="absolute top-0 right-0 text-xs text-primary hover:underline cursor-pointer"
                  >
                    Kelola Kondisi
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-md bg-background border border-border p-6 rounded-lg shadow-lg">
                  <DialogHeader>
                    <DialogTitle>Kelola Pilihan Kondisi</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Kondisi baru (misal: brand new)"
                        value={newConditionVal}
                        onChange={(e) => setNewConditionVal(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        disabled={addConditionMutation.isPending || !newConditionVal.trim()}
                        onClick={() => {
                          addConditionMutation.mutate(newConditionVal, {
                            onSuccess: () => setNewConditionVal(""),
                          });
                        }}
                      >
                        <Plus className="size-4 mr-1" /> Tambah
                      </Button>
                    </div>

                    <div className="border border-border rounded-md divide-y divide-border max-h-60 overflow-y-auto">
                      {conditionsQuery.data?.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between p-3 bg-card hover:bg-muted/10"
                        >
                          {editingConditionId === c.id ? (
                            <div className="flex items-center gap-2 flex-1 mr-2">
                              <Input
                                value={editingConditionVal}
                                onChange={(e) => setEditingConditionVal(e.target.value)}
                                className="h-8 flex-1 py-1 text-sm"
                                autoFocus
                                placeholder="Edit nama kondisi"
                              />
                              <Button
                                type="button"
                                size="sm"
                                className="h-8 px-2"
                                disabled={
                                  editConditionMutation.isPending || !editingConditionVal.trim()
                                }
                                onClick={() => {
                                  editConditionMutation.mutate(
                                    { id: c.id, name: editingConditionVal },
                                    {
                                      onSuccess: () => setEditingConditionId(null),
                                    },
                                  );
                                }}
                              >
                                Simpan
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 px-2"
                                onClick={() => setEditingConditionId(null)}
                              >
                                Batal
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className="text-sm font-semibold">{c.name}</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingConditionId(c.id);
                                    setEditingConditionVal(c.name);
                                  }}
                                  className="text-xs text-primary hover:underline cursor-pointer px-2 py-1"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  disabled={deleteConditionMutation.isPending}
                                  onClick={() => {
                                    setConditionToDelete({ id: c.id, name: c.name });
                                  }}
                                  className="text-xs text-destructive hover:underline cursor-pointer px-2 py-1"
                                >
                                  Hapus
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                      {conditionsQuery.data?.length === 0 && (
                        <p className="p-4 text-center text-xs text-muted-foreground">
                          Belum ada pilihan kondisi.
                        </p>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Select
                key={conditionsQuery.data?.length ?? 0}
                value={form.condition || undefined}
                onValueChange={(v) => set("condition", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Kondisi" />
                </SelectTrigger>
                <SelectContent>
                  {conditionsQuery.data?.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block">Authenticity Badge</Label>
              <Select
                value={form.authenticity_badge || undefined}
                onValueChange={(v) => set("authenticity_badge", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Authenticity Badge" />
                </SelectTrigger>
                <SelectContent>
                  {BADGES.map((b) => {
                    const Icon = b.icon;
                    return (
                      <SelectItem key={b.value} value={b.value}>
                        <span className="flex items-center gap-2">
                          <Icon className="size-4 text-primary shrink-0" />
                          <span>{b.label}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Deskripsi</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateDescription}
                  disabled={isGeneratingAI}
                  className="gap-1.5 h-8 text-xs border-primary/20 text-primary hover:bg-primary/5 hover:text-primary transition-all duration-200"
                >
                  {isGeneratingAI ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Membuat Deskripsi...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5" />
                      <span>Buat Deskripsi dengan AI</span>
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                rows={6}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Tuliskan spesifikasi jersey, tahun, detail sponsor, patch, dll."
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Story di Balik Jersey (Opsional)</Label>
              <Textarea
                rows={4}
                value={form.story}
                onChange={(e) => set("story", e.target.value)}
                placeholder="Ceritakan kisah menarik atau sejarah unik di balik jersey ini..."
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Video URL (Opsional)</Label>
              <Input
                value={form.video_url}
                onChange={(e) => set("video_url", e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>
            <div className="sm:col-span-2 flex items-center justify-between p-4 rounded-lg border border-border bg-muted/40 hover:bg-muted/60 transition-colors">
              <div className="space-y-0.5">
                <Label htmlFor="ia" className="text-base font-semibold cursor-pointer">
                  Status Keaktifan Produk
                </Label>
                <p className="text-xs text-muted-foreground">
                  Aktifkan agar produk ini langsung tampil di katalog beranda dan toko pengunjung.
                </p>
              </div>
              <Switch
                id="ia"
                checked={form.is_active}
                onCheckedChange={(val) => set("is_active", val)}
                className="scale-125 data-[state=checked]:bg-primary"
              />
            </div>
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold">Gambar Produk</Label>
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground font-medium">
                {images.length} Gambar
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tarik & lepas (drag & drop) atau gunakan panah untuk mengatur urutan. Gambar pertama otomatis menjadi <span className="font-semibold text-primary">Foto Sampul (Cover)</span>.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {images.map((img, i) => {
              const isCover = i === 0;
              const isDragging = draggedIndex === i;
              const isOver = dragOverIndex === i && draggedIndex !== i;

              return (
                <div
                  key={img.storage_path || img.id || i}
                  draggable
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, i)}
                  className={cn(
                    "group relative flex flex-col bg-muted/50 border rounded-lg overflow-hidden transition-all duration-200 select-none cursor-grab active:cursor-grabbing",
                    isCover ? "border-primary/60 shadow-sm" : "border-border",
                    isDragging && "opacity-40 scale-95 border-dashed border-primary",
                    isOver && "border-primary ring-2 ring-primary/50 scale-[1.02] shadow-md",
                  )}
                >
                  {/* Cover Badge */}
                  {isCover && (
                    <div className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
                      <Star className="size-2.5 fill-current text-amber-300" />
                      <span>Cover</span>
                    </div>
                  )}

                  {/* Drag Grip Indicator & Order Number */}
                  <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(i)}
                      title="Hapus gambar"
                      className="bg-background/90 p-1 rounded-md text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors cursor-pointer shadow-sm"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>

                  {/* Image Preview Container */}
                  <div className="relative aspect-square w-full bg-background overflow-hidden">
                    <img
                      src={img.previewUrl || img.url}
                      alt={`Foto produk ${i + 1}`}
                      className="size-full object-cover pointer-events-none transition-transform duration-300 group-hover:scale-105"
                    />

                    {/* Quick Move Left / Right Controls on Hover */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-1.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          disabled={i === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveImage(i, i - 1);
                          }}
                          title="Geser ke kiri"
                          className="p-1 rounded bg-black/60 text-white hover:bg-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        >
                          <ChevronLeft className="size-3" />
                        </button>
                        <button
                          type="button"
                          disabled={i === images.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveImage(i, i + 1);
                          }}
                          title="Geser ke kanan"
                          className="p-1 rounded bg-black/60 text-white hover:bg-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        >
                          <ChevronRight className="size-3" />
                        </button>
                      </div>

                      <span className="text-[10px] text-white/90 font-mono font-medium flex items-center gap-0.5">
                        <GripVertical className="size-2.5 opacity-70" />
                        #{i + 1}
                      </span>
                    </div>
                  </div>

                  {/* Compression Info Footer */}
                  {img.originalSize && img.compressedSize ? (
                    <div className="p-1 text-[9px] font-mono bg-background border-t border-border flex flex-col items-center justify-center">
                      <div className="truncate w-full text-center text-muted-foreground">
                        {formatBytes(img.originalSize)} → {formatBytes(img.compressedSize)}
                      </div>
                      <div className="text-green-500 font-semibold">
                        WebP (-{Math.round((1 - img.compressedSize / img.originalSize) * 100)}%)
                      </div>
                    </div>
                  ) : (
                    <div className="p-1 text-[9px] text-muted-foreground text-center font-mono bg-background border-t border-border">
                      Foto #{i + 1}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Upload Button Tile */}
            {imageUploading ? (
              <div className="aspect-square border-2 border-dashed border-border rounded-lg grid place-items-center text-xs text-muted-foreground bg-muted/30">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-[10px] text-center px-1">Mengompres...</span>
                </div>
              </div>
            ) : (
              <label className="aspect-square border-2 border-dashed border-border rounded-lg grid place-items-center text-xs text-muted-foreground cursor-pointer hover:border-primary hover:bg-muted/40 transition-colors">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="p-2 rounded-full bg-muted border border-border/80">
                    <Plus className="h-4 w-4 text-foreground" />
                  </div>
                  <span className="font-medium text-xs">Tambah Foto</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={uploadImage}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Menyimpan..." : isNew ? "Buat Produk" : "Simpan Perubahan"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/admin/produk" })}>
            Batal
          </Button>
        </div>
      </form>

      <Dialog open={isPriceDialogOpen} onOpenChange={setIsPriceDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <span>Saran Harga Jual AI</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted/50 p-4 rounded-lg text-center border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Harga Disarankan
              </p>
              <p className="text-3xl font-extrabold text-primary mt-1">
                {priceSuggestion ? `Rp ${formatThousand(priceSuggestion.suggestedPrice)}` : "Rp 0"}
              </p>
            </div>
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold">Analisis Harga Pasar:</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                {priceSuggestion?.analysis}
              </p>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setIsPriceDialogOpen(false)}>
                Batal
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (priceSuggestion) {
                    set("price", formatThousand(priceSuggestion.suggestedPrice));
                    toast.success(
                      `Harga berhasil diterapkan: Rp ${formatThousand(priceSuggestion.suggestedPrice)}`,
                    );
                  }
                  setIsPriceDialogOpen(false);
                }}
              >
                Terapkan Harga Ini
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!conditionToDelete}
        onOpenChange={(open) => !open && setConditionToDelete(null)}
      >
        <AlertDialogContent className="bg-background border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pilihan Kondisi</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus pilihan kondisi "{conditionToDelete?.name}"?
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                if (conditionToDelete) {
                  deleteConditionMutation.mutate(conditionToDelete.id);
                  setConditionToDelete(null);
                }
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}
