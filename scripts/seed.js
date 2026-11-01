/* eslint-disable no-console */
// Usage:  npm run seed
// Creates indexes, the first Super Admin, default settings, categories and the
// starter catalogue (the same products the storefront used to hard-code).
// Safe to run again: existing records are left untouched.

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Minimal .env loader (so the script works without extra packages).
for (const file of [".env.local", ".env"]) {
  const full = path.join(__dirname, "..", file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

const { MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = "Super Admin" } = process.env;

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const CATEGORIES = [
  { name: "Sherwani", audience: "Men" },
  { name: "Suits", audience: "Men" },
  { name: "Indo Western", audience: "Both" },
  { name: "Blazers", audience: "Women" },
  { name: "Formal Wear", audience: "Women" },
  { name: "Kurta Set", audience: "Men" },
  { name: "Sarees", audience: "Women" },
];

const img = (file) => ({ publicId: "", url: file, name: "" });
const PRODUCTS = [
  { slug: "royal-sherwani", name: "Beige Royal Sherwani with Embroidery", audience: "Men", category: "Sherwani", price: 14999, image: "/images/products/men/beige-royal-sherwani.png", colors: ["Beige", "Maroon", "Black", "White"], occasions: ["Wedding", "Engagement", "Festive"], featured: true,
    description: "Elegant sherwani with premium embroidery, perfect for weddings and special occasions." },
  { slug: "bandhgala-suit", name: "Blue Bandhgala Suit", audience: "Men", category: "Suits", price: 8999, image: "/images/products/men/blue-bandhgala-suit.png", colors: ["Blue", "Black", "Maroon", "White"], occasions: ["Wedding", "Party"], featured: true,
    description: "A sophisticated bandhgala suit for weddings and special occasions." },
  { slug: "designer-suit", name: "Black Designer Suit", audience: "Men", category: "Suits", price: 9999, image: "/images/products/men/black-designer-suit.png", colors: ["Black", "Maroon", "Blue", "White"], occasions: ["Party", "Festive"],
    description: "A designer suit with elegant detailing for parties and celebrations." },
  { slug: "indo-western-outfit", name: "Printed Indo Western", audience: "Men", category: "Indo Western", price: 10999, image: "/images/products/men/printed-indo-western.png", colors: ["Beige", "Maroon", "Black", "Blue"], occasions: ["Wedding", "Engagement", "Party"],
    description: "A contemporary Indo-Western outfit for weddings and celebrations." },
  { slug: "black-formal-blazer-set", name: "Black Formal Blazer Set", audience: "Women", category: "Blazers", price: 4999, image: "/images/products/women/black-formal-blazer-set.png", colors: ["Black", "Beige", "Navy Blue", "White"], occasions: ["Office Wear", "Business Meeting", "Interview"], featured: true,
    description: "An elegant formal blazer set suitable for office wear, interviews and business meetings." },
  { slug: "beige-formal-suit", name: "Beige Formal Suit", audience: "Women", category: "Formal Wear", price: 5999, image: "/images/products/women/beige-formal-suit.png", colors: ["Beige", "Black", "Navy Blue", "White"], occasions: ["Office Wear", "Formal Event"],
    description: "A refined beige formal suit designed for office wear, business meetings and formal occasions." },
  { slug: "navy-blue-formal-suit", name: "Navy Blue Formal Suit", audience: "Women", category: "Formal Wear", price: 5499, image: "/images/products/women/navy-blue-formal-suit.png", colors: ["Navy Blue", "Black", "Beige", "White"], occasions: ["Office Wear", "Interview"],
    description: "A polished navy blue formal suit for office wear, interviews and professional occasions." },
  { slug: "white-formal-shirt", name: "White Formal Shirt", audience: "Women", category: "Formal Wear", price: 1999, image: "/images/products/women/white-formal-shirt.png", colors: ["White", "Black", "Beige", "Navy Blue"], occasions: ["Office Wear", "Work From Home"],
    description: "A versatile white formal shirt for office wear, interviews and everyday professional styling." },
];

const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

async function main() {
  if (!MONGODB_URI) throw new Error("MONGODB_URI is missing. Copy .env.example to .env first.");
  await mongoose.connect(MONGODB_URI);

  // Register models through the same definitions the app uses (compiled inline).
  const S = mongoose.Schema;
  const define = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);

  const AdminUser = define("AdminUser", new S({ name: String, email: { type: String, unique: true, lowercase: true }, passwordHash: String, role: String, active: { type: Boolean, default: true }, failedAttempts: { type: Number, default: 0 }, lockUntil: Date, tokenVersion: { type: Number, default: 0 }, lastLoginAt: Date }, { timestamps: true }));
  const Category = define("Category", new S({ name: String, slug: { type: String, unique: true }, audience: String, active: { type: Boolean, default: true } }, { timestamps: true }));
  const Product = define("Product", new S({ name: String, slug: { type: String, unique: true }, audience: String, category: S.Types.ObjectId, price: Number, description: String, fabric: { type: String, default: "" }, care: { type: String, default: "" }, mainImage: Object, galleryImages: { type: Array, default: [] }, sizes: [String], colors: [String], occasions: [String], status: { type: String, default: "Active" }, featured: { type: Boolean, default: false }, deletedAt: { type: Date, default: null } }, { timestamps: true }));
  const Settings = define("StoreSettings", new S({ key: { type: String, unique: true }, storeName: String, storeEmail: String, storePhone: String, storeAddress: String, currency: String, orderNotifications: Boolean, enquiryNotifications: Boolean, maintenanceMode: Boolean, stitchingWorkflow: Boolean, whatsappNumber: String }, { timestamps: true }));

  // 1) Super Admin
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.warn("! ADMIN_EMAIL / ADMIN_PASSWORD not set - skipping admin creation.");
  } else {
    const strong = ADMIN_PASSWORD.length >= 10 && /[a-z]/.test(ADMIN_PASSWORD) && /[A-Z]/.test(ADMIN_PASSWORD) && /\d/.test(ADMIN_PASSWORD) && /[^A-Za-z0-9]/.test(ADMIN_PASSWORD);
    if (!strong) throw new Error("ADMIN_PASSWORD must be 10+ chars with upper, lower, number and symbol.");
    const email = ADMIN_EMAIL.toLowerCase();
    if (await AdminUser.exists({ email })) {
      console.log(`= Admin ${email} already exists`);
    } else {
      await AdminUser.create({ name: ADMIN_NAME, email, role: "super_admin", passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12) });
      console.log(`+ Created Super Admin ${email}`);
    }
  }

  // 2) Settings
  await Settings.updateOne({ key: "main" }, { $setOnInsert: { key: "main", storeName: "NS Designer", storeEmail: "nsdesigner@gmail.com", storePhone: "7903381728", storeAddress: "Samastipur, Bihar, India", currency: "INR", orderNotifications: true, enquiryNotifications: true, maintenanceMode: false, stitchingWorkflow: true, whatsappNumber: "917903381728" } }, { upsert: true });

  // 3) Categories
  const catIds = {};
  for (const c of CATEGORIES) {
    const slug = slugify(c.name);
    const doc = await Category.findOneAndUpdate({ slug }, { $setOnInsert: { name: c.name, slug, audience: c.audience, active: true } }, { upsert: true, returnDocument: "after" });
    catIds[c.name] = doc._id;
  }
  console.log(`+ ${CATEGORIES.length} categories ready`);

  // 4) Products
  let created = 0;
  for (const p of PRODUCTS) {
    const res = await Product.updateOne({ slug: p.slug }, { $setOnInsert: { name: p.name, slug: p.slug, audience: p.audience, category: catIds[p.category], price: p.price, description: p.description, mainImage: img(p.image), galleryImages: [], sizes: SIZES, colors: p.colors, occasions: p.occasions || [], status: "Active", featured: Boolean(p.featured), deletedAt: null } }, { upsert: true });
    if (res.upsertedCount) created += 1;
  }
  console.log(`+ ${created} new products (${PRODUCTS.length - created} already existed)`);

  // 5) Make sure unique indexes exist
  await Promise.all([AdminUser.syncIndexes(), Category.syncIndexes(), Product.syncIndexes(), Settings.syncIndexes()]);
  console.log("Done.");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Seed failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
