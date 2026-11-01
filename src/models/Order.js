import mongoose from "mongoose";

// The statuses the admin can choose (same list on the dashboard and the Orders page).
export const ORDER_STATUSES = [
  "Order Received",
  "Order Accepted",
  "Stitching in Progress",
  "Ready to Deliver",
  "Delivered",
  "Cancelled",
];

// Older orders may still carry these; they are shown as the closest current status.
export const LEGACY_STATUS_MAP = {
  "Measurement Confirmed": "Order Accepted",
  "Quality Check": "Stitching in Progress",
  "Ready to Ship": "Ready to Deliver",
  Shipped: "Ready to Deliver",
};
export const normalizeStatus = (status) => LEGACY_STATUS_MAP[status] || status;

// Orders that are still being worked on (used for the "pending" counters).
export const OPEN_STATUSES = ["Order Received", "Order Accepted", "Stitching in Progress", "Measurement Confirmed", "Quality Check"];

export const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Bank Transfer", "Other"];

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 1 },
  method: { type: String, enum: PAYMENT_METHODS, default: "Cash" },
  note: { type: String, default: "", maxlength: 200 },
  receivedAt: { type: Date, default: Date.now },
  recordedBy: { type: String, default: "" },
});

const historySchema = new mongoose.Schema(
  { status: String, at: { type: Date, default: Date.now }, by: { type: String, default: "" } },
  { _id: false }
);

const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    slug: { type: String, required: true },
    name: { type: String, required: true },
    image: { type: String, default: "" },
    color: { type: String, default: "" },
    size: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1, max: 10 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    // The shopper's login account that placed the order (so they can follow it).
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    customerName: { type: String, required: true },
    phone: { type: String, required: true, index: true },
    email: { type: String, default: "" },
    deliveryAddress: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
    },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    subtotal: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    notes: { type: String, default: "", maxlength: 500 },
    status: {
      type: String,
      enum: [...ORDER_STATUSES, ...Object.keys(LEGACY_STATUS_MAP)],
      default: "Order Received",
      index: true,
    },
    statusHistory: { type: [historySchema], default: [] },
    // Money actually received from the customer (recorded by an admin). Balance = total - amountReceived.
    payments: { type: [paymentSchema], default: [] },
    amountReceived: { type: Number, default: 0, min: 0 },
    measurements: { type: String, enum: ["Pending", "Confirmed"], default: "Pending" },
    adminNotes: { type: String, default: "", maxlength: 1000 },
    notification: {
      status: { type: String, enum: ["Pending", "Sent", "Failed", "Skipped"], default: "Pending" },
      attempts: { type: Number, default: 0 },
      lastError: { type: String, default: "" },
      sentAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1 });

export default mongoose.models.Order || mongoose.model("Order", orderSchema);
