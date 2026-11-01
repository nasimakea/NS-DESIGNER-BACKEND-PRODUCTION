import User from "@/models/User";
import { route, readJson } from "@/lib/route";
import { resendOtpSchema } from "@/lib/validation";
import { issueOtp } from "@/services/otp.service";
import { ok } from "@/utils/apiResponse";

// Always answers the same way so nobody can use it to find out which e-mails have accounts.
export const POST = route(
  async ({ request }) => {
    const { email, purpose } = await readJson(request, resendOtpSchema);
    const user = await User.findOne({ email });
    const eligible = user && user.active && (purpose === "verify" ? !user.emailVerified : user.emailVerified);
    if (eligible) {
      try {
        await issueOtp({ email, name: user.name, purpose });
      } catch (error) {
        // The cooldown message is safe to show (it only reveals timing, not account existence).
        if (error?.status === 429) throw error;
        console.error("[resend-otp] failed:", error?.message);
      }
    }
    return ok({ sent: true });
  },
  { limit: { name: "resend-otp", max: 8, windowMs: 15 * 60_000 } }
);
