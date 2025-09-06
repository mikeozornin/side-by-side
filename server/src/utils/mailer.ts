import nodemailer from 'nodemailer';
import { env } from '../load-env';

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
  const info = await transporter.sendMail({
    from: `"Side-by-Side" <${env.SMTP_FROM_EMAIL}>`,
    to: email,
    subject: 'Your sign-in link for Side-by-Side',
    text: `Click this link to sign in: ${url}`,
    html: `<p>Welcome to Side-by-Side!</p><p><a href="${url}">Click here to sign in</a></p>`,
  });

  console.log('Message sent: %s', info.messageId);
}
