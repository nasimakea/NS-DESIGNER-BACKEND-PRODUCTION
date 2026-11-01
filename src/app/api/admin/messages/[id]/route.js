import ContactMessage from "@/models/ContactMessage";
import { route, readJson } from "@/lib/route";
import { messageUpdateSchema, objectIdSchema } from "@/lib/validation";
import { serializeMessage } from "@/services/serializers";
import { SUPER_ONLY } from "@/lib/permissions";
import { AppError } from "@/utils/apiResponse";

export const PATCH = route(
  async ({ request, params }) => {
    const item = await ContactMessage.findById(objectIdSchema.parse(params.id));
    if (!item) throw new AppError("Message not found.", 404);
    const input = await readJson(request, messageUpdateSchema);

    if (input.status) item.status = input.status;
    if (input.adminNotes !== undefined) item.adminNotes = input.adminNotes;
    await item.save();
    return serializeMessage(item);
  },
  { auth: "messages" }
);

export const DELETE = route(
  async ({ params }) => {
    const deleted = await ContactMessage.findByIdAndDelete(objectIdSchema.parse(params.id));
    if (!deleted) throw new AppError("Message not found.", 404);
    return { deleted: true };
  },
  { auth: SUPER_ONLY }
);
