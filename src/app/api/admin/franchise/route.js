import FranchiseInquiry from "@/models/FranchiseInquiry";
import { route } from "@/lib/route";
import { listDocs } from "@/lib/crud";
import { serializeFranchise } from "@/services/serializers";

export const GET = route(
  (ctx) =>
    listDocs(FranchiseInquiry, ctx.request, {
      searchFields: ["name", "phone", "email", "city", "investment"],
      serialize: serializeFranchise,
    }),
  { auth: "franchise" }
);
