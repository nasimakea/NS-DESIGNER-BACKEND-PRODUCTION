import bcrypt from "bcryptjs";
import User from "@/models/User";
import { route, readJson } from "@/lib/route";
import { userLoginSchema } from "@/lib/validation";
import { signUserToken, setUserCookie } from "@/lib/auth";
import { issueOtp } from "@/services/otp.service";
import { serializeUser } from "@/services/user.service";
import { AppError, ok } from "@/utils/apiResponse";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
let dummyHash = null;
const getDummyHash = () => (dummyHash ||= bcrypt.hashSync("ns-designer-dummy-customer", 12));

export const POST = route(
  async ({ request }) => {
    const { email, password } = await readJson(request, userLoginSchema);
    const user = await User.findOne({ email }).select("+passwordHash");

    if (user?.lockUntil && user.lockUntil > new Date()) {
      const minutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
      throw new AppError(`Too many failed attempts. Try again in ${minutes} minute(s).`, 423);
    }

    const valid = await bcrypt.compare(password, user?.passwordHash || getDummyHash());
    if (!user || !user.active || !valid) {
      if (user) {
        user.failedAttempts += 1;
        if (user.failedAttempts >= MAX_FAILED) {
          user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
          user.failedAttempts = 0;
        }
        await user.save();
      }
      throw new AppError("Invalid email or password.", 401);
    }

    // Correct password but e-mail never verified: send a fresh code and tell the page to show the code box.
    if (!user.emailVerified) {
      try {
        await issueOtp({ email, name: user.name, purpose: "verify" });
      } catch {
        /* cooldown - the earlier code is still valid */
      }
      throw new AppError("Please verify your email. We sent you a 6-digit code.", 403, { code: "EMAIL_NOT_VERIFIED", email });
    }

    user.failedAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();
    await user.save();

    return setUserCookie(ok(serializeUser(user)), signUserToken(user));
  },
  { limit: { name: "customer-login", max: 12, windowMs: 15 * 60_000 } }
);
