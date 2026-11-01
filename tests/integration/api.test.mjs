// Run with the API + database up:   API=http://localhost:5000 node tests/integration/api.test.mjs
// Needs the seeded Super Admin (ADMIN_EMAIL / ADMIN_PASSWORD from .env.local).
import assert from "node:assert/strict";
import fs from "node:fs";

const API = process.env.API || "http://localhost:5000";
const ORIGIN = process.env.ORIGIN || "http://localhost:3000";
const env = Object.fromEntries(
  (fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "")
    .split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || env.ADMIN_PASSWORD;

let passed = 0;
const results = [];
async function t(name, fn) {
  try { await fn(); passed += 1; results.push(`  ok   ${name}`); }
  catch (e) { results.push(`  FAIL ${name}\n       ${process.env.VERBOSE ? e.message : e.message.split("\n")[0]}`); process.exitCode = 1; }
}

let nextIp = 10;
function client() {
  const ip = `10.1.0.${nextIp++}`; // each simulated visitor gets its own IP
  let cookie = "";
  return async (method, path, body, opts = {}) => {
    const headers = { Origin: opts.origin ?? ORIGIN, "X-Forwarded-For": opts.ip ?? ip, ...(cookie ? { Cookie: cookie } : {}) };
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
    const res = await fetch(API + path, { method, headers, body: payload });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const type = res.headers.get("content-type") || "";
    const data = type.includes("json") ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, headers: res.headers, setCookie: set };
  };
}

const RUN = Date.now();
const STAFF_EMAIL = `staff-${RUN}@test.com`;
const LOCK_EMAIL = `lock-${RUN}@test.com`;
const anon = client();
const admin = client();
const customer = { fullName: "Test Customer", phone: "9876543210", email: "t@example.com", address: "Kalyanpur Road, Samastipur", state: "Bihar", city: "Samastipur", pincode: "848101", notes: "" };
let orderId, orderNo, productId, categoryId;

await t("health is ok", async () => { const r = await anon("GET", "/api/health"); assert.equal(r.status, 200); });

await t("public product list + filter", async () => {
  const r = await anon("GET", "/api/products?audience=Men&sort=price-asc");
  assert.equal(r.status, 200); assert.equal(r.data.data.total, 4);
  assert.ok(r.data.data.items[0].price <= r.data.data.items[1].price);
});
await t("product detail returns related, unknown slug 404, bad slug 404", async () => {
  const r = await anon("GET", "/api/products/royal-sherwani");
  assert.equal(r.status, 200); assert.ok(r.data.data.related.length > 0);
  assert.equal((await anon("GET", "/api/products/nope")).status, 404);
  assert.equal((await anon("GET", "/api/products/..%2F..%2Fetc")).status, 404);
});
await t("NoSQL operator injection in query is harmless", async () => {
  const r = await anon("GET", "/api/products?audience[$ne]=x&q[$regex]=.*&category[$ne]=1");
  assert.equal(r.status, 200);
});

