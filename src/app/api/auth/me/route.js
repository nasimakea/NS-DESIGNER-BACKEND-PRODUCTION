import { route } from "@/lib/route";
import { effectivePermissions } from "@/lib/permissions";

export const GET = route(
  async ({ user }) => ({ id: String(user._id), name: user.name, email: user.email, role: user.role, permissions: effectivePermissions(user) }),
  { auth: true }
);
