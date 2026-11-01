import mongoose from "mongoose";

const imageSchema = new mongoose.Schema(
  {
    publicId: { type: String, default: "" },
    url: { type: String, required: true },
    name: { type: String, default: "" },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    audience: { type: String, enum: ["Men", "Women"], required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    price: { type: Number, required: true, min: 0, max: 10_000_000 },
    description: { type: String, default: "", maxlength: 3000 },
    fabric: { type: String, default: "", maxlength: 1000 },
    care: { type: String, default: "", maxlength: 1000 },
    mainImage: { type: imageSchema, default: null },
    galleryImages: { type: [imageSchema], default: [] },
    sizes: { type: [String], default: ["S", "M", "L", "XL"] },
    colors: { type: [String], default: [] },
    occasions: { type: [String], default: [] },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    featured: { type: Boolean, default: false },
    // When it was last featured: the newest featured product supplies its category's home-page image.
    featuredAt: { type: Date, default: null },
    // Legacy static assets (/images/...) are allowed so seeded products keep working.
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

productSchema.index({ status: 1, audience: 1, deletedAt: 1 });
productSchema.index({ name: "text", description: "text" });

export default mongoose.models.Product || mongoose.model("Product", productSchema);