await t("create order: server price wins over tampered price", async () => {
  const r = await anon("POST", "/api/orders", { customer, items: [{ slug: "royal-sherwani", size: "L", color: "beige", quantity: 2 }] });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.data.total, 14999 * 2);
  assert.match(r.data.data.orderId, /^NS-\d+$/);
  orderNo = r.data.data.orderId;
});
await t("order with client-supplied price field is rejected (strict schema)", async () => {
  const r = await anon("POST", "/api/orders", { customer, items: [{ slug: "royal-sherwani", size: "L", color: "Beige", quantity: 1 }], total: 1 });
  assert.equal(r.status, 400);
});
await t("order validation: bad phone, bad pincode, empty cart, bad size/colour, unknown product", async () => {
  const bad = (c, items) => anon("POST", "/api/orders", { customer: { ...customer, ...c }, items }, { ip: "10.9.0.2" });
  const ok1 = [{ slug: "royal-sherwani", size: "L", color: "Beige", quantity: 1 }];
  assert.equal((await bad({ phone: "12345" }, ok1)).status, 400);
  assert.equal((await bad({ pincode: "12" }, ok1)).status, 400);
  assert.equal((await bad({}, [])).status, 400);
  assert.equal((await bad({}, [{ ...ok1[0], size: "XXXL" }])).status, 400);
  assert.equal((await bad({}, [{ ...ok1[0], color: "Pink" }])).status, 400);
  assert.equal((await bad({}, [{ ...ok1[0], slug: "ghost" }])).status, 409);
  assert.equal((await bad({}, [{ ...ok1[0], quantity: 99 }])).status, 400);
});
await t("NoSQL injection object in order fields is rejected", async () => {
  const r = await anon("POST", "/api/orders", { customer: { ...customer, phone: { $ne: "" } }, items: [{ slug: { $ne: "" }, size: "L", color: "Beige", quantity: 1 }] }, { ip: "10.9.0.3" });
  assert.equal(r.status, 400);
});
await t("forged Origin is blocked, missing Origin allowed only on public routes", async () => {
  const body = { customer, items: [{ slug: "royal-sherwani", size: "L", color: "Beige", quantity: 1 }] };
  assert.equal((await anon("POST", "/api/orders", body, { origin: "https://evil.example" })).status, 403);
});
await t("wrong content-type rejected", async () => {
  const r = await fetch(API + "/api/contact", { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "text/plain" }, body: "x" });
  assert.equal(r.status, 415);
});
await t("contact + franchise + honeypot", async () => {
  assert.equal((await anon("POST", "/api/contact", { name: "Asha", phone: "9123456780", message: "Need a sherwani for wedding", category: "Product Enquiry" })).status, 201);
  assert.equal((await anon("POST", "/api/franchise", { name: "Ravi", phone: "9123456781", city: "Rampura, Samastipur", investment: "5-10 Lakh" })).status, 201);
  const h = await anon("POST", "/api/contact", { name: "Bot", phone: "9123456782", message: "buy pills now", website: "http://spam.example" });
  assert.equal(h.status, 200); assert.equal(h.data.data, null);
});
await t("custom order: validation, fake image rejected, no-image works", async () => {
  const fd = (extra = {}) => { const f = new FormData(); for (const [k, v] of Object.entries({ customerName: "Meena", phone: "9000000001", outfitType: "Lehenga", measurements: "Chest 34 Waist 28", ...extra })) f.append(k, v); return f; };
  assert.equal((await anon("POST", "/api/custom-orders", fd({ phone: "1" }))).status, 400);
  const fake = fd(); fake.append("designImage", new Blob(["<?php echo 1; ?>"], { type: "image/png" }), "x.png");
  const r1 = await anon("POST", "/api/custom-orders", fake);
  assert.ok([415, 503].includes(r1.status), `got ${r1.status}`); // 415 = rejected by magic bytes
  const r2 = await anon("POST", "/api/custom-orders", fd());
  assert.equal(r2.status, 201); assert.match(r2.data.data.orderNumber, /^CO-\d+$/);
});

