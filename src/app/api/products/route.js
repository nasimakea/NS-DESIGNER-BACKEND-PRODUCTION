import { route, pagination } from "@/lib/route";
import { listPublicProducts } from "@/services/product.service";

export const GET = route(async ({ request }) => {
  const { page, limit, url } = pagination(request, { limit: 48, max: 100 });
  const p = url.searchParams;
  return listPublicProducts({
    audience: p.get("audience") || "",
    category: p.get("category") || "",
    q: p.get("q") || "",
    sort: p.get("sort") || "popular",
    minPrice: p.get("minPrice") || "",
    maxPrice: p.get("maxPrice") || "",
    featured: p.get("featured") === "true",
    limit,
    page,
  });
});
