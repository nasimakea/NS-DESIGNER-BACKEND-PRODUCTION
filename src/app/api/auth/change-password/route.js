import bcrypt from "bcryptjs";
import AdminUser from "@/models/AdminUser";
import { route, readJson } from "@/lib/route";
import { changePasswordSchema } from "@/lib/validation";
import { signAdminToken, setAuthCookie } from "@/lib/auth";
import { AppError, ok } from "@/utils/apiResponse";

export const POST = route(
  async ({ request, user }) => {
    const { currentPassword, newPassword } = await readJson(request, changePasswordSchema);

    const full = await AdminUser.findById(user._id).select("+passwordHash");
    if (!(await bcrypt.compare(currentPassword, full.passwordHash))) {
      throw new AppError("Current password is incorrect.", 400);
    }
    if (currentPassword === newPassword) {
      throw new AppError("New password must be different from the current one.", 400);
    }

    full.passwordHash = await bcrypt.hash(newPassword, 12);
    full.tokenVersion += 1; // signs out every other session
    await full.save();

    return setAuthCookie(ok({ changed: true }), signAdminToken(full));
  },
  { auth: true, limit: { name: "change-password", max: 6, windowMs: 15 * 60_000 } }
);
