import Product from "@/models/Product";
import Order, { ORDER_STATUSES, normalizeStatus } from "@/models/Order";
import Customer from "@/models/Customer";
import { upsertCustomer } from "./customer.service";
import { sendOrderStatusEmail } from "./brevo.service";
import { generateOrderNumber } from "@/utils/generateOrderId";
import { AppError } from "@/utils/apiResponse";

const sameValue = (list, value) => list.find((entry) => entry.toLowerCase() === String(value).toLowerCase());

/**
 * Builds an order from the cart. Prices, names and images always come from the
 * database - anything the browser sends about price is ignored.
 */
export async function createOrder({ customer, items, userId = null }) {
  const slugs = [...new Set(items.map((item) => item.slug))];
  const products = await Product.find({ slug: { $in: slugs }, status: "Active", deletedAt: null });
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  const lines = items.map((item) => {
    const product = bySlug.get(item.slug);
    if (!product) throw new AppError(`"${item.slug}" is no longer available.`, 409);

    const size = product.sizes.length ? sameValue(product.sizes, item.size) : item.size;
    if (!size) throw new AppError(`Size ${item.size} is not available for ${product.name}.`, 400);

    const color = product.colors.length ? sameValue(product.colors, item.color) : item.color;
    if (!color) throw new AppError(`Colour ${item.color} is not available for ${product.name}.`, 400);

    return {
      product: product._id,
      slug: product.slug,
      name: product.name,
      image: product.mainImage?.url || "",
      color,
      size,
      quantity: item.quantity,
      unitPrice: product.price,
      lineTotal: product.price * item.quantity,
    };
  });

  const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  // totalSpent is NOT increased here any more: it only grows when an admin records a payment.
  const customerDoc = await upsertCustomer(
    {
      name: customer.fullName,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      pincode: customer.pincode,
    },
    { ordersCount: 1 }
  );

  return Order.create({
    orderNumber: await generateOrderNumber(),
    customer: customerDoc._id,
    user: userId,
    customerName: customer.fullName,
    phone: customer.phone,
    email: customer.email,
    deliveryAddress: {
      address: customer.address,
      city: customer.city,
      state: customer.state,
      pincode: customer.pincode,
    },
    items: lines,
    subtotal: total,
    total,
    notes: customer.notes,
    statusHistory: [{ status: "Order Received", by: "Customer" }],
  });
}

// ---------------------------------------------------------------------------
// Money helpers - one place so the dashboard, Orders page and customer account
// always agree: balance = total - what an admin has actually recorded as received.
// ---------------------------------------------------------------------------
export function moneyOf(o) {
  const received = Math.min(o.total, Math.max(0, o.amountReceived || 0));
  const balance = Math.max(0, o.total - received);
  const paymentStatus = received <= 0 ? "Unpaid" : balance === 0 ? "Paid" : "Partially Paid";
  return { total: o.total, amountReceived: received, balance, paymentStatus };
}

const publicItems = (o) =>
  o.items.map((i) => ({
    slug: i.slug, name: i.name, image: i.image, color: i.color, size: i.size,
    quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal,
  }));

