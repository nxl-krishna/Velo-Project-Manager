import nodemailer, { type Transporter } from "nodemailer";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const PLACEHOLDER_CREDENTIALS = new Set(["", "user", "pass"]);

export function isEmailConfigured(): boolean {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  return Boolean(SMTP_HOST) && !PLACEHOLDER_CREDENTIALS.has(SMTP_USER ?? "") && !PLACEHOLDER_CREDENTIALS.has(SMTP_PASS ?? "");
}

const globalForEmail = globalThis as unknown as { mailTransport?: Transporter };

function transport(): Transporter {
  if (!globalForEmail.mailTransport) {
    const port = parseInt(process.env.SMTP_PORT || "465", 10);
    globalForEmail.mailTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // 465 = implicit TLS; 587 upgrades with STARTTLS
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return globalForEmail.mailTransport;
}

/**
 * Sends an email over SMTP. Without SMTP configured, development logs the message instead
 * (so flows like password reset can be tested); production throws.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP is not configured");
    console.log(`[Email] SMTP not configured; would send to ${message.to}: ${message.subject}\n${message.text}`);
    return;
  }
  await transport().sendMail({
    from: `Velo <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
    ...message,
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function passwordResetEmail(to: string, name: string, resetUrl: string, expiresInMinutes: number): EmailMessage {
  const safeName = escapeHtml(name);
  return {
    to,
    subject: "Reset your Velo password",
    text: `Hi ${name},\n\nWe received a request to reset your Velo password. Open this link to choose a new one (it expires in ${expiresInMinutes} minutes and works once):\n\n${resetUrl}\n\nIf you didn't ask for this, you can ignore this email; your password won't change.`,
    html: `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
        <h2 style="color: #6366f1;">Reset your password</h2>
        <p>Hi ${safeName},</p>
        <p>We received a request to reset your Velo password. This link expires in ${expiresInMinutes} minutes and can be used once.</p>
        <a href="${escapeHtml(resetUrl)}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">Choose a new password</a>
        <p style="color: #64748b; font-size: 13px;">If the button doesn't work, paste this into your browser:<br>${escapeHtml(resetUrl)}</p>
        <p style="color: #64748b; font-size: 13px;">If you didn't ask for this, ignore this email; your password won't change.</p>
      </div>
    `,
  };
}
