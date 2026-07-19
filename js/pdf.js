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
    const grindLabel = GRIND_TYPES[quotation.grindType || 'grano']?.label || 'En Grano';
    const packagingLabel = formatPackagingMix(quotation.packagingMix, quotation.packaging, quotation.quantity);
    const lineItems = getQuotationLineItems(quotation);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(settings.companyName, 20, 25);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(settings.tagline, 20, 32);
    if (settings.email) {
      doc.text(settings.email, 20, 38);
    }

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

    doc.setFont('helvetica', 'bold');
    doc.text('Producto:', 20, 70);
    doc.setFont('helvetica', 'normal');
    doc.text(quotation.coffeeName, 50, 70);
    doc.setFontSize(8);
    doc.setTextColor(100);
    const details = doc.splitTextToSize(quotation.coffeeDetails || '', 140);
    doc.text(details, 50, 76);
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text(`Presentación: ${packagingLabel}`, 50, 84 + (details.length - 1) * 4);
    doc.text(`Preparación: ${grindLabel}`, 50, 90 + (details.length - 1) * 4);
    if (quotation.productionMode === 'maquila') {
      const packagingSource = quotation.clientProvidesPackaging !== false
        ? 'Empaque: aportado por el cliente'
        : 'Empaque: aportado por nosotros (material incluido)';
      doc.text(packagingSource, 50, 96 + (details.length - 1) * 4);
    }

    const tableY = quotation.productionMode === 'maquila'
      ? 104 + (details.length - 1) * 4
      : 98 + (details.length - 1) * 4;
    doc.line(20, tableY - 4, 190, tableY - 4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Descripción', 20, tableY);
    doc.text('Cant.', 120, tableY);
    doc.text('P. Unit.', 145, tableY);
    doc.text('Total', 175, tableY);
    doc.line(20, tableY + 4, 190, tableY + 4);

    doc.setFont('helvetica', 'normal');
    let rowY = tableY + 12;
    lineItems.forEach((line) => {
      const sizeLabel = PACKAGING_SIZES[line.packaging]?.label || line.packaging;
      doc.text(`${quotation.coffeeName} (${sizeLabel})`, 20, rowY);
      doc.text(String(line.quantity), 120, rowY);
      doc.text(formatCurrency(line.unitPrice), 145, rowY);
      doc.text(formatCurrency(line.lineTotal), 175, rowY);
      rowY += 8;
    });

    let yPos = rowY + 10;

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
    doc.setTextColor(120);
    doc.text('Precio por producto entregado', 120, yPos + 14);

    doc.setTextColor(150);
    doc.text('Documento generado por Black Coffee Administration', 20, 285);

    doc.save(`${quotation.number}_${quotation.clientName.replace(/\s+/g, '_')}.pdf`);
    Toast.show('PDF para cliente generado correctamente', 'success');
  }
};
