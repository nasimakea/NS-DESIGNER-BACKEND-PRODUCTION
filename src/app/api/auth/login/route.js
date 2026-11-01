import bcrypt from "bcryptjs";
import AdminUser from "@/models/AdminUser";
import { route, readJson } from "@/lib/route";
import { loginSchema } from "@/lib/validation";
import { signAdminToken, setAuthCookie } from "@/lib/auth";
import { effectivePermissions } from "@/lib/permissions";
import { AppError, ok } from "@/utils/apiResponse";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
// Used to keep response time similar when the e-mail does not exist.
let dummyHash = null;
const getDummyHash = () => (dummyHash ||= bcrypt.hashSync("ns-designer-dummy-password", 12));

export const POST = route(
  async ({ request }) => {
    const { email, password } = await readJson(request, loginSchema);

    const user = await AdminUser.findOne({ email }).select("+passwordHash");

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

    user.failedAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();
    await user.save();

    const response = ok({ id: String(user._id), name: user.name, email: user.email, role: user.role, permissions: effectivePermissions(user) });
    return setAuthCookie(response, signAdminToken(user));
  },
  { limit: { name: "login", max: 10, windowMs: 15 * 60_000 } }
);
