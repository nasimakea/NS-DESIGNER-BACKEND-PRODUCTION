// Response shapes for the admin screens. Field names intentionally match what the
// existing admin pages already read (name / fullName, phone / phoneNumber ...).

export function serializeCustomOrder(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    name: o.customerName,
    phone: o.phone,
    email: o.email,
    outfitType: o.outfitType,
    measurements: o.measurements,
    requirements: o.requirements,
    designImageUrl: o.designImage?.url || "",
    image: o.designImage?.url || "",
    status: o.status,
    price: o.price,
    adminNotes: o.adminNotes,
    createdAt: o.createdAt,
  };
}

export function serializeFranchise(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    name: o.name,
    fullName: o.name,
    phone: o.phone,
    email: o.email,
    city: o.city,
    investment: o.investment,
    plannedInvestment: o.investment,
    message: o.message,
    status: o.status,
    adminNotes: o.adminNotes,
    createdAt: o.createdAt,
  };
}

export function serializeMessage(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    name: o.name,
    fullName: o.name,
    phone: o.phone,
    email: o.email,
    subject: o.subject,
    category: o.category,
    enquiryType: o.category,
    message: o.message,
    status: o.status,
    adminNotes: o.adminNotes,
    createdAt: o.createdAt,
  };
}
