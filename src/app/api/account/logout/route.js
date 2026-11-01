import { route } from "@/lib/route";
import { clearUserCookie } from "@/lib/auth";
import { ok } from "@/utils/apiResponse";

export const POST = route(async () => clearUserCookie(ok({ loggedOut: true })));
