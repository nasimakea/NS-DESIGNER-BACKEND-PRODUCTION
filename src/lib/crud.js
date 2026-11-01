import { escapeRegex } from "./security";
import { pagination } from "./route";

/**
 * Generic admin list endpoint: search (?q=), status filter (?status=),
 * pagination, plus a per-status count map for the tab badges.
 */
export async function listDocs(Model, request, { searchFields = [], serialize, statusField = "status", baseFilter = {}, populate = null, sort = { createdAt: -1 } }) {
  const { page, limit, skip, url } = pagination(request, { limit: 200, max: 500 });
  const q = (url.searchParams.get("q") || "").trim().slice(0, 60);
  const status = (url.searchParams.get("status") || "").trim();

  const filter = { ...baseFilter };
  if (status && status !== "All" && statusField) filter[statusField] = status;
  if (q && searchFields.length) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = searchFields.map((field) => ({ [field]: rx }));
  }

  let query = Model.find(filter).sort(sort).skip(skip).limit(limit);
  if (populate) query = query.populate(populate);

  const [docs, total, grouped] = await Promise.all([
    query,
    Model.countDocuments(filter),
    statusField
      ? Model.aggregate([{ $match: baseFilter }, { $group: { _id: `$${statusField}`, count: { $sum: 1 } } }])
      : Promise.resolve([]),
  ]);

  const counts = { All: 0 };
  for (const row of grouped) {
    counts[row._id] = row.count;
    counts.All += row.count;
  }

  return { items: docs.map(serialize), total, page, limit, counts };
}
