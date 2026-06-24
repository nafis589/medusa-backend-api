import nodemailer from 'nodemailer';
import { logger } from './logger';

export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transporter: nodemailer.Transporter | null = null;

export function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const isTest = process.env.NODE_ENV === 'test';
    if (isTest || !process.env.SMTP_USER) {
      // Create a mock JSON transporter for testing / development without active SMTP settings
      transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    } else {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: Number(process.env.SMTP_PORT ?? 587) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });
    }
  }
  return transporter;
}

export async function sendMail(options: SendMailOptions): Promise<void> {
  const from = process.env.SMTP_FROM ?? 'noreply@marketplace.tg';
  const mailTransporter = getTransporter();

  try {
    const info = (await mailTransporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    })) as { messageId?: string };
    logger.info({ messageId: info.messageId ?? '' }, 'Email sent successfully');
  } catch (error) {
    logger.error(error, 'Failed to send email');
    throw error;
  }
}
