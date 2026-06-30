import { describe, it, expect, vi, beforeEach } from "vitest";
import { signedUrl, uploadFile } from "./storage";
import { supabase } from "@/integrations/supabase/client";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => {
  const mockUpload = vi.fn();
  const mockCreateSignedUrl = vi.fn();

  return {
    supabase: {
      storage: {
        from: vi.fn().mockImplementation(() => ({
          upload: mockUpload,
          createSignedUrl: mockCreateSignedUrl,
        })),
      },
    },
  };
});

describe("signedUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty string if path is empty", async () => {
    const url = await signedUrl("my-bucket", "");
    expect(url).toBe("");
  });

  it("returns original path if path starts with http", async () => {
    const originalUrl = "http://example.com/image.jpg";
    const url = await signedUrl("my-bucket", originalUrl);
    expect(url).toBe(originalUrl);
  });

  it("calls supabase.storage.from and createSignedUrl on cache miss", async () => {
    const mockFrom = supabase.storage.from as any;
    const mockCreateSignedUrl = mockFrom().createSignedUrl;
    
    mockCreateSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: "https://supabase.com/signed-url" },
      error: null,
    });

    const url = await signedUrl("test-bucket", "test-image.jpg");
    expect(url).toBe("https://supabase.com/signed-url");
    expect(mockFrom).toHaveBeenCalledWith("test-bucket");
    expect(mockCreateSignedUrl).toHaveBeenCalledWith("test-image.jpg", 3600);
  });

  it("uses cache for subsequent calls within the expiry window", async () => {
    const mockFrom = supabase.storage.from as any;
    const mockCreateSignedUrl = mockFrom().createSignedUrl;
    
    mockCreateSignedUrl.mockResolvedValueOnce({
      data: { signedUrl: "https://supabase.com/signed-url-cached" },
      error: null,
    });

    // First call (cache miss)
    const url1 = await signedUrl("test-bucket", "cached-image.jpg");
    expect(url1).toBe("https://supabase.com/signed-url-cached");

    // Second call (should hit cache, no createSignedUrl call)
    const url2 = await signedUrl("test-bucket", "cached-image.jpg");
    expect(url2).toBe("https://supabase.com/signed-url-cached");
    
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1);
  });
});

describe("uploadFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws error if file size exceeds 5MB", async () => {
    const file = {
      size: 6 * 1024 * 1024, // 6 MB
      type: "image/jpeg",
      name: "large-image.jpg",
    } as File;

    await expect(uploadFile("bucket", "path/file.jpg", file)).rejects.toThrow(
      "Ukuran file melebihi batas maksimal yang diperbolehkan (5 MB)."
    );
  });

  it("throws error if MIME type is invalid", async () => {
    const file = {
      size: 1 * 1024 * 1024,
      type: "application/pdf",
      name: "doc.pdf",
    } as File;

    await expect(uploadFile("bucket", "path/doc.pdf", file)).rejects.toThrow(
      "Format file tidak valid. Harap unggah gambar bertipe JPG, PNG, atau WebP."
    );
  });

  it("throws error if file extension is invalid", async () => {
    const file = {
      size: 1 * 1024 * 1024,
      type: "image/jpeg",
      name: "image.txt",
    } as File;

    await expect(uploadFile("bucket", "path/image.txt", file)).rejects.toThrow(
      "Ekstensi file tidak valid. Harap gunakan format .jpg, .jpeg, .png, atau .webp."
    );
  });

  it("uploads successfully with randomized secure path filename", async () => {
    const mockFrom = supabase.storage.from as any;
    const mockUpload = mockFrom().upload;

    mockUpload.mockResolvedValueOnce({ error: null });

    const file = {
      size: 2 * 1024 * 1024, // 2MB
      type: "image/png",
      name: "my-photo.png",
    } as File;

    const resultPath = await uploadFile("photos", "user-123/original.png", file);

    // Checks that the path format is user-123/<uuid>.png
    expect(resultPath).toMatch(/^user-123\/[a-f0-9-]+\.png$/);
    expect(mockFrom).toHaveBeenCalledWith("photos");
    expect(mockUpload).toHaveBeenCalledWith(resultPath, file, {
      upsert: true,
      cacheControl: "3600",
    });
  });

  it("throws supabase error if upload fails", async () => {
    const mockFrom = supabase.storage.from as any;
    const mockUpload = mockFrom().upload;

    mockUpload.mockResolvedValueOnce({ error: new Error("Supabase error message") });

    const file = {
      size: 1 * 1024 * 1024,
      type: "image/webp",
      name: "photo.webp",
    } as File;

    await expect(uploadFile("photos", "user-123/photo.webp", file)).rejects.toThrow(
      "Supabase error message"
    );
  });
});
