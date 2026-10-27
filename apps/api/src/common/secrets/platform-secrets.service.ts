import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PlatformProviderMetadata {
  provider: 'tap' | 'razorpay' | 'stripe';
  isConfigured: boolean;
  publicKey?: string;
}

@Injectable()
export class PlatformSecretsService {
  private readonly logger = new Logger(PlatformSecretsService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Razorpay Route uses platform keys (RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET)
   * combined with each gym's linked-account ID stored in gym_payment_accounts.
   */
  getRazorpayPlatformKeys() {
    return {
      keyId: this.config.get<string>('RAZORPAY_KEY_ID') || process.env.RAZORPAY_KEY_ID || '',
      keySecret: this.config.get<string>('RAZORPAY_KEY_SECRET') || process.env.RAZORPAY_KEY_SECRET || '',
      webhookSecret: this.config.get<string>('RAZORPAY_WEBHOOK_SECRET') || process.env.RAZORPAY_WEBHOOK_SECRET || '',
    };
  }

  /**
   * Tap Payments platform keys (for GCC settlement)
   */
  getTapPlatformKeys() {
    return {
      secretKey: this.config.get<string>('TAP_SECRET_KEY') || process.env.TAP_SECRET_KEY || '',
      publicKey: this.config.get<string>('TAP_PUBLIC_KEY') || process.env.TAP_PUBLIC_KEY || '',
      merchantId: this.config.get<string>('TAP_MERCHANT_ID') || process.env.TAP_MERCHANT_ID || '',
      webhookSecret: this.config.get<string>('TAP_WEBHOOK_SECRET') || process.env.TAP_WEBHOOK_SECRET || '',
    };
  }

  /**
   * Stripe Connect platform keys
   */
  getStripePlatformKeys() {
    return {
      secretKey: this.config.get<string>('STRIPE_SECRET_KEY') || process.env.STRIPE_SECRET_KEY || '',
      publishableKey: this.config.get<string>('STRIPE_PUBLISHABLE_KEY') || process.env.STRIPE_PUBLISHABLE_KEY || '',
      webhookSecret: this.config.get<string>('STRIPE_WEBHOOK_SECRET') || process.env.STRIPE_WEBHOOK_SECRET || '',
    };
  }

  /**
   * Get public metadata for clients without exposing secrets.
   */
  getProviderMetadata(provider: 'tap' | 'razorpay' | 'stripe'): PlatformProviderMetadata {
    switch (provider) {
      case 'razorpay': {
        const keys = this.getRazorpayPlatformKeys();
        return {
          provider: 'razorpay',
          isConfigured: !!(keys.keyId && keys.keySecret),
          publicKey: keys.keyId || undefined,
        };
      }
      case 'tap': {
        const keys = this.getTapPlatformKeys();
        return {
          provider: 'tap',
          isConfigured: !!keys.secretKey,
          publicKey: keys.publicKey || undefined,
        };
      }
      case 'stripe': {
        const keys = this.getStripePlatformKeys();
        return {
          provider: 'stripe',
          isConfigured: !!keys.secretKey,
          publicKey: keys.publishableKey || undefined,
        };
      }
    }
  }
}
