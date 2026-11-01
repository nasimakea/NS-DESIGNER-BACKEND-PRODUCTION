import Customer from "@/models/Customer";

export async function upsertCustomer({ name, phone, email = "", address = "", city = "", state = "", pincode = "" }, inc = {}) {
  const set = { name };
  if (email) set.email = email;
  if (address) Object.assign(set, { address, city, state, pincode });

  return Customer.findOneAndUpdate(
    { phone },
    {
      $set: { ...set, lastOrderAt: new Date() },
      $setOnInsert: { phone },
      ...(Object.keys(inc).length ? { $inc: inc } : {}),
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
}
