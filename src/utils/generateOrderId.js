import Counter from "@/models/Counter";

/** Atomic sequential IDs: NS-1001, NS-1002 ... / CO-1001 ... */
export async function nextSequence(name, base = 1000) {
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
  return base + counter.seq;
}

export async function generateOrderNumber() {
  return `NS-${await nextSequence("order")}`;
}

export async function generateCustomOrderNumber() {
  return `CO-${await nextSequence("custom-order")}`;
}
