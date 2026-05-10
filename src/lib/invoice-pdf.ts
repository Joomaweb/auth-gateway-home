import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type Company = {
  name?: string;
  address?: string;
  email?: string;
  phone?: string;
  tax_id?: string;
  logo?: string;
  invoice_prefix?: string;
};

export type InvoiceOrder = {
  invoice_number: string | null;
  id: string;
  created_at: string;
  status: string;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  payment_method: string | null;
  paypal_order_id?: string | null;
  paypal_capture_id?: string | null;
  paid_at?: string | null;
  notes?: string | null;
  shipping_address: Record<string, string> | null;
};

export type InvoiceItem = {
  name: string | null;
  size?: string | null;
  color?: string | null;
  qty: number;
  price: number;
};

export async function downloadInvoicePdf(
  order: InvoiceOrder,
  items: InvoiceItem[],
  company: Company,
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  // Header — company
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(company.name || "Invoice", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  if (company.address) doc.text(company.address, margin, (y += 16));
  if (company.email) doc.text(company.email, margin, (y += 14));
  if (company.phone) doc.text(company.phone, margin, (y += 14));
  if (company.tax_id) doc.text(`Tax ID: ${company.tax_id}`, margin, (y += 14));

  // Invoice meta — right column
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("INVOICE", pageWidth - margin, margin, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `# ${order.invoice_number || order.id.slice(0, 8).toUpperCase()}`,
    pageWidth - margin,
    margin + 18,
    { align: "right" },
  );
  doc.text(
    `Date: ${new Date(order.created_at).toLocaleDateString()}`,
    pageWidth - margin,
    margin + 34,
    { align: "right" },
  );
  doc.text(
    `Status: ${order.status.toUpperCase()}`,
    pageWidth - margin,
    margin + 50,
    { align: "right" },
  );

  y = Math.max(y, margin + 60) + 24;

  // Bill to
  const a = order.shipping_address;
  if (a) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Bill to", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60);
    y += 14;
    doc.text(a.full_name || "", margin, y);
    if (a.phone) doc.text(a.phone, margin, (y += 12));
    if (a.address)
      doc.text(`${a.address}, ${a.city || ""} ${a.zip || ""}`, margin, (y += 12));
    if (a.country) doc.text(a.country, margin, (y += 12));
    doc.setTextColor(20);
    y += 18;
  }

  // Line items table
  autoTable(doc, {
    startY: y,
    head: [["Item", "Variant", "Qty", "Unit", "Total"]],
    body: items.map((i) => [
      i.name || "",
      [i.size, i.color].filter(Boolean).join(" / "),
      String(i.qty),
      `$${Number(i.price).toFixed(2)}`,
      `$${(i.qty * Number(i.price)).toFixed(2)}`,
    ]),
    headStyles: { fillColor: [20, 20, 20], textColor: 255 },
    styles: { fontSize: 10, cellPadding: 6 },
    columnStyles: {
      2: { halign: "right", cellWidth: 50 },
      3: { halign: "right", cellWidth: 70 },
      4: { halign: "right", cellWidth: 80 },
    },
    margin: { left: margin, right: margin },
  });

  // Totals
  // @ts-expect-error - lastAutoTable is added by autotable
  let ty = (doc.lastAutoTable?.finalY ?? y) + 12;
  const labelX = pageWidth - margin - 140;
  const valueX = pageWidth - margin;
  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 12 : 10);
    doc.text(label, labelX, ty);
    doc.text(value, valueX, ty, { align: "right" });
    ty += bold ? 18 : 14;
  };
  row("Subtotal", `$${Number(order.subtotal).toFixed(2)}`);
  row("Shipping", `$${Number(order.shipping).toFixed(2)}`);
  if (Number(order.tax) > 0) row("Tax", `$${Number(order.tax).toFixed(2)}`);
  doc.setDrawColor(200);
  doc.line(labelX, ty - 4, valueX, ty - 4);
  row("Total", `$${Number(order.total).toFixed(2)}`, true);

  // Payment info
  ty += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Payment: ${order.payment_method || "—"}`, margin, ty);
  if (order.paypal_capture_id)
    doc.text(`PayPal capture: ${order.paypal_capture_id}`, margin, (ty += 12));

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text(
    "Thank you for your purchase.",
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 30,
    { align: "center" },
  );

  doc.save(
    `${order.invoice_number || "invoice-" + order.id.slice(0, 8)}.pdf`,
  );
}
