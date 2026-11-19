import nodemailer from 'nodemailer'

function createTransporter() {
  const host = String(process.env.EMAIL_HOST ?? '').trim()
  const port = Number(process.env.EMAIL_PORT ?? 587)
  const user = String(process.env.EMAIL_USER ?? '').trim()
  const pass = String(process.env.EMAIL_PASS ?? '').trim()
  const from = String(process.env.EMAIL_FROM || user || 'noreply@levelup.kg').trim()

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

const EMAIL_TEXT = {
  ru: {
    resetSubject: (isAdmin) => (isAdmin ? 'LevelUp Admin — восстановление пароля' : 'LevelUp — восстановление пароля'),
    resetTitle: 'Восстановление пароля',
    resetIntro: (isAdmin) => `Мы получили запрос на восстановление пароля ${isAdmin ? 'администратора' : 'вашего аккаунта'} LevelUp. Нажмите кнопку ниже, чтобы создать новый пароль.`,
    resetButton: 'Создать новый пароль',
    resetExpiry: (m) => `Ссылка действует <strong>${m} минут</strong> и может быть использована только один раз.`,
    resetExpiryText: (m) => `Ссылка действует ${m} минут и может быть использована только один раз.`,
    resetWarning: 'Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо — ваш пароль не изменится. Никому не пересылайте эту ссылку.',
    linkHint: 'Если кнопка не работает, скопируйте ссылку в браузер:',
    changedSubject: (isAdmin) => (isAdmin ? 'LevelUp Admin — пароль изменён' : 'LevelUp — пароль изменён'),
    changedTitle: 'Пароль изменён',
    changedIntro: (isAdmin) => `Пароль ${isAdmin ? 'администратора' : 'вашего аккаунта'} LevelUp только что был изменён. Все активные сессии завершены.`,
    changedWarning: 'Если это были не вы, немедленно восстановите пароль через «Забыли пароль?» и свяжитесь с поддержкой.',
    rights: 'Все права защищены.'
  },
  kg: {
    resetSubject: (isAdmin) => (isAdmin ? 'LevelUp Admin — сырсөздү калыбына келтирүү' : 'LevelUp — сырсөздү калыбына келтирүү'),
    resetTitle: 'Сырсөздү калыбына келтирүү',
    resetIntro: (isAdmin) => `LevelUp ${isAdmin ? 'администраторунун' : 'аккаунтуңуздун'} сырсөзүн калыбына келтирүү сурамы келди. Жаңы сырсөз түзүү үчүн төмөнкү баскычты басыңыз.`,
    resetButton: 'Жаңы сырсөз түзүү',
    resetExpiry: (m) => `Шилтеме <strong>${m} мүнөт</strong> жарактуу жана бир гана жолу колдонулат.`,
    resetExpiryText: (m) => `Шилтеме ${m} мүнөт жарактуу жана бир гана жолу колдонулат.`,
    resetWarning: 'Эгер сиз сырсөздү калыбына келтирүүнү сураган эмес болсоңуз, бул катты этибарга албаңыз — сырсөзүңүз өзгөрбөйт. Бул шилтемени эч кимге жөнөтпөңүз.',
    linkHint: 'Баскыч иштебесе, шилтемени браузерге көчүрүңүз:',
    changedSubject: (isAdmin) => (isAdmin ? 'LevelUp Admin — сырсөз өзгөртүлдү' : 'LevelUp — сырсөз өзгөртүлдү'),
    changedTitle: 'Сырсөз өзгөртүлдү',
    changedIntro: (isAdmin) => `LevelUp ${isAdmin ? 'администраторунун' : 'аккаунтуңуздун'} сырсөзү азыр эле өзгөртүлдү. Бардык активдүү сессиялар жабылды.`,
    changedWarning: 'Эгер бул сиз болбосоңуз, «Сырсөздү унуттуңузбу?» аркылуу сырсөздү дароо калыбына келтирип, колдоо кызматына кайрылыңыз.',
    rights: 'Бардык укуктар корголгон.'
  },
  en: {
    resetSubject: (isAdmin) => (isAdmin ? 'LevelUp Admin — password reset' : 'LevelUp — password reset'),
    resetTitle: 'Password reset',
    resetIntro: (isAdmin) => `We received a request to reset the ${isAdmin ? 'administrator' : 'account'} password for LevelUp. Click the button below to create a new password.`,
    resetButton: 'Create new password',
    resetExpiry: (m) => `The link is valid for <strong>${m} minutes</strong> and can be used only once.`,
    resetExpiryText: (m) => `The link is valid for ${m} minutes and can be used only once.`,
    resetWarning: 'If you did not request a password reset, ignore this email — your password will not change. Do not forward this link to anyone.',
    linkHint: 'If the button does not work, copy this link into your browser:',
    changedSubject: (isAdmin) => (isAdmin ? 'LevelUp Admin — password changed' : 'LevelUp — password changed'),
    changedTitle: 'Password changed',
    changedIntro: (isAdmin) => `The ${isAdmin ? 'administrator' : 'account'} password for LevelUp was just changed. All active sessions were signed out.`,
    changedWarning: 'If this was not you, reset the password via “Forgot password?” right away and contact support.',
    rights: 'All rights reserved.'
  }
}

export const emailLanguage = (value) => (['kg', 'ru', 'en'].includes(value) ? value : 'ru')
const escHtml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function emailLayout({ lang, logoUrl, title, body }) {
  const logo = logoUrl
    ? `<img src="${escHtml(logoUrl)}" width="120" height="80" alt="LevelUp" style="display:block;margin:0 auto 8px;border:0;outline:none">`
    : '<div style="font-size:26px;font-weight:800;color:#0b7f4a;text-align:center;margin-bottom:8px">LevelUp</div>'
  return `<!DOCTYPE html>
<html lang="${lang === 'kg' ? 'ky' : lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#eef6f1;font-family:Arial,Helvetica,sans-serif;color:#0e1b2b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef6f1;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(6,40,29,.10)">
        <tr><td style="height:6px;background:linear-gradient(90deg,#0b7f4a,#1fbf6e,#3ee08f);font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="padding:32px 32px 8px;text-align:center">${logo}
          <h1 style="margin:12px 0 0;font-size:22px;line-height:1.3;color:#06281d">${escHtml(title)}</h1>
        </td></tr>
        <tr><td style="padding:8px 32px 28px;font-size:15px;line-height:1.6;color:#4b5b6b">${body}</td></tr>
        <tr><td style="padding:16px 32px;background:#f4f8f6;font-size:12px;color:#6b7a88;text-align:center">© ${new Date().getFullYear()} LevelUp. ${escHtml(EMAIL_TEXT[lang].rights)}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function buildPasswordResetEmail({ resetUrl, expiresMinutes = 30, isAdmin = false, language = 'ru', logoUrl = '' }) {
  const lang = emailLanguage(language)
  const T = EMAIL_TEXT[lang]
  const safeUrl = escHtml(resetUrl)
  const body = `
    <p style="margin:0 0 20px">${escHtml(T.resetIntro(isAdmin))}</p>
    <p style="margin:0 0 24px;text-align:center">
      <a href="${safeUrl}" style="display:inline-block;background:#0b7f4a;color:#ffffff;text-decoration:none;padding:14px 30px;border-radius:999px;font-weight:700;font-size:15px">${escHtml(T.resetButton)}</a>
    </p>
    <p style="margin:0 0 12px;padding:12px 14px;background:#e7f8ee;border-radius:12px;color:#06281d;font-size:14px">⏱ ${T.resetExpiry(expiresMinutes)}</p>
    <p style="margin:0 0 18px;padding:12px 14px;background:#fff4e5;border-radius:12px;color:#8a4b00;font-size:14px">⚠ ${escHtml(T.resetWarning)}</p>
    <p style="margin:0;font-size:12px;color:#6b7a88">${escHtml(T.linkHint)}<br><a href="${safeUrl}" style="color:#0b7f4a;word-break:break-all">${safeUrl}</a></p>`
  const html = emailLayout({ lang, logoUrl, title: T.resetTitle, body })
  const text = `${T.resetTitle}\n\n${T.resetIntro(isAdmin)}\n\n${T.resetButton}: ${resetUrl}\n\n${T.resetExpiryText(expiresMinutes)}\n\n${T.resetWarning}`
  return { html, text, subject: T.resetSubject(isAdmin) }
}

export function buildPasswordChangedEmail({ isAdmin = false, language = 'ru', logoUrl = '' }) {
  const lang = emailLanguage(language)
  const T = EMAIL_TEXT[lang]
  const body = `
    <p style="margin:0 0 16px">${escHtml(T.changedIntro(isAdmin))}</p>
    <p style="margin:0;padding:12px 14px;background:#fdecec;border-radius:12px;color:#9b1c1c;font-size:14px">⚠ ${escHtml(T.changedWarning)}</p>`
  const html = emailLayout({ lang, logoUrl, title: T.changedTitle, body })
  const text = `${T.changedTitle}\n\n${T.changedIntro(isAdmin)}\n\n${T.changedWarning}`
  return { html, text, subject: T.changedSubject(isAdmin) }
}

// One-time 6-digit code for the administrator password reset.
const CODE_TEXT = {
  ru: {
    subject: 'Код восстановления пароля LevelUp',
    title: 'Восстановление пароля',
    intro: 'Вы запросили восстановление пароля администратора LevelUp. Введите этот код на странице входа:',
    expiry: (m) => `Код действует ${m} минут и может быть использован только один раз.`,
    warning: 'Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо — пароль останется прежним. Никому не сообщайте этот код.',
  },
  kg: {
    subject: 'LevelUp сырсөзүн калыбына келтирүү коду',
    title: 'Сырсөздү калыбына келтирүү',
    intro: 'Сиз LevelUp администраторунун сырсөзүн калыбына келтирүүнү сурадыңыз. Бул кодду кирүү барагына жазыңыз:',
    expiry: (m) => `Код ${m} мүнөт жарактуу жана бир гана жолу колдонулат.`,
    warning: 'Эгер сиз сырсөздү калыбына келтирүүнү сураган эмес болсоңуз, бул катты этибарга албаңыз — сырсөз өзгөрбөйт. Бул кодду эч кимге айтпаңыз.',
  },
  en: {
    subject: 'Your LevelUp password reset code',
    title: 'Password reset',
    intro: 'You requested a password reset for the LevelUp administrator account. Enter this code on the sign-in page:',
    expiry: (m) => `The code is valid for ${m} minutes and can be used only once.`,
    warning: 'If you did not request a password reset, simply ignore this email — your password will stay the same. Never share this code with anyone.',
  },
}

export function buildAdminResetCodeEmail({ code, expiresMinutes = 5, language = 'ru', logoUrl = '' }) {
  const lang = emailLanguage(language)
  const T = CODE_TEXT[lang]
  const digits = String(code).split('').map((d) => `<span style="display:inline-block;min-width:34px;padding:10px 0;margin:0 3px;border-radius:10px;background:#e7f8ee;color:#06281d;font-size:26px;font-weight:800;font-family:'Courier New',monospace">${escHtml(d)}</span>`).join('')
  const body = `
    <p style="margin:0 0 20px">${escHtml(T.intro)}</p>
    <p style="margin:0 0 24px;text-align:center;white-space:nowrap" aria-label="${escHtml(code)}">${digits}</p>
    <p style="margin:0 0 12px;padding:12px 14px;background:#e7f8ee;border-radius:12px;color:#06281d;font-size:14px">⏱ ${escHtml(T.expiry(expiresMinutes))}</p>
    <p style="margin:0;padding:12px 14px;background:#fff4e5;border-radius:12px;color:#8a4b00;font-size:14px">⚠ ${escHtml(T.warning)}</p>`
  const html = emailLayout({ lang, logoUrl, title: T.title, body })
  const text = `${T.title}\n\n${T.intro}\n\n${code}\n\n${T.expiry(expiresMinutes)}\n\n${T.warning}`
  return { html, text, subject: T.subject }
}
