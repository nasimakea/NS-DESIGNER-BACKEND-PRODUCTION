import { route } from "@/lib/route";
import { getSettings } from "@/services/settings.service";

// Only what the public site needs - never admin-only fields.
export const GET = route(async () => {
  const s = await getSettings();
  return {
    storeName: s.storeName,
    storePhone: s.storePhone,
    storeEmail: s.storeEmail,
    storeAddress: s.storeAddress,
    whatsappNumber: s.whatsappNumber,
    maintenanceMode: s.maintenanceMode,
  };
});
