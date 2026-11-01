import Product from "@/models/Product";
import Category from "@/models/Category";
import { route, readJson } from "@/lib/route";
import { productSchema } from "@/lib/validation";
import { slugify } from "@/lib/security";
import { listDocs } from "@/lib/crud";
import { serializeAdminProduct, toStoredImage } from "@/services/product.service";
import { AppError, ok } from "@/utils/apiResponse";

export const GET = route(
  (ctx) =>
    listDocs(Product, ctx.request, {
      searchFields: ["name", "description"],
      serialize: serializeAdminProduct,
      baseFilter: { deletedAt: null },
      populate: { path: "category", select: "name slug" },
    }),
  { auth: "products" }
);

async function uniqueSlug(name) {
  const base = slugify(name) || "product";
  let slug = base;
  for (let i = 2; await Product.exists({ slug }); i += 1) slug = `${base}-${i}`;
  return slug;
}

export const POST = route(
  async ({ request }) => {
    const input = await readJson(request, productSchema);

    const category = await Category.findById(input.categoryId);
    if (!category || !category.active) throw new AppError("Please select an active category.", 400);
    if (category.audience !== "Both" && category.audience !== input.audience) {
      throw new AppError(`This category is only for ${category.audience}.`, 400);
    }

    const product = await Product.create({
      name: input.name,
      slug: await uniqueSlug(input.name),
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
      featuredAt: input.featured ? new Date() : null,
    });

    await product.populate("category", "name slug");
    return ok(serializeAdminProduct(product), 201);
  },
  { auth: "products" }
);
