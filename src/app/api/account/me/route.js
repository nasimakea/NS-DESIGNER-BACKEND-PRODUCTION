import { route } from "@/lib/route";
import { serializeUser } from "@/services/user.service";

export const GET = route(async ({ shopper }) => serializeUser(shopper), { customer: true });
