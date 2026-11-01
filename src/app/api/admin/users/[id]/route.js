import bcrypt from "bcryptjs";
import AdminUser from "@/models/AdminUser";
import { route, readJson } from "@/lib/route";
import { adminUserUpdateSchema, objectIdSchema } from "@/lib/validation";
import { SUPER_ONLY, ROLES, ROLE_PRESETS, effectivePermissions } from "@/lib/permissions";
import { AppError } from "@/utils/apiResponse";

const shape = (u) => ({
  id: String(u._id), name: u.name, email: u.email, role: u.role, active: u.active,
  permissions: effectivePermissions(u),
  lastLoginAt: u.lastLoginAt, createdAt: u.createdAt,
});

export const PATCH = route(
  async ({ request, params, user: me }) => {
    const id = objectIdSchema.parse(params.id);
    const input = await readJson(request, adminUserUpdateSchema);
    const target = await AdminUser.findById(id);
    if (!target) throw new AppError("Admin not found.", 404);

    const isSelf = String(target._id) === String(me._id);
    if (isSelf && (input.active === false || (input.role && input.role !== ROLES.SUPER))) {
      throw new AppError("You cannot deactivate or demote your own account.", 400);
    }

    if (input.name) target.name = input.name;

    if (input.role) {
      target.role = input.role;
      if (input.role === ROLES.SUPER) target.permissions = undefined; // Super Admin always has everything
      else if (!input.permissions) target.permissions = ROLE_PRESETS[input.role] || [];
    }
    if (input.permissions && target.role !== ROLES.SUPER) target.permissions = input.permissions;

    if (input.active !== undefined) {
      target.active = input.active;
      if (!input.active) target.tokenVersion += 1; // kick out active sessions
    }
    if (input.password) {
      target.passwordHash = await bcrypt.hash(input.password, 12);
      target.tokenVersion += 1;
      target.failedAttempts = 0;
      target.lockUntil = null;
    }
    await target.save();
    return shape(target);
  },
  { auth: SUPER_ONLY }
);
