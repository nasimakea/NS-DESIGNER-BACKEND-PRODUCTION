import Category from "@/models/Category";
import Product from "@/models/Product";
import { route, readJson } from "@/lib/route";
import { categorySchema, objectIdSchema } from "@/lib/validation";
import { serializeCategory } from "@/services/product.service";
import { AppError } from "@/utils/apiResponse";

export const PUT = route(
  async ({ request, params }) => {
    const id = objectIdSchema.parse(params.id);
    const input = await readJson(request, categorySchema);
    // Slug is intentionally NOT changed so product URLs / filters keep working.
    const category = await Category.findByIdAndUpdate(id, { $set: input }, { returnDocument: "after", runValidators: true });
    if (!category) throw new AppError("Category not found.", 404);
    return serializeCategory(category);
  },
  { auth: "products" }
);

export const DELETE = route(
  async ({ params }) => {
    const id = objectIdSchema.parse(params.id);
    if (await Product.exists({ category: id, deletedAt: null })) {
      throw new AppError("Delete or reassign this category's products first.", 409);
    }
    const deleted = await Category.findByIdAndDelete(id);
    if (!deleted) throw new AppError("Category not found.", 404);
    return { deleted: true };
  },
  { auth: "products" }
);
