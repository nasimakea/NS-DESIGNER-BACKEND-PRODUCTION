import Customer from "@/models/Customer";
import { route } from "@/lib/route";
import { listDocs } from "@/lib/crud";

const serialize = (c) => {
  const o = c.toObject ? c.toObject() : c;
  return {
    id: String(o._id), name: o.name, phone: o.phone, email: o.email, address: o.address,
    city: o.city, state: o.state, pincode: o.pincode,
    ordersCount: o.ordersCount, customOrdersCount: o.customOrdersCount,
    totalSpent: o.totalSpent, lastOrderAt: o.lastOrderAt, createdAt: o.createdAt,
  };
};

export const GET = route(
  (ctx) => listDocs(Customer, ctx.request, { searchFields: ["name", "phone", "email", "city"], serialize, statusField: null, sort: { lastOrderAt: -1, createdAt: -1 } }),
  { auth: "customers" }
);
