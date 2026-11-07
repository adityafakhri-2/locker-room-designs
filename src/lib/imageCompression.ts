/**
 * Client-side image compression and conversion to WebP format using HTML Canvas.
 */
export function compressAndConvertToWebp(
  file: File,
  quality = 0.82,
  maxDimension = 1600,
): Promise<{ blob: Blob; originalSize: number; compressedSize: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof FileReader === "undefined") {
      resolve({ blob: file, originalSize: file.size, compressedSize: file.size });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
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

/**
 * Compresses an image file and returns a ready-to-upload File object with .webp extension.
 */
export async function createWebpFile(file: File, quality = 0.82): Promise<File> {
  const result = await compressAndConvertToWebp(file, quality);
  const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
  return new File([result.blob], `${baseName}.webp`, { type: "image/webp" });
}

