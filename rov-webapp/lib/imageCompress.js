import imageCompression from "browser-image-compression";

// Compress images client-side before uploading. Phone photos are often
// 3-8MB straight out of the camera, well over the app's 1.5MB upload
// limit — this shrinks them first so people don't get a confusing
// "file too big" error for a perfectly normal photo, and it also means
// less Blob storage used per upload.
//
// Falls back to the original file if compression fails for any reason
// (unsupported format, browser quirk, etc.) — compression is a nice-to-have
// and should never block someone from uploading a photo.
export async function compressImage(file) {
  // Animated GIFs would lose their animation if run through the
  // compressor (it flattens to a static image), so skip those.
  if (file.type === "image/gif") return file;

  try {
    return await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
    });
  } catch (err) {
    console.warn("Image compression failed, using original file:", err);
    return file;
  }
}
