const { EMAIL_SENDER, RESEND_API_KEY } = require('../env');
const { createHttpError } = require('../utils/http-error');

// Node 18+ já expõe fetch globalmente. Quando executado em versões anteriores,
// usamos um polyfill dinâmico para evitar falhas em tempo de execução.
const nativeFetch = typeof globalThis.fetch === 'function'
  ? globalThis.fetch.bind(globalThis)
  : null;
let polyfilledFetchPromise;
const getFetch = async () => {
  if (nativeFetch) {
    return nativeFetch;
  }

  if (!polyfilledFetchPromise) {
    polyfilledFetchPromise = import('node-fetch').then(({ default: fetch }) => fetch);
  }

  return polyfilledFetchPromise;
};

function buildPreviewResult(payload, missingVars) {
  const reason = `Modo preview: variáveis ausentes (${missingVars.join(', ')})`;
  console.warn('[EmailService]', reason);
  console.info('[EmailService] Pré-visualização do e-mail:', JSON.stringify(payload, null, 2));
  return {
    status: 'preview-only',
    reason,
    preview: payload
  };
}

/**
 * Envia o relatório semanal usando o Resend. Quando as variáveis EMAIL_SENDER e
 * RESEND_API_KEY não estão configuradas, a função opera em “modo preview” e
 * apenas retorna o conteúdo que seria enviado.
 */
async function sendEmail({ to, subject, text, html }) {
  if (!to) {
    throw createHttpError(400, 'Destinatário do e-mail é obrigatório.');
  }
  if (!subject) {
    throw createHttpError(400, 'Assunto do e-mail é obrigatório.');
  }

  const payload = {
    from: EMAIL_SENDER || 'preview@controlada.local',
    to: Array.isArray(to) ? to : [to],
    subject,
    text: text || undefined,
    html: html || undefined
  };

  const missingVars = [];
  if (!EMAIL_SENDER) missingVars.push('EMAIL_SENDER');
  if (!RESEND_API_KEY) missingVars.push('RESEND_API_KEY');
  if (missingVars.length > 0) {
    return buildPreviewResult(payload, missingVars);
  }

  try {
    const fetchFn = await getFetch();
    const response = await fetchFn('https://api.resend.com/emails', {
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
  } catch (error) {
    console.error('[EmailService] Erro inesperado ao enviar e-mail:', error);
    throw createHttpError(502, 'Não foi possível enviar o e-mail no momento.');
  }
}

module.exports = {
  sendEmail
};
