import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface SendEmailOtpOptions {
  to: string;
  name?: string;
  otp: string;
  subject?: string;
  brandName?: string;
}

export interface SendSmsOtpOptions {
  to: string;
  otp: string;
  senderName?: string;
  brandName?: string;
}

export interface SendOtpResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface VerifyOtpResult {
  valid: boolean;
  reason?: 'EXPIRED' | 'MISMATCH';
}

/**
 * Brevo-powered standalone transactional Email & SMS OTP Service.
 * Decoupled utility ready for immediate use wherever OTP or two-factor verification is required.
 */
@Injectable()
export class OtpVerificationService {
  private readonly logger = new Logger(OtpVerificationService.name);

  private get brevoApiKey(): string | undefined {
    return process.env.BREVO_API_KEY;
  }

  private get senderEmail(): string {
    return process.env.BREVO_SENDER_EMAIL || 'no-reply@gympulse.ae';
  }

  private get senderName(): string {
    return process.env.BREVO_SENDER_NAME || 'GymPulse';
  }

  /**
   * Generate a cryptographically secure numeric OTP (default 6 digits).
   */
  generateOtp(length = 6): string {
    if (length < 4 || length > 10) {
      throw new Error('OTP length must be between 4 and 10 digits');
    }
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    const code = crypto.randomInt(min, max + 1);
    return code.toString().padStart(length, '0');
  }

  /**
   * Send transactional email OTP via Brevo API v3.
   * Endpoint: POST https://api.brevo.com/v3/smtp/email
   */
  async sendEmailOtp(options: SendEmailOtpOptions): Promise<SendOtpResult> {
    const apiKey = this.brevoApiKey;
    if (!apiKey) {
      this.logger.warn(`BREVO_API_KEY is not set. Email OTP for ${options.to} was not dispatched.`);
      return {
        success: false,
        error: 'BREVO_API_KEY not configured',
      };
    }

    const brand = options.brandName || this.senderName;
    const subject = options.subject || `Your ${brand} verification code: ${options.otp}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a; margin-top: 0;">${brand} Verification</h2>
        <p style="color: #475569; font-size: 15px;">Use the following one-time passcode (OTP) to complete your verification:</p>
        <div style="background-color: #f1f5f9; padding: 18px; border-radius: 6px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0284c7; font-family: monospace;">${options.otp}</span>
        </div>
        <p style="color: #64748b; font-size: 13px;">This code will expire in 10 minutes. If you did not request this verification, you can safely ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">&copy; ${new Date().getFullYear()} ${brand}. All rights reserved.</p>
      </div>
    `;

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
          sender: {
            name: this.senderName,
            email: this.senderEmail,
          },
          to: [
            {
              email: options.to,
              name: options.name || options.to,
            },
          ],
          subject,
          htmlContent,
        }),
      });

      const responseData = (await response.json()) as { messageId?: string; message?: string; code?: string };

      if (!response.ok) {
        this.logger.error(`Brevo Email API error (${response.status}): ${responseData.message || JSON.stringify(responseData)}`);
        return {
          success: false,
          error: responseData.message || `Brevo request failed with status ${response.status}`,
        };
      }

      this.logger.log(`Email OTP successfully dispatched to ${options.to}. MessageId: ${responseData.messageId}`);
      return {
        success: true,
        messageId: responseData.messageId,
      };
    } catch (err: any) {
      this.logger.error(`Exception during Brevo email dispatch: ${err.message}`, err.stack);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Send transactional SMS OTP via Brevo API v3.
   * Endpoint: POST https://api.brevo.com/v3/transactionalSMS/send
   */
  async sendSmsOtp(options: SendSmsOtpOptions): Promise<SendOtpResult> {
    const apiKey = this.brevoApiKey;
    if (!apiKey) {
      this.logger.warn(`BREVO_API_KEY is not set. SMS OTP for ${options.to} was not dispatched.`);
      return {
        success: false,
        error: 'BREVO_API_KEY not configured',
      };
    }

    const brand = options.brandName || this.senderName;
    const sender = (options.senderName || process.env.BREVO_SMS_SENDER || 'GymPulse').slice(0, 11);
    const content = `Your ${brand} verification code is ${options.otp}. Valid for 10 minutes.`;

    try {
      const response = await fetch('https://api.brevo.com/v3/transactionalSMS/send', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
          sender,
          recipient: options.to,
          content,
          type: 'transactional',
        }),
      });

      const responseData = (await response.json()) as { reference?: string; message?: string; code?: string };

      if (!response.ok) {
        this.logger.error(`Brevo SMS API error (${response.status}): ${responseData.message || JSON.stringify(responseData)}`);
        return {
          success: false,
          error: responseData.message || `Brevo SMS request failed with status ${response.status}`,
        };
      }

      this.logger.log(`SMS OTP successfully dispatched to ${options.to}. Reference: ${responseData.reference}`);
      return {
        success: true,
        messageId: responseData.reference,
      };
    } catch (err: any) {
      this.logger.error(`Exception during Brevo SMS dispatch: ${err.message}`, err.stack);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Timing-safe OTP verification.
   * Checks expiration and compares strings using crypto.timingSafeEqual.
   */
  verifyOtp(inputOtp: string, expectedOtp: string, expiresAt: Date): VerifyOtpResult {
    if (new Date() > expiresAt) {
      return { valid: false, reason: 'EXPIRED' };
    }

    const inputBuf = Buffer.from(inputOtp.trim());
    const expectedBuf = Buffer.from(expectedOtp.trim());

    if (inputBuf.length !== expectedBuf.length) {
      return { valid: false, reason: 'MISMATCH' };
    }

    const matches = crypto.timingSafeEqual(inputBuf, expectedBuf);
    return matches ? { valid: true } : { valid: false, reason: 'MISMATCH' };
  }
}
