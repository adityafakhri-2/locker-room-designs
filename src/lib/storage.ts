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

/** Upload a file to a bucket at a given path. Returns the storage path on success. */
export async function uploadFile(bucket: string, path: string, file: File): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) throw error;
  return path;
}
