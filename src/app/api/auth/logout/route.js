import { route } from "@/lib/route";
import { clearAuthCookie } from "@/lib/auth";
import { ok } from "@/utils/apiResponse";

export const POST = route(async () => clearAuthCookie(ok({ loggedOut: true })));
