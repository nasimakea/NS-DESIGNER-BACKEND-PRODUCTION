import StoreSettings from "@/models/StoreSettings";
import { route, readJson } from "@/lib/route";
import { settingsSchema } from "@/lib/validation";
import { getSettings, serializeSettings } from "@/services/settings.service";

export const GET = route(async () => serializeSettings(await getSettings()), { auth: "settings" });

export const PUT = route(
  async ({ request }) => {
    const input = await readJson(request, settingsSchema);
    const doc = await StoreSettings.findOneAndUpdate(
      { key: "main" },
      { $set: input },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    return serializeSettings(doc);
  },
  { auth: "settings" }
);
