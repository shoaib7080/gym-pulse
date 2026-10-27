"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INVOICE_DOC_TYPES = exports.PAYMENT_PURPOSES = exports.PAYMENT_STATUSES = exports.PAYMENT_METHODS = exports.DEFAULT_TIMEZONE = exports.DEFAULT_VAT_RATE_BPS = exports.DEFAULT_CURRENCY = exports.CURRENCIES = void 0;
exports.CURRENCIES = {
    AED: 'AED',
    SAR: 'SAR',
};
exports.DEFAULT_CURRENCY = 'AED';
exports.DEFAULT_VAT_RATE_BPS = 500;
exports.DEFAULT_TIMEZONE = 'Asia/Dubai';
exports.PAYMENT_METHODS = {
    CASH: 'cash',
    CARD_POS: 'card_pos',
    CARD_ONLINE: 'card_online',
    APPLE_PAY: 'apple_pay',
    GOOGLE_PAY: 'google_pay',
    BANK_TRANSFER: 'bank_transfer',
};
exports.PAYMENT_STATUSES = {
    PENDING: 'pending',
    SUCCEEDED: 'succeeded',
    FAILED: 'failed',
    VOIDED: 'voided',
    REFUNDED: 'refunded',
    PARTIALLY_REFUNDED: 'partially_refunded',
};
exports.PAYMENT_PURPOSES = {
    MEMBERSHIP: 'membership',
    RENEWAL: 'renewal',
    FREEZE_FEE: 'freeze_fee',
    OTHER: 'other',
};
exports.INVOICE_DOC_TYPES = {
    TAX_INVOICE: 'tax_invoice',
    SIMPLIFIED_TAX_INVOICE: 'simplified_tax_invoice',
    CREDIT_NOTE: 'credit_note',
    RECEIPT: 'receipt',
};
//# sourceMappingURL=finance.js.map