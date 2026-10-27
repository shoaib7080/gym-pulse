export declare const CURRENCIES: {
    readonly AED: "AED";
    readonly SAR: "SAR";
};
export type Currency = (typeof CURRENCIES)[keyof typeof CURRENCIES];
export declare const DEFAULT_CURRENCY: Currency;
export declare const DEFAULT_VAT_RATE_BPS = 500;
export declare const DEFAULT_TIMEZONE = "Asia/Dubai";
export declare const PAYMENT_METHODS: {
    readonly CASH: "cash";
    readonly CARD_POS: "card_pos";
    readonly CARD_ONLINE: "card_online";
    readonly APPLE_PAY: "apple_pay";
    readonly GOOGLE_PAY: "google_pay";
    readonly BANK_TRANSFER: "bank_transfer";
};
export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];
export declare const PAYMENT_STATUSES: {
    readonly PENDING: "pending";
    readonly SUCCEEDED: "succeeded";
    readonly FAILED: "failed";
    readonly VOIDED: "voided";
    readonly REFUNDED: "refunded";
    readonly PARTIALLY_REFUNDED: "partially_refunded";
};
export type PaymentStatus = (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];
export declare const PAYMENT_PURPOSES: {
    readonly MEMBERSHIP: "membership";
    readonly RENEWAL: "renewal";
    readonly FREEZE_FEE: "freeze_fee";
    readonly OTHER: "other";
};
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[keyof typeof PAYMENT_PURPOSES];
export declare const INVOICE_DOC_TYPES: {
    readonly TAX_INVOICE: "tax_invoice";
    readonly SIMPLIFIED_TAX_INVOICE: "simplified_tax_invoice";
    readonly CREDIT_NOTE: "credit_note";
    readonly RECEIPT: "receipt";
};
export type InvoiceDocType = (typeof INVOICE_DOC_TYPES)[keyof typeof INVOICE_DOC_TYPES];
