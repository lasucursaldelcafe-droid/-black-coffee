const EmailService = {
  email: 'ghostspecialtycoffee@gmail.com',

  init() {
    const settings = Storage.get(STORAGE_KEYS.SETTINGS);
    if (settings?.email) {
      this.email = settings.email;
    }
  },

  sendNotification(subject, body) {
    const fullBody = `${body}\n\n---\nEnviado desde Black Coffee Administration\nFecha: ${new Date().toLocaleString('es-CO')}`;
    this.logEmail(subject, fullBody);
    this.sendViaMailto(subject, fullBody);
  },

  sendQuotation(quotation) {
    const subject = `Nueva Cotización ${quotation.number} - ${quotation.clientName}`;
    const body = `
Nueva cotización generada:

Número: ${quotation.number}
Cliente: ${quotation.clientName}
Café: ${quotation.coffeeName}
Presentación: ${PACKAGING_SIZES[quotation.packaging]?.label || quotation.packaging}
Cantidad: ${quotation.quantity} unidades
Precio unitario: ${formatCurrency(quotation.unitPrice)}
TOTAL: ${formatCurrency(quotation.totalPrice)}
Margen: ${quotation.margin}%
Fecha: ${formatDate(quotation.createdAt)}
${quotation.notes ? 'Notas: ' + quotation.notes : ''}
    `.trim();

    this.logEmail(subject, body);
    this.sendViaMailto(subject, body);
  },

  sendPurchaseNotification(purchase, coffeeName) {
    const subject = `Nueva Compra de Café - ${coffeeName}`;
    const body = `
Se registró una nueva compra:

Café: ${coffeeName}
Cantidad: ${purchase.kg} kg
Costo por kg: ${formatCurrency(purchase.costPerKg)}
Total: ${formatCurrency(purchase.totalCost)}
Fecha: ${formatDate(purchase.date)}
    `.trim();

    this.logEmail(subject, body);
    this.sendViaMailto(subject, body);
  },

  sendViaMailto(subject, body) {
    const mailtoLink = `mailto:${this.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    const emails = Storage.get('bca_email_queue') || [];
    emails.unshift({
      to: this.email,
      subject,
      body,
      sentAt: new Date().toISOString(),
      method: 'mailto'
    });
    if (emails.length > 100) emails.length = 100;
    Storage.set('bca_email_queue', emails);
  },

  logEmail(subject, body) {
    console.log(`[BCA Email] To: ${this.email} | Subject: ${subject}`);
  },

  getEmailQueue() {
    return Storage.get('bca_email_queue') || [];
  }
};
