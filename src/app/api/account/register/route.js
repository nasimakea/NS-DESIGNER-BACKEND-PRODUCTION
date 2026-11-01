import bcrypt from "bcryptjs";
import User from "@/models/User";
import { route, readJson } from "@/lib/route";
import { registerSchema } from "@/lib/validation";
import { issueOtp } from "@/services/otp.service";
import { AppError, ok } from "@/utils/apiResponse";

// Step 1 of sign-up: create (or refresh) an UNVERIFIED account and e-mail a code.
// The account cannot sign in until the e-mail code is entered.
export const POST = route(
  async ({ request }) => {
    const { name, email, phone, password } = await readJson(request, registerSchema);

    const existing = await User.findOne({ email });
    if (existing?.emailVerified) {
      throw new AppError("An account with this email already exists. Please sign in.", 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    if (existing) {
      Object.assign(existing, { name, phone, passwordHash });
      await existing.save();
    } else {
      await User.create({ name, email, phone, passwordHash });
    }

    await issueOtp({ email, name, purpose: "verify" });
    return ok({ email, otpSent: true }, 201);
  },
  { limit: { name: "register", max: 8, windowMs: 15 * 60_000 } }
);