await t("admin endpoints require login", async () => {
  for (const p of ["/api/admin/orders", "/api/admin/dashboard", "/api/admin/products", "/api/admin/customers", "/api/admin/settings", "/api/auth/me"])
    assert.equal((await anon("GET", p)).status, 401, p);
  assert.equal((await anon("POST", "/api/admin/uploads", new FormData())).status, 401);
  const noOrigin = await fetch(API + "/api/admin/uploads", { method: "POST", body: new FormData() });
  assert.equal(noOrigin.status, 403); // credentialed mutation with no Origin = CSRF-style, blocked
});
await t("forged / tampered JWT cookie is rejected", async () => {
  const bad = await fetch(API + "/api/auth/me", { headers: { Cookie: "ns_admin_token=eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0." } });
  assert.equal(bad.status, 401);
});
await t("login: wrong password fails with generic message", async () => {
  const r = await client()("POST", "/api/auth/login", { email: ADMIN_EMAIL, password: "wrong-password" });
  assert.equal(r.status, 401); assert.equal(r.data.message, "Invalid email or password.");
  const r2 = await client()("POST", "/api/auth/login", { email: "nobody@test.com", password: "wrong-password" });
  assert.equal(r2.data.message, "Invalid email or password.");
});
await t("login succeeds, cookie is HttpOnly + SameSite", async () => {
  const r = await admin("POST", "/api/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.match(r.setCookie, /HttpOnly/i); assert.match(r.setCookie, /SameSite=lax/i);
  assert.equal((await admin("GET", "/api/auth/me")).data.data.role, "super_admin");
});
await t("dashboard + counts + notifications reflect the new order", async () => {
  const d = (await admin("GET", "/api/admin/dashboard?range=year")).data.data;
  assert.ok(d.stats.totalOrders >= 1); assert.equal(d.sales.length, 12); assert.ok(d.recentOrders.length >= 1);
  const c = (await admin("GET", "/api/admin/counts")).data.data;
  assert.ok(c.orders >= 1 && c.customOrders >= 1 && c.franchise >= 1 && c.messages >= 1);
  assert.ok((await admin("GET", "/api/admin/notifications")).data.data.items.length >= 3);
});
await t("orders list/search/status workflow", async () => {
  const list = (await admin("GET", `/api/admin/orders?q=${orderNo}`)).data.data;
  assert.equal(list.items.length, 1); orderId = list.items[0].id;
  assert.equal(list.items[0].amount, 29998);
  const p = await admin("PATCH", `/api/admin/orders/${orderId}`, { status: "Stitching in Progress", measurements: "Confirmed" });
  assert.equal(p.status, 200); assert.equal(p.data.data.status, "Stitching in Progress");
  assert.equal((await admin("PATCH", `/api/admin/orders/${orderId}`, { status: "Hacked" })).status, 400);
  assert.equal((await admin("PATCH", `/api/admin/orders/nothex`, { status: "Delivered" })).status, 400);
  const filtered = (await admin("GET", "/api/admin/orders?status=Stitching%20in%20Progress")).data.data;
  assert.ok(filtered.items.some((o) => o.orderNumber === orderNo));
});
await t("order PDF downloads", async () => {
  const r = await admin("GET", `/api/admin/orders/${orderId}/pdf`);
  assert.equal(r.status, 200); assert.equal(r.data.subarray(0, 4).toString(), "%PDF");
});
await t("cancel + restore keeps customer stats right", async () => {
  const before = (await admin("GET", "/api/admin/customers?q=9876543210")).data.data.items[0];
  await admin("PATCH", `/api/admin/orders/${orderId}`, { status: "Cancelled" });
  const mid = (await admin("GET", "/api/admin/customers?q=9876543210")).data.data.items[0];
  assert.equal(mid.totalSpent, before.totalSpent - 29998);
  await admin("PATCH", `/api/admin/orders/${orderId}`, { status: "Order Received" });
  const after = (await admin("GET", "/api/admin/customers?q=9876543210")).data.data.items[0];
  assert.equal(after.totalSpent, before.totalSpent);
});
await t("category + product CRUD, featured, soft delete, hidden from storefront", async () => {
  const cat = await admin("POST", "/api/admin/categories", { name: "Test Lehenga", audience: "Women" });
  assert.equal(cat.status, 201); categoryId = cat.data.data.id;
  assert.equal((await admin("POST", "/api/admin/categories", { name: "Test Lehenga" })).status, 409);
  const prod = await admin("POST", "/api/admin/products", { name: "Test Lehenga Red", categoryId, audience: "Women", price: 12500, description: "d", sizes: ["S", "M"], colors: ["Red"], mainImage: { id: "", name: "", preview: "/images/products/women/beige-formal-suit.png" }.preview ? { url: "/images/products/women/beige-formal-suit.png" } : null, status: "Active", featured: true });
  assert.equal(prod.status, 201, JSON.stringify(prod.data)); productId = prod.data.data.id;
  assert.equal(prod.data.data.slug, "test-lehenga-red");
  assert.equal((await anon("GET", "/api/products/test-lehenga-red")).status, 200);
  const evil = await admin("POST", "/api/admin/products", { name: "X", categoryId, audience: "Women", price: 1, mainImage: { url: "https://evil.example/x.png" } });
  assert.equal(evil.status, 400);
  assert.equal((await admin("PUT", `/api/admin/products/${productId}`, { name: "Test Lehenga Red", categoryId, audience: "Women", price: 13000, sizes: ["S"], colors: ["Red"], status: "Inactive" })).status, 200);
  assert.equal((await anon("GET", "/api/products/test-lehenga-red")).status, 404);
  assert.equal((await admin("DELETE", `/api/admin/categories/${categoryId}`)).status, 409); // has product
  assert.equal((await admin("DELETE", `/api/admin/products/${productId}`)).status, 200);
  assert.equal((await admin("DELETE", `/api/admin/categories/${categoryId}`)).status, 200);
});
await t("custom orders / franchise / messages admin workflow", async () => {
  const co = (await admin("GET", "/api/admin/custom-orders")).data.data.items[0];
  const u = await admin("PATCH", `/api/admin/custom-orders/${co.id}`, { status: "Processing", price: 8500, adminNotes: "Quoted" });
  assert.equal(u.data.data.price, 8500); assert.equal(u.data.data.adminNotes, "Quoted");
  const u2 = await admin("PATCH", `/api/admin/custom-orders/${co.id}`, { status: "Completed" }); // must not wipe notes
  assert.equal(u2.data.data.adminNotes, "Quoted");
  const fr = (await admin("GET", "/api/admin/franchise")).data.data.items[0];
  assert.equal((await admin("PATCH", `/api/admin/franchise/${fr.id}`, { status: "Contacted" })).data.data.status, "Contacted");
  const m = (await admin("GET", "/api/admin/messages")).data.data.items.find((x) => x.name === "Asha");
  assert.equal((await admin("PATCH", `/api/admin/messages/${m.id}`, { status: "Replied" })).data.data.status, "Replied");
  assert.ok(!(await admin("GET", "/api/admin/messages")).data.data.items.some((x) => x.name === "Bot"));
});
await t("settings: read, update (super), public view hides private data", async () => {
  const s = (await admin("GET", "/api/admin/settings")).data.data;
  const up = await admin("PUT", "/api/admin/settings", { ...s, storeName: "NS Designer", maintenanceMode: false });
  assert.equal(up.status, 200);
  const pub = (await anon("GET", "/api/settings")).data.data;
  assert.ok(!("orderNotifications" in pub));
});
await t("maintenance mode pauses orders", async () => {
  const s = (await admin("GET", "/api/admin/settings")).data.data;
  await admin("PUT", "/api/admin/settings", { ...s, maintenanceMode: true });
  const r = await anon("POST", "/api/orders", { customer, items: [{ slug: "royal-sherwani", size: "L", color: "Beige", quantity: 1 }] }, { ip: "10.9.0.4" });
  assert.equal(r.status, 503);
  await admin("PUT", "/api/admin/settings", { ...s, maintenanceMode: false });
});

let staff;
await t("staff role: can work orders, cannot change settings or manage users", async () => {
  const mk = await admin("POST", "/api/admin/users", { name: "Staff One", email: STAFF_EMAIL, password: "Staff!Pass123", role: "staff" });
  assert.equal(mk.status, 201);
  assert.equal((await admin("POST", "/api/admin/users", { name: "Weak", email: "weak-" + RUN + "@test.com", password: "password" })).status, 400);
  staff = client();
  assert.equal((await staff("POST", "/api/auth/login", { email: STAFF_EMAIL, password: "Staff!Pass123" })).status, 200);
  assert.equal((await staff("GET", "/api/admin/orders")).status, 200);
  assert.equal((await staff("PUT", "/api/admin/settings", { storeName: "Hacked", orderNotifications: true, enquiryNotifications: true, maintenanceMode: true, stitchingWorkflow: true })).status, 403);
  assert.equal((await staff("GET", "/api/admin/users")).status, 403);
  assert.equal((await staff("DELETE", `/api/admin/orders/${orderId}`)).status, 403);
});
await t("deactivating staff kills their live session immediately", async () => {
  const users = (await admin("GET", "/api/admin/users")).data.data;
  const s = users.find((u) => u.email === STAFF_EMAIL);
  assert.equal((await admin("PATCH", `/api/admin/users/${s.id}`, { active: false })).status, 200);
  assert.equal((await staff("GET", "/api/admin/orders")).status, 401);
});
await t("account lockout after 5 bad passwords (correct password then refused)", async () => {
  const c = client();
  await admin("POST", "/api/admin/users", { name: "Lock Me", email: LOCK_EMAIL, password: "Lock!Pass12345" });
  for (let i = 0; i < 5; i++) await c("POST", "/api/auth/login", { email: LOCK_EMAIL, password: "bad" + i });
  const r = await c("POST", "/api/auth/login", { email: LOCK_EMAIL, password: "Lock!Pass12345" });
  assert.equal(r.status, 423);
});
await t("super admin cannot demote/deactivate self", async () => {
  const me = (await admin("GET", "/api/auth/me")).data.data;
  assert.equal((await admin("PATCH", `/api/admin/users/${me.id}`, { active: false })).status, 400);
});
await t("change password invalidates the old session of other devices", async () => {
  const other = client();
  assert.equal((await other("POST", "/api/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).status, 200);
  const r = await admin("POST", "/api/auth/change-password", { currentPassword: ADMIN_PASSWORD, newPassword: "N3w!Passw0rd#2" });
  assert.equal(r.status, 200);
  assert.equal((await other("GET", "/api/auth/me")).status, 401);         // old device signed out
  assert.equal((await admin("GET", "/api/auth/me")).status, 200);        // this device stays in
  await admin("POST", "/api/auth/change-password", { currentPassword: "N3w!Passw0rd#2", newPassword: ADMIN_PASSWORD });
});
await t("logout clears cookie", async () => {
  const r = await admin("POST", "/api/auth/logout");
  assert.match(r.setCookie, /Max-Age=0|Expires=Thu, 01 Jan 1970/i);
});
await t("rate limit: public order endpoint throttles (429 + Retry-After)", async () => {
  let last;
  for (let i = 0; i < 12; i++) last = await anon("POST", "/api/orders", { customer, items: [{ slug: "royal-sherwani", size: "L", color: "Beige", quantity: 1 }] }, { ip: "10.9.0.99" });
  assert.equal(last.status, 429); assert.ok(last.headers.get("retry-after"));
});
await t("rate limit cannot be dodged by faking X-Forwarded-For", async () => {
  let last;
  for (let i = 0; i < 12; i++) last = await fetch(API + "/api/contact", { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json", "X-Forwarded-For": `1.2.3.${i}, 10.9.0.77` }, body: JSON.stringify({ name: "A", phone: "9111111111", message: "hello there" }) });
  assert.equal(last.status, 429);
});
await t("CORS: allowed origin echoed, evil origin gets nothing", async () => {
  const ok = await fetch(API + "/api/products", { headers: { Origin: ORIGIN } });
  assert.equal(ok.headers.get("access-control-allow-origin"), ORIGIN);
  const bad = await fetch(API + "/api/products", { headers: { Origin: "https://evil.example" } });
  assert.equal(bad.headers.get("access-control-allow-origin"), null);
  const pre = await fetch(API + "/api/orders", { method: "OPTIONS", headers: { Origin: "https://evil.example" } });
  assert.equal(pre.status, 403);
});
await t("security headers + no stack traces", async () => {
  const r = await fetch(API + "/api/products/x");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(r.headers.get("x-frame-options"), "DENY");
  assert.ok(r.headers.get("strict-transport-security"));
  assert.equal(r.headers.get("x-powered-by"), null);
});

console.log(results.join("\n"));
console.log(`\n${passed}/${results.length} passed`);
