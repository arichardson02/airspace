import { Logger } from '@nestjs/common';
import { Resend } from 'resend';

const FROM = 'Airspace <no-reply@airspace.club>';

export interface Email {
  to: string;
  subject: string;
  /** Plain text with a single link; the HTML version wraps the link in a button. */
  text: string;
  link: string;
}

export type SendEmail = (email: Email) => void;

/**
 * Sends account emails with Resend. Without an API key (local dev), the link is logged instead,
 * so sign-up and password reset still work end to end.
 */
export function createEmailSender(apiKey: string | undefined): SendEmail {
  const logger = new Logger('Email');

  if (!apiKey) {
    return ({ to, subject, link }) => logger.log(`"${subject}" for ${to}: ${link}`);
  }

  const resend = new Resend(apiKey);

  // Not awaited by callers: waiting on the provider would let response times reveal which
  // emails have accounts.
  return ({ to, subject, text, link }) => {
    resend.emails
      .send({ from: FROM, to, subject, text: `${text}\n\n${link}`, html: html(text, link) })
      .then(({ error }) => {
        if (error) logger.error(`Failed to send "${subject}" to ${to}: ${error.message}`);
      })
      .catch((err: unknown) => logger.error(`Failed to send "${subject}" to ${to}`, err));
  };
}

function html(text: string, link: string): string {
  const href = escape(link);
  return `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.5;color:#0b0b0c">
  <p>${escape(text)}</p>
  <p><a href="${href}" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#0b0b0c;color:#ffffff;text-decoration:none">Continue</a></p>
  <p style="color:#6b6b70;font-size:13px">Or paste this link into your browser:<br>${href}</p>
</div>`;
}

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
