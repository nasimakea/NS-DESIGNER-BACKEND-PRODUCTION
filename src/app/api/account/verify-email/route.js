import User from "@/models/User";
import { route, readJson } from "@/lib/route";
import { verifyEmailSchema } from "@/lib/validation";
import { consumeOtp } from "@/services/otp.service";
import { signUserToken, setUserCookie } from "@/lib/auth";
import { serializeUser } from "@/services/user.service";
import { AppError, ok } from "@/utils/apiResponse";

// Step 2 of sign-up: the right code verifies the e-mail and signs the shopper in.
export const POST = route(
  async ({ request }) => {
    const { email, otp } = await readJson(request, verifyEmailSchema);
    await consumeOtp({ email, purpose: "verify", code: otp });

    const user = await User.findOne({ email });
    if (!user || !user.active) throw new AppError("That code is incorrect or has expired.", 400);

    user.emailVerified = true;
    user.lastLoginAt = new Date();
    await user.save();

    return setUserCookie(ok(serializeUser(user)), signUserToken(user));
  },
  { limit: { name: "verify-email", max: 15, windowMs: 15 * 60_000 } }
);
