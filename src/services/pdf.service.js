import PDFDocument from "pdfkit";

const money = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
const date = (value) =>
  new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

/** Builds the order details PDF and resolves to a Buffer. */
export function buildOrderPdf(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Order ${order.orderNumber}`, Author: "NS Designer" } });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fillColor("#850d2b").fontSize(24).text("NS DESIGNER", { continued: false });
    doc.fillColor("#444").fontSize(11).text("Customer order details");
    doc.moveDown(0.8);

    doc.fillColor("#111").fontSize(13).text(`Order ID: ${order.orderNumber}`);
    doc.fontSize(10).fillColor("#555").text(`Placed: ${date(order.createdAt)}`);
    doc.moveDown();

    doc.fillColor("#111").fontSize(12).text("Customer", { underline: true });
    doc.fontSize(10.5).fillColor("#222");
    doc.text(`Name: ${order.customerName}`);
    doc.text(`Phone: ${order.phone}`);
    if (order.email) doc.text(`Email: ${order.email}`);
    const a = order.deliveryAddress || {};
    doc.text(`Address: ${a.address}, ${a.city}, ${a.state} - ${a.pincode}`);
    if (order.notes) doc.text(`Notes: ${order.notes}`);
    doc.moveDown();

    doc.fillColor("#111").fontSize(12).text("Items", { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10.5).fillColor("#222");
    order.items.forEach((item, index) => {
      doc.text(
        `${index + 1}. ${item.name}  |  Size: ${item.size}  |  Colour: ${item.color}  |  Qty: ${item.quantity}  |  ${money(item.unitPrice)} each  =  ${money(item.lineTotal)}`
      );
    });

    doc.moveDown();
    doc.fillColor("#850d2b").fontSize(14).text(`Total: ${money(order.total)}`);
    doc.moveDown(1.5);
    doc.fillColor("#666").fontSize(9.5).text(
      "This is an order request. NS Designer will contact you to confirm availability, measurements, price and delivery."
    );

    doc.end();
  });
}
