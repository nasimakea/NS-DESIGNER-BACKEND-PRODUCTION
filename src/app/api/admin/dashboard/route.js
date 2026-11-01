import Order, { OPEN_STATUSES, normalizeStatus } from "@/models/Order";
import Customer from "@/models/Customer";
import { route } from "@/lib/route";
import { serializeOrder } from "@/services/order.service";

const RANGES = { week: 7, month: 30, year: 365 };
const IST_MS = 5.5 * 3600_000;

export const GET = route(
  async ({ request }) => {
    const range = new URL(request.url).searchParams.get("range") || "month";
    const days = RANGES[range] || 30;
    const now = new Date();
    const since = new Date(now.getTime() - days * 86400_000);
    const previous = new Date(since.getTime() - days * 86400_000);

    const notCancelled = { status: { $ne: "Cancelled" } };
    const period = (from, to) => ({ createdAt: { $gte: from, ...(to ? { $lt: to } : {}) } });

    // Money is counted only when an admin recorded a payment, on the day it was recorded as received.
    const received = (from, to) => [
      { $unwind: "$payments" },
      { $match: { "payments.receivedAt": { $gte: from, ...(to ? { $lt: to } : {}) } } },
      { $group: { _id: null, amount: { $sum: "$payments.amount" } } },
    ];

    const [cur, prev, recCur, recPrev, due, customers, newCustomers, prevCustomers, pending, statusRows, recent] =
      await Promise.all([
        Order.countDocuments({ ...period(since), ...notCancelled }),
        Order.countDocuments({ ...period(previous, since), ...notCancelled }),
        Order.aggregate(received(since)),
        Order.aggregate(received(previous, since)),
        // Still owed by customers across all live orders.
        Order.aggregate([
          { $match: notCancelled },
          { $group: { _id: null, total: { $sum: "$total" }, received: { $sum: "$amountReceived" } } },
        ]),
        Customer.countDocuments(),
        Customer.countDocuments(period(since)),
        Customer.countDocuments(period(previous, since)),
        Order.countDocuments({ status: { $in: OPEN_STATUSES } }),
        Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        Order.find().sort({ createdAt: -1 }).limit(8),
      ]);

    // Monthly "amount received" for the current year (chart), bucketed in Indian time.
    const istYear = new Date(now.getTime() + IST_MS).getUTCFullYear();
    const yearStart = new Date(Date.UTC(istYear, 0, 1) - IST_MS);
    const [yearPayments, yearOrders] = await Promise.all([
      Order.aggregate([
        { $unwind: "$payments" },
        { $match: { "payments.receivedAt": { $gte: yearStart } } },
        { $project: { at: "$payments.receivedAt", amount: "$payments.amount" } },
        { $limit: 50000 },
      ]),
      Order.find({ createdAt: { $gte: yearStart }, ...notCancelled }).select("createdAt").limit(50000).lean(),
    ]);
    const sales = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, revenue: 0, orders: 0 }));
    for (const p of yearPayments) sales[new Date(new Date(p.at).getTime() + IST_MS).getUTCMonth()].revenue += p.amount;
    for (const o of yearOrders) sales[new Date(new Date(o.createdAt).getTime() + IST_MS).getUTCMonth()].orders += 1;

    // Merge old status names into the current ones so the breakdown matches the dropdowns.
    const breakdown = new Map();
    for (const row of statusRows) {
      const key = normalizeStatus(row._id);
      breakdown.set(key, (breakdown.get(key) || 0) + row.count);
    }

    const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : 0);
    const amountNow = recCur[0]?.amount || 0;
    const amountBefore = recPrev[0]?.amount || 0;
    const owed = due[0] ? Math.max(0, due[0].total - due[0].received) : 0;

    return {
      range,
      stats: {
        totalOrders: cur,
        amountReceived: amountNow,
        totalRevenue: amountNow, // kept so older screens keep working: revenue = money actually received
        balanceDue: owed,
        totalCustomers: customers,
        pendingOrders: pending,
        ordersChange: pct(cur, prev),
        revenueChange: pct(amountNow, amountBefore),
        customersChange: pct(newCustomers, prevCustomers),
      },
      sales,
      statusBreakdown: [...breakdown].map(([status, count]) => ({ status, count })),
      recentOrders: recent.map(serializeOrder),
    };
  },
  { auth: "dashboard" }
);
