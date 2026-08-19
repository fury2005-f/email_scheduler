import nodemailer from 'nodemailer';
import { env } from '../config/env';

let transporter: nodemailer.Transporter | null = null;
let currentEtherealUser: string | null = null;

export async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  if (env.ETHEREAL_USER && env.ETHEREAL_PASS) {
    currentEtherealUser = env.ETHEREAL_USER;
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: env.ETHEREAL_USER,
        pass: env.ETHEREAL_PASS,
      },
    });
    console.log(`[Ethereal] Connected using user credentials: ${env.ETHEREAL_USER}`);
    return transporter;
  }

  console.log('[Ethereal] No explicit credentials provided. Creating test account...');
  const testAccount = await nodemailer.createTestAccount();
  currentEtherealUser = testAccount.user;

  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  console.log(`[Ethereal] Generated test account: ${testAccount.user}`);
  return transporter;
}

export interface SendEmailPayload {
  to: string;
  from: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
}

export async function sendEmailViaEthereal(payload: SendEmailPayload): Promise<SendEmailResult> {
  const activeTransporter = await getTransporter();

  const info = await activeTransporter.sendMail({
    from: payload.from || currentEtherealUser || '"ReachInbox Demo" <outreach@reachinbox.ai>',
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);

  return {
    messageId: info.messageId,
    previewUrl,
  };
}
