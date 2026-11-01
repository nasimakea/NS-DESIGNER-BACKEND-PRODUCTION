import Product from "@/models/Product";
import Category from "@/models/Category";
import { route, readJson } from "@/lib/route";
import { productSchema, objectIdSchema } from "@/lib/validation";
import { serializeAdminProduct, toStoredImage } from "@/services/product.service";
import { AppError } from "@/utils/apiResponse";
import { z } from "zod";

const patchSchema = z.object({ featured: z.boolean().optional(), status: z.enum(["Active", "Inactive"]).optional() });

async function load(id) {
  const product = await Product.findOne({ _id: objectIdSchema.parse(id), deletedAt: null });
  if (!product) throw new AppError("Product not found.", 404);
  return product;
}

export const GET = route(
  async ({ params }) => {
    const product = await load(params.id);
    await product.populate("category", "name slug");
    return serializeAdminProduct(product);
  },
  { auth: "products" }
);

export const PUT = route(
  async ({ request, params }) => {
    const product = await load(params.id);
    const input = await readJson(request, productSchema);

    const category = await Category.findById(input.categoryId);
    if (!category || !category.active) throw new AppError("Please select an active category.", 400);
    if (category.audience !== "Both" && category.audience !== input.audience) {
      throw new AppError(`This category is only for ${category.audience}.`, 400);
    }

    const wasFeatured = product.featured;
    // The slug is kept on purpose: changing it would break links and Google rankings.
    Object.assign(product, {
      name: input.name,
      audience: input.audience,
      category: category._id,
      price: input.price,
      description: input.description,
      fabric: input.fabric,
      care: input.care,
      mainImage: toStoredImage(input.mainImage),
      galleryImages: input.galleryImages.map(toStoredImage),
      sizes: input.sizes,
      colors: input.colors,
      occasions: input.occasions,
      status: input.status,
      featured: input.featured,
    });
    if (product.featured && !wasFeatured) product.featuredAt = new Date();
    if (!product.featured) product.featuredAt = null;
    await product.save();

    await product.populate("category", "name slug");
    return serializeAdminProduct(product);
  },
  { auth: "products" }
);

export const PATCH = route(
  async ({ request, params }) => {
    const product = await load(params.id);
    const input = await readJson(request, patchSchema);
    if (input.status) product.status = input.status;
    if (input.featured !== undefined) {
      if (input.featured && !product.featured) product.featuredAt = new Date();
      if (!input.featured) product.featuredAt = null;
      product.featured = input.featured;
    }
    await product.save();

    await product.populate("category", "name slug");
    return serializeAdminProduct(product);
  },
  { auth: "products" }
);

// Soft delete: old orders keep their product snapshot and image.
export const DELETE = route(
  async ({ params }) => {
    const product = await load(params.id);
    product.deletedAt = new Date();
    product.status = "Inactive";
    product.featured = false;
    product.featuredAt = null;
    await product.save();
    return { deleted: true };
  },
  { auth: "products" }
);
