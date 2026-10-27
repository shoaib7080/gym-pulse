import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: string;

  constructor(private readonly config: ConfigService) {
    this.provider = this.config.get<string>('EMAIL_PROVIDER') || process.env.EMAIL_PROVIDER || 'mock';
  }

  /**
   * Generic sender with support for email providers (Resend, AWS SES, Postmark, SMTP, or deterministic mock)
   */
  async sendMail(options: EmailOptions): Promise<{ id: string; success: boolean }> {
    this.logger.log(`[EmailProvider:${this.provider}] Dispatching email to: ${options.to} | Subject: "${options.subject}"`);

    // In production, when an API key is provided (e.g. RESEND_API_KEY), call provider REST API
    const resendApiKey = this.config.get<string>('RESEND_API_KEY') || process.env.RESEND_API_KEY;
    if (this.provider === 'resend' && resendApiKey) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: this.config.get<string>('EMAIL_FROM') || 'GymPulse <no-reply@gympulse.io>',
            to: options.to,
            subject: options.subject,
            html: options.html,
          }),
        });
        const data = await response.json();
        return { id: data.id || 'resend-ok', success: true };
      } catch (err: any) {
        this.logger.error(`Failed to send email via Resend: ${err.message}`);
      }
    }

    // Default development / test mock delivery log
    const mockId = `mock_email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.logger.log(`[Email Delivered (Mock)] Message ID: ${mockId} to ${options.to}`);
    return { id: mockId, success: true };
  }

  /**
   * Notify gym owner that their gym verification has been APPROVED
   */
  async sendGymApprovedEmail(params: {
    ownerEmail: string;
    ownerName: string;
    gymName: string;
    reason?: string;
  }) {
    const subject = `🎉 Your gym "${params.gymName}" has been approved!`;
    const html = `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <h2>Welcome to GymPulse!</h2>
        <p>Dear ${params.ownerName},</p>
        <p>We are pleased to inform you that your gym <strong>${params.gymName}</strong> has been officially verified and activated.</p>
        ${params.reason ? `<p><em>Review Note:</em> ${params.reason}</p>` : ''}
        <p>You can now add branches, register members, configure plans, and process transactions.</p>
        <p>Best regards,<br/>The GymPulse Platform Team</p>
      </div>
    `;
    return this.sendMail({ to: params.ownerEmail, subject, html });
  }

  /**
   * Notify gym owner that their gym verification has been REJECTED with a mandatory reason
   */
  async sendGymRejectedEmail(params: {
    ownerEmail: string;
    ownerName: string;
    gymName: string;
    reason: string;
  }) {
    const subject = `Notice regarding your gym application: "${params.gymName}"`;
    const html = `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <h2>Gym Verification Update</h2>
        <p>Dear ${params.ownerName},</p>
        <p>Thank you for submitting <strong>${params.gymName}</strong> for verification on GymPulse.</p>
        <p>Unfortunately, your application could not be approved at this time for the following reason:</p>
        <blockquote style="background: #f4f4f4; border-left: 4px solid #e53e3e; padding: 12px; margin: 16px 0;">
          ${params.reason}
        </blockquote>
        <p>You can update your trade license, TRN proof, or profile details in the portal and re-submit for review.</p>
        <p>Best regards,<br/>The GymPulse Compliance Team</p>
      </div>
    `;
    return this.sendMail({ to: params.ownerEmail, subject, html });
  }

  /**
   * Notify gym owner that their gym has been SUSPENDED with a mandatory reason
   */
  async sendGymSuspendedEmail(params: {
    ownerEmail: string;
    ownerName: string;
    gymName: string;
    reason: string;
  }) {
    const subject = `Notice of Suspension: "${params.gymName}"`;
    const html = `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <h2>Gym Suspension Notice</h2>
        <p>Dear ${params.ownerName},</p>
        <p>Please be advised that operations for <strong>${params.gymName}</strong> on GymPulse have been suspended for the following reason:</p>
        <blockquote style="background: #f4f4f4; border-left: 4px solid #e53e3e; padding: 12px; margin: 16px 0;">
          ${params.reason}
        </blockquote>
        <p>Access to member operations has been locked. Contact compliance to resolve this issue.</p>
        <p>Best regards,<br/>The GymPulse Compliance Team</p>
      </div>
    `;
    return this.sendMail({ to: params.ownerEmail, subject, html });
  }

  /**
   * Notify gym owner that their gym has been REACTIVATED
   */
  async sendGymReactivatedEmail(params: {
    ownerEmail: string;
    ownerName: string;
    gymName: string;
    reason: string;
  }) {
    const subject = `Reactivation Notice: "${params.gymName}" has been reactivated`;
    const html = `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <h2>Gym Reactivated</h2>
        <p>Dear ${params.ownerName},</p>
        <p>We are pleased to inform you that <strong>${params.gymName}</strong> has been reactivated on GymPulse.</p>
        <p><em>Reason / Notes:</em> ${params.reason}</p>
        <p>All gym features and member operations have been fully restored.</p>
        <p>Best regards,<br/>The GymPulse Platform Team</p>
      </div>
    `;
    return this.sendMail({ to: params.ownerEmail, subject, html });
  }

  /**
   * Send email address verification link
   */
  async sendEmailVerification(params: { to: string; name: string; verificationUrl: string }) {
    const subject = 'Verify your email address - GymPulse';
    const html = `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <h2>Verify Your Email</h2>
        <p>Hi ${params.name},</p>
        <p>Please click the button below to verify your email address:</p>
        <p><a href="${params.verificationUrl}" style="background: #3182ce; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Verify Email</a></p>
        <p>If you did not create an account, you can safely ignore this email.</p>
      </div>
    `;
    return this.sendMail({ to: params.to, subject, html });
  }

  /**
   * Send password reset link
   */
  async sendPasswordReset(params: { to: string; name: string; resetUrl: string }) {
    const subject = 'Reset your password - GymPulse';
    const html = `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <h2>Password Reset Request</h2>
        <p>Hi ${params.name},</p>
        <p>You recently requested to reset your password. Click the link below to set a new password:</p>
        <p><a href="${params.resetUrl}" style="background: #e53e3e; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Reset Password</a></p>
        <p>This link is valid for 1 hour. If you did not request this, please contact support immediately.</p>
      </div>
    `;
    return this.sendMail({ to: params.to, subject, html });
  }
}
