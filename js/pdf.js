/**
 * Generación de PDF de cotizaciones (jsPDF vía CDN)
 */
(function () {
  async function ensureJsPdf() {
    if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
    throw new Error("jsPDF no está cargado");
  }

  async function downloadQuotePdf(quote, branding) {
    const JsPDF = await ensureJsPdf();
    const doc = new JsPDF({ unit: "mm", format: "a4" });
    const brand = branding?.brandName || "Black Coffee Administration";
    const margin = 16;
    let y = 20;

    doc.setFillColor(12, 12, 12);
    doc.rect(0, 0, 210, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(brand, margin, 14);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Cotización comercial", margin, 22);

    y = 38;
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Cotización #${quote.number || quote.id}`, margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Fecha: ${quote.date}`, margin, y);
    y += 6;
    doc.text(`Cliente: ${quote.clientName}`, margin, y);
    y += 6;
    doc.text(`Ciudad: ${quote.clientCity || "—"}`, margin, y);
    y += 6;
    doc.text(`Tipo: ${quote.clientTypeLabel || quote.clientType}`, margin, y);
    y += 10;

    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y, 210 - margin, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.text("Detalle del café", margin, y);
    y += 7;
    doc.setFont("helvetica", "normal");

    const lines = [
      `Café: ${quote.coffeeName}`,
      `Productor / zona: ${quote.producer || "—"} · ${quote.zone || "—"}`,
      `Proceso: ${quote.process || "—"}`,
      `Formato: ${quote.formatLabel}`,
      `Cantidad: ${quote.quantityKg} kg (~${quote.bags} bolsas)`,
      `Margen: ${quote.marginPct}%`,
      `Costo unitario: ${BCACalc.formatCOP(quote.totalCostPerKg)} / kg`,
      `Precio venta: ${BCACalc.formatCOP(quote.salePricePerKg)} / kg`,
    ];

    lines.forEach((line) => {
      doc.text(line, margin, y);
      y += 6;
    });

    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Total: ${BCACalc.formatCOP(quote.subtotal)}`, margin, y);
    y += 10;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 90, 90);
    const notes = doc.splitTextToSize(
      quote.notes ||
        "Cotización generada por Black Coffee Administration. Precios en COP. Sujeto a disponibilidad de inventario.",
      180
    );
    doc.text(notes, margin, y);
    y += notes.length * 5 + 8;

    doc.setFontSize(8);
    doc.text(
      `Notificaciones: ${BCA.NOTIFY_EMAIL}`,
      margin,
      Math.max(y, 280)
    );

    const filename = `cotizacion-${quote.number || quote.id}.pdf`;
    doc.save(filename);
    return filename;
  }

  window.BCAPdf = { downloadQuotePdf };
})();
