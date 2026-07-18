const NOTIFICATION_EMAIL = 'ghostspecialtycoffee@gmail.com';

const EmailService = {
  email: NOTIFICATION_EMAIL,
  _pending: new Set(),

  init() {
    const settings = Storage.get(STORAGE_KEYS.SETTINGS);
    if (settings?.email) {
      this.email = settings.email;
    }
  },

  sendNotification(subject, body) {
    const fullBody = `${body}\n\n---\nEnviado desde Black Coffee Administration\nFecha: ${new Date().toLocaleString('es-CO')}`;
    this.dispatch(subject, fullBody, 'notification');
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

    this.dispatch(subject, body, 'quotation');
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

    this.dispatch(subject, body, 'purchase');
  },

  sendSaleNotification(sale) {
    const subject = `Nueva Venta - ${sale.coffeeName}`;
    const body = `
Se registró una nueva venta:

Café: ${sale.coffeeName}
Cliente: ${sale.clientName || '—'}
Presentación: ${PACKAGING_SIZES[sale.packaging]?.label || sale.packaging}
Cantidad: ${sale.quantity} unidades
Precio unitario: ${formatCurrency(sale.unitPrice)}
Total: ${formatCurrency(sale.totalRevenue)}
Utilidad: ${formatCurrency(sale.profit)} (${formatNumber(sale.profitMargin, 1)}%)
Registrado por: ${sale.userName || '—'}
Fecha: ${formatDate(sale.soldAt || sale.createdAt)}
    `.trim();

    this.dispatch(subject, body, 'sale');
  },

  dispatch(subject, body, type = 'notification') {
    const dedupeKey = `${type}:${subject}`;
    if (this._pending.has(dedupeKey)) return;
    this._pending.add(dedupeKey);
    setTimeout(() => this._pending.delete(dedupeKey), 5000);

    this.logEmail(subject, body);
    this.queueEmail(subject, body, type);
    this.sendViaFormSubmit(subject, body);
  },

  async sendViaFormSubmit(subject, body) {
    // FormSubmit bloquea CORS desde el navegador; la cola local + Firebase es el respaldo.
    // El correo queda registrado para revisión en bca_email_queue.
    void subject;
    void body;
  },

  queueEmail(subject, body, type = 'notification') {
    const emails = Storage.get('bca_email_queue') || [];
    emails.unshift({
      to: this.email,
      subject,
      body,
      type,
      sentAt: new Date().toISOString(),
      method: 'formsubmit',
      delivered: false
    });
    if (emails.length > 100) emails.length = 100;
    Storage.set('bca_email_queue', emails);
  },

  markDelivered(subject) {
    const emails = Storage.get('bca_email_queue') || [];
    const match = emails.find((e) => e.subject === subject && !e.delivered);
    if (match) {
      match.delivered = true;
      match.deliveredAt = new Date().toISOString();
      Storage.set('bca_email_queue', emails);
    }
  },

  logEmail(subject, body) {
    console.log(`[BCA Email] To: ${this.email} | Subject: ${subject}`);
    if (body) console.log(body);
  },

  getEmailQueue() {
    return Storage.get('bca_email_queue') || [];
  }
};
