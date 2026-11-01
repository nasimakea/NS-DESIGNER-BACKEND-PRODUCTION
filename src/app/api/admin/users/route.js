import bcrypt from "bcryptjs";
import AdminUser from "@/models/AdminUser";
import { route, readJson } from "@/lib/route";
import { adminUserCreateSchema } from "@/lib/validation";
import { SUPER_ONLY, ROLES, ROLE_PRESETS, effectivePermissions } from "@/lib/permissions";
import { AppError, ok } from "@/utils/apiResponse";

const shape = (u) => ({
  id: String(u._id), name: u.name, email: u.email, role: u.role, active: u.active,
  permissions: effectivePermissions(u),
  lastLoginAt: u.lastLoginAt, createdAt: u.createdAt,
});

export const GET = route(async () => (await AdminUser.find().sort({ createdAt: 1 })).map(shape), { auth: SUPER_ONLY });

export const POST = route(
  async ({ request }) => {
    const input = await readJson(request, adminUserCreateSchema);
    if (await AdminUser.exists({ email: input.email })) throw new AppError("An admin with this email already exists.", 409);

    const isSuper = input.role === ROLES.SUPER;
    const permissions = isSuper ? undefined : input.permissions ?? ROLE_PRESETS[input.role] ?? [];
    const user = await AdminUser.create({
      name: input.name,
      email: input.email,
      role: input.role,
      permissions,
      passwordHash: await bcrypt.hash(input.password, 12),
    });
    return ok(shape(user), 201);
  },
  { auth: SUPER_ONLY }
);
