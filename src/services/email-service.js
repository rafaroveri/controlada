const { EMAIL_SENDER, RESEND_API_KEY } = require('../env');
const { createHttpError } = require('../utils/http-error');

async function sendEmail({ to, subject, text, html }) {
  if (!to) {
    throw createHttpError(400, 'Destinatário do e-mail é obrigatório.');
  }
  if (!subject) {
    throw createHttpError(400, 'Assunto do e-mail é obrigatório.');
  }
  if (!EMAIL_SENDER) {
    throw createHttpError(500, 'EMAIL_SENDER não configurado.');
  }

  const payload = {
    from: EMAIL_SENDER,
    to: Array.isArray(to) ? to : [to],
    subject,
    text: text || undefined,
    html: html || undefined
  };

  if (!RESEND_API_KEY) {
    console.warn('[EmailService] RESEND_API_KEY não configurada. E-mail não foi enviado, exibindo conteúdo para depuração.');
    console.info('[EmailService] Pré-visualização do e-mail:', JSON.stringify(payload, null, 2));
    return {
      status: 'preview-only',
      reason: 'RESEND_API_KEY não configurada',
      preview: payload
    };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('[EmailService] Falha ao enviar e-mail:', data);
    throw createHttpError(response.status || 502, data?.message || 'Não foi possível enviar o e-mail.');
  }

  return {
    status: 'sent',
    provider: 'resend',
    id: data?.id,
    to: payload.to,
    subject: payload.subject
  };
}

module.exports = {
  sendEmail
};
