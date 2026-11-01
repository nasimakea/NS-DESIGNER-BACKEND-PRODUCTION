import Category from "@/models/Category";
import { route } from "@/lib/route";
import { serializeCategory } from "@/services/product.service";

export const GET = route(async ({ request }) => {
  const audience = new URL(request.url).searchParams.get("audience");
  const filter = { active: true };
  if (audience === "Men" || audience === "Women") filter.audience = { $in: [audience, "Both"] };
  const categories = await Category.find(filter).sort({ name: 1 });
  return categories.map(serializeCategory);
});
