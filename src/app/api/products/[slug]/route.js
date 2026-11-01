import Product from "@/models/Product";
import { route } from "@/lib/route";
import { AppError } from "@/utils/apiResponse";
import { serializePublicProduct } from "@/services/product.service";

export const GET = route(async ({ params }) => {
  const slug = String(params.slug || "").toLowerCase();
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) throw new AppError("Product not found.", 404);

  const product = await Product.findOne({ slug, status: "Active", deletedAt: null }).populate("category", "name slug");
  if (!product) throw new AppError("Product not found.", 404);

  const related = await Product.find({
    _id: { $ne: product._id },
    audience: product.audience,
    status: "Active",
    deletedAt: null,
  })
    .populate("category", "name slug")
    .sort({ featured: -1, createdAt: -1 })
    .limit(4);

  return { product: serializePublicProduct(product), related: related.map(serializePublicProduct) };
});
