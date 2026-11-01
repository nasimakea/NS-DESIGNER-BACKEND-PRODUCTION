/* eslint-disable no-console */
// Usage:  npm run migrate:v2
// One-time (safe to run again) upgrade for an existing database:
//   * old order statuses -> the new four-step flow
//   * every order gets payments / amountReceived (0 = nothing recorded yet) and a status history
//   * customers' "totalSpent" is recalculated from payments that admins have actually recorded
//   * featured products get a featuredAt time (used to pick the home-page category image)
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

for (const file of [".env.local", ".env"]) {
  const full = path.join(__dirname, "..", file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const MAP = {
  "Measurement Confirmed": "Order Accepted",
  "Quality Check": "Stitching in Progress",
  "Ready to Ship": "Ready to Deliver",
  Shipped: "Ready to Deliver",
};

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing.");
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const orders = db.collection("orders");

  for (const [from, to] of Object.entries(MAP)) {
    const r = await orders.updateMany({ status: from }, { $set: { status: to } });
    if (r.modifiedCount) console.log(`status "${from}" -> "${to}": ${r.modifiedCount}`);
  }

  const a = await orders.updateMany({ payments: { $exists: false } }, { $set: { payments: [], amountReceived: 0 } });
  console.log(`orders given empty payments: ${a.modifiedCount}`);

  const b = await orders.updateMany(
    { statusHistory: { $exists: false } },
    [{ $set: { statusHistory: [{ status: "$status", at: "$createdAt", by: "Migrated" }] } }]
  );
  console.log(`orders given a status history: ${b.modifiedCount}`);

  // totalSpent = money actually recorded as received (0 for old orders until an admin records payments).
  const totals = await orders
    .aggregate([{ $group: { _id: "$customer", received: { $sum: "$amountReceived" } } }])
    .toArray();
  await db.collection("customers").updateMany({}, { $set: { totalSpent: 0 } });
  for (const t of totals) await db.collection("customers").updateOne({ _id: t._id }, { $set: { totalSpent: t.received } });
  console.log(`customers recalculated: ${totals.length}`);

  const f = await db
    .collection("products")
    .updateMany({ featured: true, featuredAt: { $in: [null, undefined] } }, [{ $set: { featuredAt: "$updatedAt" } }]);
  console.log(`featured products stamped: ${f.modifiedCount}`);

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
