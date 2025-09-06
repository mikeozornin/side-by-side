import nodemailer from 'nodemailer';
import { env } from '../load-env';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465, // true for 465, false for other ports
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

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
