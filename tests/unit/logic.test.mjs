import assert from "node:assert/strict";
import test from "node:test";

process.env.JWT_SECRET = "a".repeat(48);
process.env.NODE_ENV = "test";

const perms = await import("@/lib/permissions");
const otp = await import("@/services/otp.service");
const orders = await import("@/services/order.service");
const val = await import("@/lib/validation");
const orderModel = await import("@/models/Order");

test("super admin has every permission; staff preset is limited", () => {
  assert.deepEqual(perms.effectivePermissions({ role: "super_admin" }).sort(), perms.PERMISSION_KEYS.slice().sort());
  const staff = perms.effectivePermissions({ role: "staff" }); // legacy account without a stored list
  assert.ok(staff.includes("orders") && !staff.includes("settings") && !staff.includes("payments"));
  assert.deepEqual(perms.effectivePermissions({ role: "custom", permissions: ["orders", "bogus"] }), ["orders"]);
  assert.equal(perms.hasPermission({ role: "custom", permissions: [] }, "orders"), false);
});

test("otp: 6 digits, keyed hash differs per email/purpose", () => {
  for (let i = 0; i < 50; i++) assert.match(otp.generateCode(), /^\d{6}$/);
  const a = otp.hashOtp("a@x.com", "verify", "123456");
  assert.notEqual(a, otp.hashOtp("b@x.com", "verify", "123456"));
  assert.notEqual(a, otp.hashOtp("a@x.com", "reset", "123456"));
  assert.equal(a, otp.hashOtp("a@x.com", "verify", "123456"));
});

test("money: received only counts recorded payments; balance never negative", () => {
  assert.deepEqual(orders.moneyOf({ total: 10000, amountReceived: 0 }), { total: 10000, amountReceived: 0, balance: 10000, paymentStatus: "Unpaid" });
  assert.equal(orders.moneyOf({ total: 10000, amountReceived: 4000 }).balance, 6000);
  assert.equal(orders.moneyOf({ total: 10000, amountReceived: 4000 }).paymentStatus, "Partially Paid");
  assert.equal(orders.moneyOf({ total: 10000, amountReceived: 10000 }).paymentStatus, "Paid");
  assert.equal(orders.moneyOf({ total: 10000, amountReceived: 99999 }).balance, 0);
});

test("customer serializer hides internal fields", () => {
  const out = orders.serializeOrderForCustomer({
    _id: "1", orderNumber: "NS-1001", total: 5000, amountReceived: 2000, adminNotes: "secret", status: "Shipped",
    items: [], payments: [{ amount: 2000, method: "UPI", receivedAt: new Date(), recordedBy: "Raju", note: "x" }], statusHistory: [],
  });
  assert.equal(out.status, "Ready to Deliver"); // legacy name mapped
  assert.equal(out.balance, 3000);
  assert.equal(JSON.stringify(out).includes("secret"), false);
  assert.equal(JSON.stringify(out).includes("Raju"), false);
});

test("status list and legacy mapping", () => {
  assert.deepEqual(orderModel.ORDER_STATUSES, ["Order Received", "Order Accepted", "Stitching in Progress", "Ready to Deliver", "Delivered", "Cancelled"]);
  assert.equal(orderModel.normalizeStatus("Quality Check"), "Stitching in Progress");
});

test("validation: customer password, otp, payment", () => {
  assert.ok(val.customerPasswordRule.safeParse("abcdefg1").success);
  assert.ok(!val.customerPasswordRule.safeParse("short1").success);
  assert.ok(!val.customerPasswordRule.safeParse("onlyletters").success);
  assert.equal(val.verifyEmailSchema.parse({ email: " A@X.com ", otp: "123 456" }).otp, "123456");
  assert.ok(!val.verifyEmailSchema.safeParse({ email: "a@x.com", otp: "12345a" }).success);
  assert.ok(!val.paymentSchema.safeParse({ amount: 0 }).success);
  assert.ok(!val.paymentSchema.safeParse({ amount: 10.5 }).success);
  assert.equal(val.paymentSchema.parse({ amount: "2500" }).method, "Cash");
  assert.ok(val.registerSchema.safeParse({ name: "Asha K", email: "a@x.com", phone: "9876543210", password: "pass1234" }).success);
  assert.ok(!val.chatMessageSchema.safeParse({ message: "   " }).success);
  assert.ok(!val.adminUserCreateSchema.safeParse({ name: "A B", email: "a@x.com", password: "Str0ng!Passw", permissions: ["nope"] }).success);
});
