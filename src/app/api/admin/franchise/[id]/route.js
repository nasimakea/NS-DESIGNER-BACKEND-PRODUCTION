import FranchiseInquiry from "@/models/FranchiseInquiry";
import { route, readJson } from "@/lib/route";
import { franchiseUpdateSchema, objectIdSchema } from "@/lib/validation";
import { serializeFranchise } from "@/services/serializers";
import { SUPER_ONLY } from "@/lib/permissions";
import { AppError } from "@/utils/apiResponse";

export const PATCH = route(
  async ({ request, params }) => {
    const item = await FranchiseInquiry.findById(objectIdSchema.parse(params.id));
    if (!item) throw new AppError("Inquiry not found.", 404);
    const input = await readJson(request, franchiseUpdateSchema);

    if (input.status) item.status = input.status;
    if (input.adminNotes !== undefined) item.adminNotes = input.adminNotes;
    await item.save();
    return serializeFranchise(item);
  },
  { auth: "franchise" }
);

export const DELETE = route(
  async ({ params }) => {
    const deleted = await FranchiseInquiry.findByIdAndDelete(objectIdSchema.parse(params.id));
    if (!deleted) throw new AppError("Inquiry not found.", 404);
    return { deleted: true };
  },
  { auth: SUPER_ONLY }
);
