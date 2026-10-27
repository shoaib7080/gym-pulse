export const CURRENCIES = {
  AED: 'AED',
  SAR: 'SAR',
  INR: 'INR',
  USD: 'USD',
} as const;

export type Currency = (typeof CURRENCIES)[keyof typeof CURRENCIES];

export const DEFAULT_CURRENCY = CURRENCIES.AED;

export const PAYMENT_PROVIDERS = {
  TAP: 'tap',
  RAZORPAY: 'razorpay',
  STRIPE: 'stripe',
} as const;

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[keyof typeof PAYMENT_PROVIDERS];
export const DEFAULT_VAT_RATE_BPS = 500; // 5.00% VAT in UAE
export const DEFAULT_TIMEZONE = 'Asia/Dubai';

export const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD_POS: 'card_pos',
  CARD_ONLINE: 'card_online',
  APPLE_PAY: 'apple_pay',
  GOOGLE_PAY: 'google_pay',
  BANK_TRANSFER: 'bank_transfer',
} as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

export const PAYMENT_STATUSES = {
  PENDING: 'pending',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  VOIDED: 'voided',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];

export const PAYMENT_PURPOSES = {
  MEMBERSHIP: 'membership',
  RENEWAL: 'renewal',
  FREEZE_FEE: 'freeze_fee',
  OTHER: 'other',
} as const;

export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[keyof typeof PAYMENT_PURPOSES];

export const INVOICE_DOC_TYPES = {
  TAX_INVOICE: 'tax_invoice',
  SIMPLIFIED_TAX_INVOICE: 'simplified_tax_invoice',
  CREDIT_NOTE: 'credit_note',
  RECEIPT: 'receipt',
} as const;

export type InvoiceDocType = (typeof INVOICE_DOC_TYPES)[keyof typeof INVOICE_DOC_TYPES];
