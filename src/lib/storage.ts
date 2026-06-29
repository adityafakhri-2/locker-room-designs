import { supabase } from "@/integrations/supabase/client";

const urlCache = new Map<string, { url: string; exp: number }>();

/** Get a signed URL for an object in a private bucket. Cached for ~50 minutes. */
export async function signedUrl(bucket: string, path: string | null | undefined): Promise<string> {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const key = `${bucket}/${path}`;
  const now = Date.now();
  const hit = urlCache.get(key);
  if (hit && hit.exp > now) return hit.url;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (!data?.signedUrl) return "";
  urlCache.set(key, { url: data.signedUrl, exp: now + 50 * 60 * 1000 });
  return data.signedUrl;
}

/** Helper function to generate a random UUID safely in both client and server environments */
function generateRandomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Upload a file to a bucket at a given path. Returns the storage path on success. */
export async function uploadFile(bucket: string, path: string, file: File): Promise<string> {
  // 1. Validate file size (max 5 MB)
  const maxSizeBytes = 5 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error("Ukuran file melebihi batas maksimal yang diperbolehkan (5 MB).");
  }

  // 2. Validate MIME type (only JPEG, PNG, WebP allowed)
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedMimeTypes.includes(file.type)) {
    throw new Error("Format file tidak valid. Harap unggah gambar bertipe JPG, PNG, atau WebP.");
  }

  // 3. Validate and extract file extension from file name
  const extensionMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extensionMatch ? extensionMatch[1].toLowerCase() : "";
  const allowedExtensions = ["jpg", "jpeg", "png", "webp"];
  if (!allowedExtensions.includes(ext)) {
    throw new Error("Ekstensi file tidak valid. Harap gunakan format .jpg, .jpeg, .png, atau .webp.");
  }

  // 4. Sanitize and randomize path by replacing user-provided filename with UUID + sanitized extension
  const pathParts = path.split("/");
  pathParts.pop(); // Remove original filename
  const randomFileName = `${generateRandomUUID()}.${ext}`;
  const securePath = pathParts.length > 0 ? `${pathParts.join("/")}/${randomFileName}` : randomFileName;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(securePath, file, { upsert: true, cacheControl: "3600" });
  if (error) throw error;
  return securePath;
}
