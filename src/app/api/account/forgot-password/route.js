import User from "@/models/User";
import { route, readJson } from "@/lib/route";
import { forgotPasswordSchema } from "@/lib/validation";
import { issueOtp } from "@/services/otp.service";
import { ok } from "@/utils/apiResponse";

// Same answer whether or not the e-mail has an account (prevents account discovery).
export const POST = route(
  async ({ request }) => {
    const { email } = await readJson(request, forgotPasswordSchema);
    const user = await User.findOne({ email });
    if (user && user.active) {
      try {
        await issueOtp({ email, name: user.name, purpose: "reset" });
      } catch (error) {
        console.error("[forgot-password] could not send code:", error?.message);
      }
    }
    return ok({ sent: true });
  },
  { limit: { name: "forgot-password", max: 6, windowMs: 15 * 60_000 } }
);