/** Full shape for the admin dashboard and Orders page. */
export function serializeOrder(order) {
  const o = order.toObject ? order.toObject() : order;
  const money = moneyOf(o);
  return {
    id: String(o._id),
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    phone: o.phone,
    email: o.email,
    deliveryAddress: o.deliveryAddress,
    items: publicItems(o),
    outfit: o.items.map((i) => i.name).join(", "),
    amount: o.total,
    total: o.total,
    amountReceived: money.amountReceived,
    balance: money.balance,
    paymentStatus: money.paymentStatus,
    payments: (o.payments || []).map((p) => ({
      id: String(p._id), amount: p.amount, method: p.method, note: p.note, receivedAt: p.receivedAt, recordedBy: p.recordedBy,
    })),
    notes: o.notes,
    status: normalizeStatus(o.status),
    statusHistory: (o.statusHistory || []).map((h) => ({ status: normalizeStatus(h.status), at: h.at, by: h.by })),
    measurements: o.measurements,
    adminNotes: o.adminNotes,
    hasAccount: Boolean(o.user),
    notification: o.notification,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

/** What a signed-in shopper sees on their own order (no internal notes or staff names). */
export function serializeOrderForCustomer(order) {
  const o = order.toObject ? order.toObject() : order;
  const money = moneyOf(o);
  return {
    id: String(o._id),
    orderNumber: o.orderNumber,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    status: normalizeStatus(o.status),
    statusHistory: (o.statusHistory || []).map((h) => ({ status: normalizeStatus(h.status), at: h.at })),
    items: publicItems(o),
    deliveryAddress: o.deliveryAddress,
    notes: o.notes,
    total: money.total,
    amountReceived: money.amountReceived,
    balance: money.balance,
    paymentStatus: money.paymentStatus,
    payments: (o.payments || []).map((p) => ({ amount: p.amount, method: p.method, receivedAt: p.receivedAt })),
  };
}

/** What the customer sees right after placing an order. */
export function serializeOrderReceipt(order) {
  const o = serializeOrder(order);
  return {
    orderId: o.orderNumber,
    createdAt: o.createdAt,
    customer: { fullName: o.customerName, phone: o.phone, email: o.email, ...o.deliveryAddress, notes: o.notes },
    items: o.items,
    total: o.total,
    status: o.status,
  };
}

// ---------------------------------------------------------------------------
// Admin changes. Used by both the dashboard "Action" menu and the Orders page,
// so both go through exactly the same code (that is what keeps them in sync).
// ---------------------------------------------------------------------------
export async function applyOrderUpdate(order, input, admin) {
  const wasCancelled = order.status === "Cancelled";
  let statusChanged = false;

  if (input.status) {
    if (!ORDER_STATUSES.includes(input.status)) throw new AppError("Unknown order status.", 400);
    const different = normalizeStatus(order.status) !== input.status;
    order.status = input.status;
    if (different) {
      order.statusHistory.push({ status: input.status, by: admin?.name || "" });
      statusChanged = true;
    }
  }
  if (input.measurements) order.measurements = input.measurements;
  if (input.adminNotes !== undefined) order.adminNotes = input.adminNotes;
  await order.save();

  // Keep customer lifetime stats honest when an order is cancelled / restored.
  const isCancelled = order.status === "Cancelled";
  if (wasCancelled !== isCancelled) {
    await Customer.updateOne({ _id: order.customer }, { $inc: { ordersCount: isCancelled ? -1 : 1 } });
  }

  if (statusChanged && order.email) {
    const { balance } = moneyOf(order);
    sendOrderStatusEmail({ to: order.email, name: order.customerName, orderNumber: order.orderNumber, status: order.status, balance })
      .catch((error) => console.error("[order status email] failed:", error?.message));
  }
  return order;
}

/** Records money received. Atomic: two admins cannot push the total above the order value. */
export async function addPayment(orderId, { amount, method, note }, admin) {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError("Order not found.", 404);
  if (order.status === "Cancelled") throw new AppError("This order is cancelled. Restore it before recording a payment.", 400);

  const balance = order.total - (order.amountReceived || 0);
  if (amount > balance) {
    throw new AppError(`Amount is more than the balance due (₹${balance.toLocaleString("en-IN")}).`, 400);
  }

  const updated = await Order.findOneAndUpdate(
    {
      _id: orderId,
      // `$exists: false` covers orders created before payments existed (until migrate:v2 is run)
      $or: [{ amountReceived: { $lte: order.total - amount } }, { amountReceived: { $exists: false } }],
    },
    {
      $push: { payments: { amount, method, note, recordedBy: admin?.name || "" } },
      $inc: { amountReceived: amount },
    },
    { returnDocument: "after" }
  );
  if (!updated) throw new AppError("The balance changed. Please refresh and try again.", 409);

  await Customer.updateOne({ _id: order.customer }, { $inc: { totalSpent: amount } });
  return updated;
}

export async function removePayment(orderId, paymentId) {
  const order = await Order.findById(orderId);
  if (!order) throw new AppError("Order not found.", 404);
  const payment = order.payments.id(paymentId);
  if (!payment) throw new AppError("Payment not found.", 404);

  const amount = payment.amount;
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, "payments._id": paymentId },
    { $pull: { payments: { _id: paymentId } }, $inc: { amountReceived: -amount } },
    { returnDocument: "after" }
  );
  if (!updated) throw new AppError("Payment was already removed.", 409);

  await Customer.updateOne({ _id: order.customer }, { $inc: { totalSpent: -amount } });
  return updated;
}
