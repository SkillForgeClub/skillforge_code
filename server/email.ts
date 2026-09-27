/** Password-reset delivery via the Resend HTTPS API. */
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export function isEmailConfigured(): boolean {
  return !!(resend && RESEND_FROM);
}

/**
 * Returns false when no delivery provider is configured so the route can expose a
 * development-only code locally and reject the request in production.
 */
export async function sendResetCodeEmail(toEmail: string, code: string): Promise<boolean> {
  if (!resend || !RESEND_FROM) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[password-reset] Resend is not configured; reset email was not sent.');
    } else {
      console.log(`[password-reset] Resend is not configured - development code for ${toEmail}: ${code} (expires in 10 minutes)`);
      console.log('[password-reset] Set RESEND_API_KEY and RESEND_FROM to send real email.');
    }
    return false;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: RESEND_FROM,
      to: [toEmail],
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
    if (error) {
      console.error('[password-reset] Resend error:', error);
      throw new Error('Resend rejected the email request.');
    }
    console.log(`[password-reset] Reset code emailed to ${toEmail}; Resend id: ${data?.id}`);
    return true;
  } catch (err) {
    console.error(`[password-reset] Failed to send email to ${toEmail}:`, err);
    throw new Error('Password reset email could not be delivered.');
  }
}
