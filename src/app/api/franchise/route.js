import FranchiseInquiry from "@/models/FranchiseInquiry";
import { route, readJson } from "@/lib/route";
import { franchiseSchema } from "@/lib/validation";
import { pushNotification } from "@/services/notification.service";
import { ok } from "@/utils/apiResponse";

export const POST = route(
  async ({ request }) => {
    const input = await readJson(request, franchiseSchema);
    const inquiry = await FranchiseInquiry.create(input);

    pushNotification(
      {
        type: "franchise",
        title: "New franchise inquiry",
        body: `${inquiry.name} - ${inquiry.city}`,
        link: "/admin/franchise",
      },
      { enquiry: true }
    );

    return ok({ received: true }, 201);
  },
  { limit: { name: "franchise", max: 5, windowMs: 10 * 60_000 } }
);
