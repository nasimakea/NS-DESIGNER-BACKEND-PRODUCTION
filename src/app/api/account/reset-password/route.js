import bcrypt from "bcryptjs";
import User from "@/models/User";
import { route, readJson } from "@/lib/route";
import { resetPasswordSchema } from "@/lib/validation";
import { consumeOtp } from "@/services/otp.service";
import { AppError, ok } from "@/utils/apiResponse";

export const POST = route(
  async ({ request }) => {
    const { email, otp, newPassword } = await readJson(request, resetPasswordSchema);
    await consumeOtp({ email, purpose: "reset", code: otp });

    const user = await User.findOne({ email });
    if (!user || !user.active) throw new AppError("That code is incorrect or has expired.", 400);

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.tokenVersion += 1; // signs the account out everywhere
    user.failedAttempts = 0;
    user.lockUntil = null;
    user.emailVerified = true; // they just proved they own the mailbox
    await user.save();

    return ok({ reset: true });
  },
  { limit: { name: "reset-password", max: 10, windowMs: 15 * 60_000 } }
);
