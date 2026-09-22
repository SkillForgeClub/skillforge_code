/**
 * Real email delivery for password resets (and anything else that needs to email a user),
 * via SMTP - works with any provider (SendGrid, Mailgun, Amazon SES, Gmail, your college's
 * own mail server, etc.) since it's just standard SMTP, not a vendor-specific API.
 *
 * Configure via env vars (see .env.example): SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
 * SMTP_FROM. If SMTP_HOST is unset, falls back to logging the email to the console instead -
 * that's the existing behavior, kept as a safe default so nothing breaks for deployments that
 * haven't set up email yet. Once SMTP_HOST is set, real emails go out for real.
 */
import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'SkillForge Code <no-reply@skillforge.local>';
// SMTP_SECURE=true for port 465 (implicit TLS); most providers (587) use STARTTLS instead, secure=false.
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
// Only for local testing against a plaintext/self-signed test SMTP server (e.g. smtp-server
// with its default dev certificate) - leave unset in production so STARTTLS + real certificate
// validation happens against your actual provider.
const SMTP_IGNORE_TLS = process.env.SMTP_IGNORE_TLS === 'true';

const emailConfigured = !!SMTP_HOST;

const transporter = emailConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      ignoreTLS: SMTP_IGNORE_TLS,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    })
  : null;

export function isEmailConfigured(): boolean {
  return emailConfigured;
}

/**
 * Sends the password-reset code by email. Falls back to a console log (the pre-existing
 * behavior) if SMTP isn't configured, so local dev and not-yet-configured deployments keep
 * working exactly as before - the code just isn't reachable anywhere but the server console
 * until SMTP_HOST is set.
 */
export async function sendResetCodeEmail(toEmail: string, code: string): Promise<void> {
  if (!transporter) {
    console.log(`[password-reset] SMTP not configured - code for ${toEmail}: ${code} (expires in 10 minutes)`);
    console.log('[password-reset] Set SMTP_HOST/SMTP_USER/SMTP_PASS in .env to send this by real email instead. See .env.example.');
    return;
  }

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to: toEmail,
      subject: 'Your SkillForge Code password reset code',
      text: `Your password reset code is: ${code}\n\nThis code expires in 10 minutes. If you didn't request this, you can safely ignore this email.`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">Password Reset Code</h2>
          <p>Use this code to reset your SkillForge Code password:</p>
          <p style="font-size: 28px; font-weight: 800; letter-spacing: 4px; background: #f4f4f5; padding: 16px 20px; border-radius: 12px; text-align: center;">${code}</p>
          <p style="color: #71717a; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
    console.log(`[password-reset] Reset code emailed to ${toEmail}`);
  } catch (err) {
    // Never let an email delivery failure break the request/response cycle for the user -
    // fall back to the console log so the admin can still retrieve the code if needed.
    console.error(`[password-reset] Failed to send email to ${toEmail}:`, err);
    console.log(`[password-reset] Fallback - code for ${toEmail}: ${code}`);
  }
}
