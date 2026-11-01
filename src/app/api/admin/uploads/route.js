import { route } from "@/lib/route";
import { uploadImageFile } from "@/services/cloudinary.service";
import { AppError, ok } from "@/utils/apiResponse";

// Keep one request under the website proxy's 25 MB body limit (5 x 5 MB).
const MAX_FILES = 5;
const MAX_PRODUCT_IMAGE = 5 * 1024 * 1024;

// Admin-only product image upload. Returns [{ id, name, preview }] - the shape the
// admin product form already uses (id = Cloudinary public id, preview = image URL).
export const POST = route(
  async ({ request }) => {
    if (!(request.headers.get("content-type") || "").includes("multipart/form-data")) {
      throw new AppError("Content-Type must be multipart/form-data.", 415);
    }
    const form = await request.formData();
    const files = form.getAll("files").filter((f) => f && typeof f !== "string" && f.size > 0);
    if (!files.length) throw new AppError("No images received.", 400);
    if (files.length > MAX_FILES) throw new AppError(`Upload at most ${MAX_FILES} images at once.`, 400);

    const uploaded = [];
    for (const file of files) {
      const { publicId, url } = await uploadImageFile(file, { folder: "products", maxBytes: MAX_PRODUCT_IMAGE });
      uploaded.push({ id: publicId, name: file.name || "", preview: url });
    }
    return ok(uploaded, 201);
  },
  { auth: "products", limit: { name: "uploads", max: 60, windowMs: 60_000 } }
);
