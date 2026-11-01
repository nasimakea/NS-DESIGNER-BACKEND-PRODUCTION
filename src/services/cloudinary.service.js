import { v2 as cloudinary } from "cloudinary";
import { env } from "@/lib/env";
import { detectImageType } from "@/lib/security";
import { AppError } from "@/utils/apiResponse";

let configured = false;

function configure() {
  if (configured) return;
  const { cloudName, apiKey, apiSecret } = env.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError("Image storage is not configured on the server.", 503);
  }
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  configured = true;
}

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Validates a File (from FormData) by size AND magic bytes, then uploads it.
 * Returns { publicId, url }.
 */
export async function uploadImageFile(file, { folder, maxBytes = MAX_IMAGE_BYTES } = {}) {
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
    throw new AppError("No image was uploaded.", 400);
  }
  if (file.size > maxBytes) {
    throw new AppError(`Image must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller.`, 413);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const realType = detectImageType(buffer);
  if (!realType) {
    throw new AppError("Only genuine JPG, PNG or WebP images are allowed.", 415);
  }

  configure();

  const result = await new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: `${env.cloudinary.folder}/${folder || "uploads"}`,
          resource_type: "image",
          allowed_formats: ["jpg", "jpeg", "png", "webp"],
          overwrite: false,
          unique_filename: true,
        },
        (error, uploaded) => (error ? reject(error) : resolve(uploaded))
      )
      .end(buffer);
  });

  return { publicId: result.public_id, url: result.secure_url };
}

export async function deleteImage(publicId) {
  if (!publicId) return;
  try {
    configure();
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (error) {
    console.error("[cloudinary] delete failed:", error?.message);
  }
}
