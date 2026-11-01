import Category from "@/models/Category";
import Product from "@/models/Product";
import { route, readJson } from "@/lib/route";
import { categorySchema } from "@/lib/validation";
import { slugify } from "@/lib/security";
import { serializeCategory } from "@/services/product.service";
import { AppError, ok } from "@/utils/apiResponse";

export const GET = route(
  async () => {
    const [categories, counts] = await Promise.all([
      Category.find().sort({ name: 1 }),
      Product.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: "$category", count: { $sum: 1 } } }]),
    ]);
    const map = new Map(counts.map((c) => [String(c._id), c.count]));
    return categories.map((c) => ({ ...serializeCategory(c), productCount: map.get(String(c._id)) || 0 }));
  },
  { auth: "products" }
);

export const POST = route(
  async ({ request }) => {
    const input = await readJson(request, categorySchema);
    const slug = slugify(input.name);
    if (await Category.exists({ slug })) throw new AppError("This category already exists.", 409);
    const category = await Category.create({ ...input, slug });
    return ok(serializeCategory(category), 201);
  },
  { auth: "products" }
);
