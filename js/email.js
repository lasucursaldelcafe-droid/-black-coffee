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
    const lineItems = getQuotationLineItems(quotation);
    const coffeeSummary = formatQuotationCoffeeNames(quotation);
    const linesText = lineItems.map((line) =>
      `- ${line.coffeeName || quotation.coffeeName}: ${line.quantity} × ${formatCurrency(line.unitPrice)} = ${formatCurrency(line.lineTotal)}`
    ).join('\n');

    const subject = `Nueva Cotización ${quotation.number} - ${quotation.clientName}`;
    const body = `
Nueva cotización generada:

Número: ${quotation.number}
Cliente: ${quotation.clientName}
Café(s): ${coffeeSummary}
${linesText ? `Líneas:\n${linesText}\n` : ''}
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
    this.sendViaFormSubmit(subject, body, type);
    this.sendViaCloud(subject, body, type);
  },

  async sendViaFormSubmit(subject, body, type = 'notification') {
    try {
      const frameName = 'bca-email-frame';
      let frame = document.querySelector(`iframe[name="${frameName}"]`);
      if (!frame) {
        frame = document.createElement('iframe');
        frame.name = frameName;
        frame.style.display = 'none';
        document.body.appendChild(frame);
      }

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `https://formsubmit.co/${encodeURIComponent(this.email)}`;
      form.target = frameName;
      form.style.display = 'none';

      const fields = {
        _subject: subject,
        _template: 'table',
        _captcha: 'false',
        subject,
        message: body,
        type
      };

      Object.entries(fields).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
      form.remove();

      this.markDelivered(subject);
      const emails = Storage.get('bca_email_queue') || [];
      const match = emails.find((e) => e.subject === subject);
      if (match) {
        match.method = 'formsubmit';
        Storage.set('bca_email_queue', emails);
      }
    } catch (error) {
      console.warn('FormSubmit no disponible:', error.message);
    }
  },

  async sendViaCloud(subject, body, type = 'notification') {
    if (typeof FirebaseSync === 'undefined' || !FirebaseSync.isEnabled() || !FirebaseSync.db) {
      return;
    }

    try {
      await FirebaseSync.db.collection('bca_email_outbox').add({
        to: this.email,
        subject,
        body,
        type,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        delivered: false,
        failed: false
      });
    } catch (error) {
      console.warn('No se pudo encolar correo en Firebase:', error.message);
    }
  },

  queueEmail(subject, body, type = 'notification') {
    const raw = Storage.get('bca_email_queue');
    const emails = Array.isArray(raw) ? raw : [];
    emails.unshift({
      to: this.email,
      subject,
      body,
      type,
      sentAt: new Date().toISOString(),
      method: 'cloud',
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
  },

  renderQueueSummary() {
    const queue = this.getEmailQueue();
    const pending = queue.filter((e) => !e.delivered).length;
    const delivered = queue.filter((e) => e.delivered).length;

    if (queue.length === 0) {
      return '<p class="form-hint">No hay correos en cola local.</p>';
    }

    const rows = queue.slice(0, 8).map((item) => `
      <tr>
        <td>${item.delivered ? '✅' : '⏳'}</td>
        <td>${item.subject}</td>
        <td>${new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.sentAt))}</td>
      </tr>
    `).join('');

    return `
      <p class="form-hint" style="margin-bottom:8px">
        Cola local: ${pending} pendientes · ${delivered} marcados como enviados
      </p>
      <div style="overflow-x:auto">
        <table class="data-table" style="font-size:0.85rem">
          <thead><tr><th></th><th>Asunto</th><th>Fecha</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }
};
