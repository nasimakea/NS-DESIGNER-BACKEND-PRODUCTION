import Product from "@/models/Product";
import Category from "@/models/Category";
import { escapeRegex } from "@/lib/security";

const img = (i) => (i ? { id: i.publicId || i.url, name: i.name || "", preview: i.url } : null);

/** Shape used by the public storefront. */
export function serializePublicProduct(p) {
  const o = p.toObject ? p.toObject() : p;
  const category = o.category && o.category._id ? o.category : null;
  return {
    id: String(o._id),
    slug: o.slug,
    name: o.name,
    audience: o.audience,
    category: category ? { id: String(category._id), name: category.name, slug: category.slug } : null,
    price: o.price,
    description: o.description,
    fabric: o.fabric,
    care: o.care,
    image: o.mainImage?.url || "/images/placeholder.png",
    images: [o.mainImage?.url, ...(o.galleryImages || []).map((g) => g.url)].filter(Boolean).length
      ? [o.mainImage?.url, ...(o.galleryImages || []).map((g) => g.url)].filter(Boolean)
      : ["/images/placeholder.png"],
    sizes: o.sizes,
    colors: o.colors,
    occasions: o.occasions,
    featured: o.featured,
    updatedAt: o.updatedAt,
  };
}

/** Shape used by the admin products screen (matches the existing UI). */
export function serializeAdminProduct(p) {
  const o = p.toObject ? p.toObject() : p;
  const category = o.category && o.category._id ? o.category : null;
  return {
    id: String(o._id),
    slug: o.slug,
    name: o.name,
    categoryId: String(category ? category._id : o.category),
    categoryName: category?.name || "",
    audience: o.audience,
    price: o.price,
    description: o.description,
    fabric: o.fabric,
    care: o.care,
    mainImage: img(o.mainImage),
    galleryImages: (o.galleryImages || []).map(img),
    sizes: o.sizes,
    colors: o.colors,
    occasions: o.occasions,
    status: o.status,
    featured: o.featured,
    createdAt: o.createdAt,
  };
}

export function serializeCategory(c) {
  const o = c.toObject ? c.toObject() : c;
  return { id: String(o._id), name: o.name, slug: o.slug, audience: o.audience, active: o.active };
}

/** Converts the admin UI image shape back to the stored shape. */
export function toStoredImage(image) {
  if (!image) return null;
  return { publicId: image.publicId ?? image.id ?? "", url: image.url ?? image.preview, name: image.name || "" };
}

export async function listPublicProducts({ audience, category, q, sort, minPrice, maxPrice, featured, limit = 48, page = 1 }) {
  const filter = { status: "Active", deletedAt: null };
  if (audience === "Men" || audience === "Women") filter.audience = audience;
  if (featured) filter.featured = true;

  if (category) {
    const cats = await Category.find({ slug: { $in: String(category).split(",").slice(0, 10) }, active: true }).select("_id");
    filter.category = { $in: cats.map((c) => c._id) };
  }
  if (q) {
    const rx = new RegExp(escapeRegex(String(q).slice(0, 60)), "i");
    filter.$or = [{ name: rx }, { description: rx }];
  }
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  const sortMap = {
    "price-asc": { price: 1 },
    "price-desc": { price: -1 },
    newest: { createdAt: -1 },
    popular: { featured: -1, createdAt: -1 },
  };

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug")
      .sort(sortMap[sort] || sortMap.popular)
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  return { items: items.map(serializePublicProduct), total, page, limit };
}
