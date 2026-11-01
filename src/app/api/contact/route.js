import ContactMessage from "@/models/ContactMessage";
import { route, readJson } from "@/lib/route";
import { contactSchema } from "@/lib/validation";
import { pushNotification } from "@/services/notification.service";
import { ok } from "@/utils/apiResponse";

export const POST = route(
  async ({ request }) => {
    const input = await readJson(request, contactSchema);
    const message = await ContactMessage.create(input);

    pushNotification(
      {
        type: "message",
        title: "New enquiry",
        body: `${message.name} - ${message.subject || message.category}`,
        link: "/admin/messages",
      },
      { enquiry: true }
    );

    return ok({ received: true }, 201);
  },
  { limit: { name: "contact", max: 6, windowMs: 10 * 60_000 } }
);
