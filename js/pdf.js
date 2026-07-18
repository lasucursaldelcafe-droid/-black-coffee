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

    doc.line(20, 74, 190, 74);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Producto', 20, 84);
    doc.text('Presentación', 80, 84);
    doc.text('Cant.', 130, 84);
    doc.text('P. Unit.', 150, 84);
    doc.text('Total', 175, 84);

    doc.line(20, 88, 190, 88);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(quotation.coffeeName, 20, 96);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(quotation.coffeeDetails, 20, 102);
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text(PACKAGING_SIZES[quotation.packaging]?.label || quotation.packaging, 80, 96);
    doc.text(String(quotation.quantity), 130, 96);
    doc.text(formatCurrency(quotation.unitPrice), 150, 96);
    doc.text(formatCurrency(quotation.totalPrice), 175, 96);

    let yPos = 115;

    if (quotation.costBreakdown) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Desglose de Costos:', 20, yPos);
      yPos += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      const breakdown = quotation.costBreakdown;
      const items = [
        ['Café', breakdown.coffeeCost],
        ['Proceso (tostión + selección)', breakdown.processCost],
        ['Empaque', breakdown.packagingCost],
        ['Etiqueta', breakdown.labelCost]
      ];

      if (breakdown.increaseCost > 0) {
        items.push(['Costo de alza', breakdown.increaseCost]);
      }

      items.forEach(([label, value]) => {
        doc.text(`${label}:`, 25, yPos);
        doc.text(formatCurrency(value), 100, yPos);
        yPos += 6;
      });

      doc.text(`Margen (${quotation.margin}%):`, 25, yPos);
      doc.text(formatCurrency(quotation.unitPrice - breakdown.totalCost), 100, yPos);
      yPos += 10;
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
