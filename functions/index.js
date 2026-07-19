const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { Resend } = require('resend');

initializeApp();

const resendApiKey = defineSecret('RESEND_API_KEY');
const fromEmail = defineSecret('BCA_FROM_EMAIL');

exports.processEmailOutbox = onDocumentCreated(
  {
    document: 'bca_email_outbox/{emailId}',
    secrets: [resendApiKey, fromEmail],
    region: 'southamerica-east1'
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    const db = getFirestore();
    const docRef = snapshot.ref;

    if (data.delivered || data.failed) {
      return;
    }

    const resend = new Resend(resendApiKey.value());
    const from = fromEmail.value() || 'Black Coffee <onboarding@resend.dev>';

    try {
      const result = await resend.emails.send({
        from,
        to: data.to,
        subject: data.subject,
        text: data.body
      });

      await docRef.update({
        delivered: true,
        deliveredAt: FieldValue.serverTimestamp(),
        providerId: result.data?.id || null
      });
    } catch (error) {
      console.error('Error enviando correo BCA:', error);
      await docRef.update({
        failed: true,
        failedAt: FieldValue.serverTimestamp(),
        error: error.message || 'Error desconocido'
      });
    }
  }
);
