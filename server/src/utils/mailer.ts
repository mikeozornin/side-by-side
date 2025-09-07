import nodemailer from 'nodemailer';
import { env } from '../load-env';
import { i18n } from '../notifications/i18n';

// Автоопределение протокола и порта
function getSmtpConfig() {
  const host = env.SMTP_HOST;
  const port = env.SMTP_PORT;
  
  // Если порт не указан, пытаемся определить по хосту
  let finalPort = port;
  let secure = false;
  
  if (!port || port === 0) {
    // Популярные SMTP серверы и их стандартные порты
    const smtpPorts: Record<string, { port: number; secure: boolean }> = {
      'smtp.gmail.com': { port: 587, secure: false },
      'smtp.mail.ru': { port: 587, secure: false },
      'smtp.yandex.ru': { port: 587, secure: false },
      'smtp.ethereal.email': { port: 587, secure: false },
      'smtp.mailtrap.io': { port: 587, secure: false },
      'smtp.sendgrid.net': { port: 587, secure: false },
      'smtp.mailgun.org': { port: 587, secure: false },
    };
    
    const config = smtpPorts[host.toLowerCase()];
    if (config) {
      finalPort = config.port;
      secure = config.secure;
    } else {
      // По умолчанию пробуем 587 (STARTTLS)
      finalPort = 587;
      secure = false;
    }
  } else {
    // Если порт указан, определяем secure по порту
    secure = port === 465; // 465 = SSL, остальные = STARTTLS
  }
  
  return {
    host,
    port: finalPort,
    secure,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
    // Настройки для разработки - отключаем проверку SSL сертификата
    tls: {
      rejectUnauthorized: env.NODE_ENV === 'production',
    },
  };
}

const smtpConfig = getSmtpConfig();
console.log('SMTP Config:', {
  host: smtpConfig.host,
  port: smtpConfig.port,
  secure: smtpConfig.secure,
  user: smtpConfig.auth.user,
});

const transporter = nodemailer.createTransport(smtpConfig);

interface SendMagicLinkParams {
  email: string;
  url: string;
}

export async function sendMagicLink({ email, url }: SendMagicLinkParams) {
  const subject = i18n.t('email.magicLink.subject');
  const greeting = i18n.t('email.magicLink.greeting');
  const intro = i18n.t('email.magicLink.intro');
  const action = i18n.t('email.magicLink.action');
  const button = i18n.t('email.magicLink.button');
  const footer = i18n.t('email.magicLink.footer');

  const text = `${greeting}\n\n${intro}\n\n${action}\n${url}\n\n${footer}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <p>${greeting}</p>
      <p>${intro}</p>
      <p>${action}</p>
      <div style="margin: 20px 0;">
        <a href="${url}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">${button}</a>
      </div>
      <p style="font-size: 12px; color: #666;">Если кнопка не работает, скопируйте и откройте эту ссылку в браузере:</p>
      <p style="word-break: break-all; font-size: 12px;"><a href="${url}">${url}</a></p>
      <p>${footer}</p>
    </div>
  `;

  const info = await transporter.sendMail({
    from: `"Side-by-Side" <${env.SMTP_FROM_EMAIL}>`,
    to: email,
    subject,
    text,
    html,
  });

  console.log('Message sent: %s', info.messageId);
}
