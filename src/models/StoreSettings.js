import mongoose from "mongoose";

export const DEFAULT_SETTINGS = {
  storeName: "NS Designer",
  storeEmail: "",
  storePhone: "",
  storeAddress: "",
  currency: "INR",
  orderNotifications: true,
  enquiryNotifications: true,
  maintenanceMode: false,
  stitchingWorkflow: true,
  whatsappNumber: "",
};

const schema = new mongoose.Schema(
  {
    key: { type: String, default: "main", unique: true },
    storeName: { type: String, default: DEFAULT_SETTINGS.storeName, maxlength: 80 },
    storeEmail: { type: String, default: "", maxlength: 120 },
    storePhone: { type: String, default: "", maxlength: 20 },
    storeAddress: { type: String, default: "", maxlength: 300 },
    currency: { type: String, default: "INR", maxlength: 5 },
    orderNotifications: { type: Boolean, default: true },
    enquiryNotifications: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    stitchingWorkflow: { type: Boolean, default: true },
    whatsappNumber: { type: String, default: "", maxlength: 15 },
  },
  { timestamps: true }
);

export default mongoose.models.StoreSettings || mongoose.model("StoreSettings", schema);
