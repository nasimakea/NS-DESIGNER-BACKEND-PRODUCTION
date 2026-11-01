import ContactMessage from "@/models/ContactMessage";
import { route } from "@/lib/route";
import { listDocs } from "@/lib/crud";
import { serializeMessage } from "@/services/serializers";

export const GET = route(
  (ctx) =>
    listDocs(ContactMessage, ctx.request, {
      searchFields: ["name", "phone", "email", "subject", "message"],
      serialize: serializeMessage,
    }),
  { auth: "messages" }
);
