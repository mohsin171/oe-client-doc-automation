// Outbound email for sign-in codes, via Resend on the verified orcaedge.io domain.
//
// This is transactional mail to the firm's own staff, not client correspondence.
// Client correspondence is a separate question and deliberately does not run
// through here.

const FROM = process.env.AUTH_EMAIL_FROM || 'Orca Edge <hello@orcaedge.io>';

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendCodeEmail({ to, name, code, firmName, minutes }) {
  if (!emailConfigured()) {
    return { sent: false, reason: 'not_configured' };
  }

  const subject = `${code} is your sign-in code`;

  const text = [
    `Hello ${name || ''}`.trim() + ',',
    '',
    `Your sign-in code for ${firmName} is ${code}`,
    '',
    `It expires in ${minutes} minutes and can only be used once.`,
    'If you did not ask to sign in, you can ignore this message.',
    '',
    'Orca Edge',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1A1F28;line-height:1.6;max-width:480px">
      <p>Hello ${escapeHtml(name || '')},</p>
      <p>Your sign-in code for <strong>${escapeHtml(firmName)}</strong> is:</p>
      <p style="font-size:30px;letter-spacing:7px;font-weight:bold;color:#060B14;margin:22px 0">${code}</p>
      <p style="color:#5A6572;font-size:14px">
        It expires in ${minutes} minutes and can only be used once.
        If you did not ask to sign in, you can ignore this message.
      </p>
      <p style="color:#5A6572;font-size:13px;margin-top:26px">Orca Edge</p>
    </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, text, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { sent: false, reason: 'provider_error', detail: body.slice(0, 300) };
  }

  return { sent: true };
}

export async function sendInviteEmail({ to, name, invitedBy, firmName }) {
  if (!emailConfigured()) return { sent: false, reason: 'not_configured' };

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1A1F28;line-height:1.6;max-width:480px">
      <p>Hello ${escapeHtml(name || '')},</p>
      <p>
        ${escapeHtml(invitedBy)} has given you access to the document system for
        <strong>${escapeHtml(firmName)}</strong>.
      </p>
      <p>
        To sign in, go to the system and enter this email address. A six digit
        code will be sent to you. There is no password to remember.
      </p>
      <p style="color:#5A6572;font-size:13px;margin-top:26px">Orca Edge</p>
    </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject: `You have been given access to ${firmName}`,
      html,
    }),
  });

  return res.ok ? { sent: true } : { sent: false, reason: 'provider_error' };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
