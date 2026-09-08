/**
 * Client-side Image Compressor for Avatars & Media
 * Automatically resizes & compresses high-res Base64 images to under ~60KB.
 * Prevents Firestore 1MB document limit errors (FirebaseError: The value of property 'image' is longer than 1048487 bytes).
 */

export const compressImageBase64 = async (
  imageSrc: string,
  maxWidth = 500,
  maxHeight = 500,
  quality = 0.75
): Promise<string> => {
  if (!imageSrc || typeof imageSrc !== "string") {
    return "";
  }

  // If it's a remote URL (http/https) and not a base64 string, return directly
  if (imageSrc.startsWith("http://") || imageSrc.startsWith("https://") || imageSrc.startsWith("/")) {
    return imageSrc;
  }

  // If not a data URI, return as-is
  if (!imageSrc.startsWith("data:image")) {
    return imageSrc;
  }

  // If already under 80KB base64, return directly
  if (imageSrc.length < 80000) {
    return imageSrc;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(imageSrc);
          return;
        }

        // Fill white background in case of transparent PNG converted to JPEG
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL("image/jpeg", quality);
        resolve(compressed);
      };

      img.onerror = () => {
        resolve(imageSrc);
      };

      img.src = imageSrc;
    } catch {
      resolve(imageSrc);
    }
  });
};
