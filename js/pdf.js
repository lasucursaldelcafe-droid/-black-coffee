const PDFGenerator = {
  async loadLibrary() {
    if (window.jspdf) return;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  },

  async generate(quotation) {
    await this.loadLibrary();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const settings = Storage.get(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS;

    const validUntil = new Date(quotation.createdAt);
    validUntil.setDate(validUntil.getDate() + (quotation.validity || 15));
    const mode = PRODUCTION_MODES[quotation.productionMode || 'full_pack']?.label || 'Full Pack';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(settings.companyName, 20, 25);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(settings.tagline, 20, 32);
    doc.text(settings.email, 20, 38);

    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('COTIZACIÓN', 150, 25);
    doc.setFontSize(11);
    doc.text(quotation.number, 150, 33);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Fecha: ${formatDate(quotation.createdAt)}`, 150, 40);
    doc.text(`Válida hasta: ${formatDate(validUntil)}`, 150, 46);

    doc.setDrawColor(200);
    doc.line(20, 52, 190, 52);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Cliente:', 20, 62);
    doc.setFont('helvetica', 'normal');
    doc.text(quotation.clientName, 50, 62);
    doc.text(`Tipo: ${CLIENT_TYPES[quotation.clientType]?.label || quotation.clientType}`, 50, 68);
    doc.text(`Modo: ${mode}`, 50, 74);

    if (quotation.processSuppliers && Object.keys(quotation.processSuppliers).length) {
      const supplierText = QuotationManager.formatProcessSuppliers(quotation.processSuppliers);
      const split = doc.splitTextToSize(`Proveedores: ${supplierText}`, 140);
      doc.setFontSize(8);
      doc.text(split, 50, 80);
      doc.setFontSize(10);
    }

    doc.line(20, quotation.processSuppliers ? 88 : 80, 190, quotation.processSuppliers ? 88 : 80);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const tableY = quotation.processSuppliers ? 98 : 90;
    doc.text('Producto', 20, tableY);
    doc.text('Presentación', 80, tableY);
    doc.text('Cant.', 130, tableY);
    doc.text('P. Unit.', 150, tableY);
    doc.text('Total', 175, tableY);

    doc.line(20, tableY + 4, 190, tableY + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const rowY = tableY + 12;
    doc.text(quotation.coffeeName, 20, rowY);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(quotation.coffeeDetails, 20, rowY + 6);
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text(PACKAGING_SIZES[quotation.packaging]?.label || quotation.packaging, 80, rowY);
    doc.text(String(quotation.quantity), 130, rowY);
    doc.text(formatCurrency(quotation.unitPrice), 150, rowY);
    doc.text(formatCurrency(quotation.totalPrice), 175, rowY);

    let yPos = rowY + 18;

    if (quotation.costBreakdown?.breakdown) {
      const b = quotation.costBreakdown.breakdown;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Desglose de Costos:', 20, yPos);
      yPos += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      const printSection = (title, items) => {
        if (!items?.length) return;
        doc.setFont('helvetica', 'bold');
        doc.text(title, 25, yPos);
        yPos += 5;
        doc.setFont('helvetica', 'normal');
        items.forEach((item) => {
          doc.text(`${item.label}:`, 30, yPos);
          doc.text(formatCurrency(item.cost), 110, yPos);
          yPos += 5;
        });
        yPos += 2;
      };

      printSection('Administrativa / Logística', b.administrative);
      printSection('Transformación', b.transformation);
      printSection('Materiales', b.materials);

      doc.text(`Margen (${quotation.margin}%):`, 25, yPos);
      doc.text(formatCurrency(quotation.unitPrice - quotation.costBreakdown.totalCost), 110, yPos);
      yPos += 10;
    } else if (quotation.costBreakdown) {
      const breakdown = quotation.costBreakdown;
      doc.setFont('helvetica', 'bold');
      doc.text('Desglose de Costos:', 20, yPos);
      yPos += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      [
        ['Café', breakdown.coffeeCost],
        ['Proceso', breakdown.processCost],
        ['Empaque', breakdown.packagingCost],
        ['Etiquetas', breakdown.labelCost]
      ].forEach(([label, value]) => {
        if (value) {
          doc.text(`${label}:`, 25, yPos);
          doc.text(formatCurrency(value), 110, yPos);
          yPos += 5;
        }
      });
      yPos += 5;
    }

    if (quotation.notes) {
      doc.setFont('helvetica', 'bold');
      doc.text('Notas:', 20, yPos);
      doc.setFont('helvetica', 'normal');
      const splitNotes = doc.splitTextToSize(quotation.notes, 170);
      doc.text(splitNotes, 20, yPos + 6);
      yPos += 6 + splitNotes.length * 5;
    }

    yPos = Math.max(yPos + 10, 240);
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(120, yPos, 190, yPos);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`TOTAL: ${formatCurrency(quotation.totalPrice)}`, 120, yPos + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Documento generado por Black Coffee Administration', 20, 285);

    doc.save(`${quotation.number}_${quotation.clientName.replace(/\s+/g, '_')}.pdf`);
    Toast.show('PDF generado correctamente', 'success');
  }
};
