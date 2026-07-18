/* Generación de PDF de cotizaciones */
window.BC = window.BC || {};

BC.PDF = {
  async quote(quote, state) {
    if (!window.jspdf?.jsPDF) {
      throw new Error("jsPDF no está disponible");
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 48;
    let y = margin;

    const brand = state.appearance.brandName || "Black Coffee";
    const client = state.clients.find((c) => c.id === quote.clientId);

    doc.setFillColor(10, 10, 10);
    doc.rect(0, 0, pageW, 90, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(brand.toUpperCase(), margin, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Administration · Cotización comercial", margin, 62);
    doc.setFontSize(10);
    doc.text(`N° ${quote.numero}`, pageW - margin, 42, { align: "right" });
    doc.text(`Fecha: ${quote.fecha}`, pageW - margin, 58, { align: "right" });

    y = 120;
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Cliente", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    y += 18;
    doc.text(client?.name || "—", margin, y);
    y += 14;
    doc.setTextColor(90, 90, 90);
    const tipoLabel =
      BC.CATALOGS.tiposCliente.find(
        (t) => t.id === (quote.tipoCliente || client?.tipo)
      )?.label || "";
    doc.text(
      `${client?.ciudad || ""}${client?.departamento ? ", " + client.departamento : ""} · ${tipoLabel}`,
      margin,
      y
    );

    y += 28;
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.text("Detalle", margin, y);
    y += 16;

    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 12, pageW - margin * 2, 22, "F");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text("Producto / formato", margin + 6, y);
    doc.text("Kg", pageW - margin - 180, y);
    doc.text("Precio/kg", pageW - margin - 110, y);
    doc.text("Subtotal", pageW - margin, y, { align: "right" });
    y += 20;

    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    for (const line of quote.lines) {
      const formato = BC.CATALOGS.formatosEmpaque.find((f) => f.id === line.formatoId);
      const label = `${line.coffeeName}\n${formato?.label || line.formatoId} · margen ${line.margen}%`;
      const lines = doc.splitTextToSize(label, 250);
      doc.text(lines, margin + 6, y);
      doc.text(String(line.kilosTostados), pageW - margin - 180, y);
      doc.text(BC.formatCOP(line.precioVentaKg), pageW - margin - 110, y);
      doc.text(BC.formatCOP(line.subtotal), pageW - margin, y, { align: "right" });
      y += Math.max(28, lines.length * 12 + 8);
      if (y > 720) {
        doc.addPage();
        y = margin;
      }
    }

    y += 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 24;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Total cotizado", margin, y);
    doc.text(BC.formatCOP(quote.total), pageW - margin, y, { align: "right" });

    y += 28;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const notes =
      quote.notas ||
      "Validez 7 días. Precios en COP. Sujeto a disponibilidad de lote.";
    doc.text(doc.splitTextToSize(notes, pageW - margin * 2), margin, y);

    y += 48;
    doc.setTextColor(60, 60, 60);
    doc.text(`Elaborado por: ${quote.createdBy || "Black Coffee"}`, margin, y);
    doc.text(`Notificaciones: ${BC.NOTIFY_EMAIL}`, margin, y + 14);

    doc.save(`${quote.numero}-cotizacion-black-coffee.pdf`);
  },
};
