import StoreSettings from "@/models/StoreSettings";

export async function getSettings() {
  const doc = await StoreSettings.findOneAndUpdate(
    { key: "main" },
    { $setOnInsert: { key: "main" } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
  return doc;
}

export function serializeSettings(doc) {
  const s = doc.toObject ? doc.toObject() : doc;
  return {
    storeName: s.storeName,
    storeEmail: s.storeEmail,
    storePhone: s.storePhone,
    storeAddress: s.storeAddress,
    currency: s.currency,
    orderNotifications: s.orderNotifications,
    enquiryNotifications: s.enquiryNotifications,
    maintenanceMode: s.maintenanceMode,
    stitchingWorkflow: s.stitchingWorkflow,
    whatsappNumber: s.whatsappNumber,
  };
}
