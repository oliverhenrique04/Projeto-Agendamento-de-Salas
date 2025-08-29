// backend/src/utils/mailer.ts
import fs from 'fs';
import nodemailer from 'nodemailer';

export async function sendMail({ to, subject, html }:{
  to: string; subject: string; html: string;
}) {
  const host = process.env.NODEMAILER_HOST || 'smtp.gmail.com';
  const port = Number(process.env.NODEMAILER_PORT || 465);
  const secure = port === 465;

  let extraCA: Buffer | undefined;
  const caPath = process.env.NODE_EXTRA_CA_CERTS; // use o mesmo caminho aqui
  if (caPath && fs.existsSync(caPath)) {
    extraCA = fs.readFileSync(caPath);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,                     // 465 = SMTPS; 587 = STARTTLS
    auth: {
      user: process.env.NODEMAILER_USER!,
      pass: process.env.NODEMAILER_PASS!,     // App Password (16 chars, sem espaços)
    },
    requireTLS: !secure,        // força STARTTLS caso use 587
    tls: {
      servername: 'smtp.gmail.com',
      minVersion: 'TLSv1.2',
      ca: extraCA ? [extraCA] : undefined,    // <- CA explicitamente carregado
      // NÃO use rejectUnauthorized:false com credenciais reais
    },
    logger: true,
    debug: true,
  });

  await transporter.verify();
  await transporter.sendMail({
    from: process.env.NODEMAILER_FROM || process.env.NODEMAILER_USER,
    to, subject, html,
  });
}
