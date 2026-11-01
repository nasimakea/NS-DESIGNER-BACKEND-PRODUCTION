import Product from "@/models/Product";
import { route } from "@/lib/route";

// Home page "Shop by Category": ONE feature image per category (per audience).
// The image is the most recently featured product in that category; if nothing is
// featured yet it falls back to the newest product so a category is never blank.
export const GET = route(async () => {
  const products = await Product.find({ status: "Active", deletedAt: null })
    .populate({ path: "category", select: "name slug active", match: { active: true } })
    .select("audience category mainImage featured featuredAt updatedAt createdAt")
    .sort({ featured: -1, featuredAt: -1, updatedAt: -1 })
    .limit(1000)
    .lean();

  const groups = new Map();
  for (const p of products) {
    if (!p.category || !p.mainImage?.url) continue;
    const key = `${p.audience}:${p.category._id}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, {
        key,
        name: p.category.name,
        slug: p.category.slug,
        audience: p.audience,
        image: p.mainImage.url,
        featured: Boolean(p.featured),
        productCount: 1,
      });
    } else {
      group.productCount += 1; // products were sorted featured-first, so the first one keeps the image
    }
  }

  return [...groups.values()].sort(
    (a, b) => Number(b.featured) - Number(a.featured) || a.audience.localeCompare(b.audience) || a.name.localeCompare(b.name)
  );
});
