import nodemailer from 'nodemailer'

function createTransporter() {
  const host = String(process.env.EMAIL_HOST ?? '').trim()
  const port = Number(process.env.EMAIL_PORT ?? 587)
  const user = String(process.env.EMAIL_USER ?? '').trim()
  const pass = String(process.env.EMAIL_PASS ?? '').trim()
  const from = String(process.env.EMAIL_FROM ?? user ?? 'noreply@levelup.kg').trim()

  if (!host || !user || !pass) {
    return null
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  })

  return { transporter, from }
}

/**
 * Send an email. Returns true on success, false if email is not configured.
 * Throws if the email is configured but sending fails.
 */
export async function sendEmail({ to, subject, html, text }) {
  const transport = createTransporter()
  if (!transport) {
    // Email not configured — log to console so the admin can retrieve the token locally
    // eslint-disable-next-line no-console
    console.warn(`[EMAIL NOT CONFIGURED] Would send to ${to}: ${subject}\n${text ?? html}`)
    return false
  }

  await transport.transporter.sendMail({
    from: transport.from,
    to,
    subject,
    html,
    text: text ?? html.replace(/<[^>]+>/g, '')
  })

  return true
}

export function buildPasswordResetEmail({ resetUrl, expiresMinutes = 30, appName = 'LEVEL UP' }) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Password Reset</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:40px 20px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <h1 style="font-size:24px;margin:0 0 8px;color:#1a1a2e">${appName}</h1>
    <h2 style="font-size:18px;margin:0 0 24px;color:#333">Password Reset Request</h2>
    <p style="color:#555;line-height:1.6">We received a request to reset your administrator password. Click the button below to set a new password.</p>
    <p style="margin:28px 0">
      <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">Reset Password</a>
    </p>
    <p style="color:#888;font-size:13px">This link expires in <strong>${expiresMinutes} minutes</strong> and can only be used once.</p>
    <p style="color:#888;font-size:13px">If you did not request a password reset, you can safely ignore this email.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:28px 0">
    <p style="color:#aaa;font-size:12px">© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
  </div>
</body>
</html>`

  const text = `Password Reset Request\n\nClick the link below to reset your password:\n${resetUrl}\n\nThis link expires in ${expiresMinutes} minutes and can only be used once.\n\nIf you did not request this, ignore this email.`

  return { html, text }
}

export function buildPasswordChangedEmail({ appName = 'LEVEL UP' }) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Password Changed</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:40px 20px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <h1 style="font-size:24px;margin:0 0 8px;color:#1a1a2e">${appName}</h1>
    <h2 style="font-size:18px;margin:0 0 24px;color:#333">Password Changed Successfully</h2>
    <p style="color:#555;line-height:1.6">Your administrator password was just changed. If this was you, no action is needed.</p>
    <p style="color:#e53e3e;line-height:1.6">If you did not change your password, contact support immediately and secure your account.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:28px 0">
    <p style="color:#aaa;font-size:12px">© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
  </div>
</body>
</html>`

  return { html }
}
