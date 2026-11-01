import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, unique: true, index: true },
    email: { type: String, default: "", lowercase: true, trim: true, maxlength: 120 },
    address: { type: String, default: "", maxlength: 300 },
    city: { type: String, default: "", maxlength: 60 },
    state: { type: String, default: "", maxlength: 60 },
    pincode: { type: String, default: "", maxlength: 6 },
    ordersCount: { type: Number, default: 0 },
    customOrdersCount: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    lastOrderAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.models.Customer || mongoose.model("Customer", customerSchema);
