export interface SaasPlanLimits {
  maxBranches: number;
  maxMembers: number;
  maxStaff: number;
}

export interface CreateSaasPlanDto {
  code: string;
  name: string;
  billingInterval: 'month' | 'year';
  priceMinor: number;
  currency: string;
  limits: SaasPlanLimits;
  isActive: boolean;
}

export interface ProvisionSubscriptionDto {
  gymId: string;
  saasPlanId: string;
  billingMethod: 'bank_transfer' | 'payment_link' | 'card_on_file';
  startDate?: string;
  termMonths: number;
  dueDays: number;
}

export interface RecordPlatformPaymentDto {
  method: 'bank_transfer' | 'card' | 'payment_link';
  amountMinor: number;
  reference?: string;
  receivedOn: string;
}

export interface ChangeSubscriptionDto {
  saasPlanId: string;
  billingMethod?: 'bank_transfer' | 'payment_link' | 'card_on_file';
}

export interface SweepSubscriptionDto {
  asOfDate?: string;
}

export interface ValidationIssue {
  name: string;
  reason: string;
}

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: { issues: ValidationIssue[] } };

export const createSaasPlanSchema = {
  safeParse(raw: unknown): ParseResult<CreateSaasPlanDto> {
    const issues: ValidationIssue[] = [];
    if (!raw || typeof raw !== 'object') {
      return { success: false, error: { issues: [{ name: 'body', reason: 'Expected object' }] } };
    }
    const val = raw as Record<string, unknown>;

    if (typeof val.code !== 'string' || !/^[a-z0-9_-]{2,50}$/.test(val.code)) {
      issues.push({ name: 'code', reason: 'Plan code must be 2-50 lowercase alphanumeric characters' });
    }
    if (typeof val.name !== 'string' || val.name.trim().length < 2) {
      issues.push({ name: 'name', reason: 'Plan name must be at least 2 characters' });
    }
    const interval = val.billingInterval === 'year' ? 'year' : 'month';
    const priceMinor = typeof val.priceMinor === 'number' && val.priceMinor >= 0 ? Math.round(val.priceMinor) : -1;
    if (priceMinor < 0) {
      issues.push({ name: 'priceMinor', reason: 'priceMinor must be a non-negative integer' });
    }

    const rawLimits = (val.limits && typeof val.limits === 'object' ? val.limits : {}) as Record<string, unknown>;
    const limits: SaasPlanLimits = {
      maxBranches: typeof rawLimits.maxBranches === 'number' && rawLimits.maxBranches >= 1 ? Math.round(rawLimits.maxBranches) : 1,
      maxMembers: typeof rawLimits.maxMembers === 'number' && rawLimits.maxMembers >= 1 ? Math.round(rawLimits.maxMembers) : 150,
      maxStaff: typeof rawLimits.maxStaff === 'number' && rawLimits.maxStaff >= 1 ? Math.round(rawLimits.maxStaff) : 5,
    };

    if (issues.length > 0) {
      return { success: false, error: { issues } };
    }

    return {
      success: true,
      data: {
        code: (val.code as string).toLowerCase().trim(),
        name: (val.name as string).trim(),
        billingInterval: interval,
        priceMinor,
        currency: typeof val.currency === 'string' && val.currency.length === 3 ? val.currency.toUpperCase() : 'AED',
        limits,
        isActive: val.isActive !== false,
      },
    };
  },
};

export const provisionSubscriptionSchema = {
  safeParse(raw: unknown): ParseResult<ProvisionSubscriptionDto> {
    const issues: ValidationIssue[] = [];
    if (!raw || typeof raw !== 'object') {
      return { success: false, error: { issues: [{ name: 'body', reason: 'Expected object' }] } };
    }
    const val = raw as Record<string, unknown>;

    if (typeof val.gymId !== 'string' || !val.gymId) {
      issues.push({ name: 'gymId', reason: 'gymId is required' });
    }
    if (typeof val.saasPlanId !== 'string' || !val.saasPlanId) {
      issues.push({ name: 'saasPlanId', reason: 'saasPlanId is required' });
    }

    const billingMethod =
      val.billingMethod === 'payment_link' || val.billingMethod === 'card_on_file'
        ? val.billingMethod
        : 'bank_transfer';

    let startDate: string | undefined;
    if (val.startDate) {
      if (typeof val.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val.startDate)) {
        issues.push({ name: 'startDate', reason: 'startDate must be in YYYY-MM-DD format' });
      } else {
        startDate = val.startDate;
      }
    }

    const termMonths =
      typeof val.termMonths === 'number' && val.termMonths >= 1 ? Math.round(val.termMonths) : 1;
    const dueDays =
      typeof val.dueDays === 'number' && val.dueDays >= 0 ? Math.round(val.dueDays) : 14;

    if (issues.length > 0) {
      return { success: false, error: { issues } };
    }

    return {
      success: true,
      data: {
        gymId: val.gymId as string,
        saasPlanId: val.saasPlanId as string,
        billingMethod,
        startDate,
        termMonths,
        dueDays,
      },
    };
  },
};

export const recordPlatformPaymentSchema = {
  safeParse(raw: unknown): ParseResult<RecordPlatformPaymentDto> {
    const issues: ValidationIssue[] = [];
    if (!raw || typeof raw !== 'object') {
      return { success: false, error: { issues: [{ name: 'body', reason: 'Expected object' }] } };
    }
    const val = raw as Record<string, unknown>;

    const validMethods = ['bank_transfer', 'card', 'payment_link'] as const;
    if (!validMethods.includes(val.method as 'bank_transfer' | 'card' | 'payment_link')) {
      issues.push({ name: 'method', reason: 'Invalid payment method' });
    }

    if (typeof val.amountMinor !== 'number' || val.amountMinor <= 0) {
      issues.push({ name: 'amountMinor', reason: 'amountMinor must be a positive integer' });
    }

    if (typeof val.receivedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val.receivedOn)) {
      issues.push({ name: 'receivedOn', reason: 'receivedOn must be in YYYY-MM-DD format' });
    }

    if (issues.length > 0) {
      return { success: false, error: { issues } };
    }

    return {
      success: true,
      data: {
        method: val.method as 'bank_transfer' | 'card' | 'payment_link',
        amountMinor: Math.round(val.amountMinor as number),
        reference: typeof val.reference === 'string' ? val.reference : undefined,
        receivedOn: val.receivedOn as string,
      },
    };
  },
};

export const changeSubscriptionSchema = {
  safeParse(raw: unknown): ParseResult<ChangeSubscriptionDto> {
    const issues: ValidationIssue[] = [];
    if (!raw || typeof raw !== 'object') {
      return { success: false, error: { issues: [{ name: 'body', reason: 'Expected object' }] } };
    }
    const val = raw as Record<string, unknown>;

    if (typeof val.saasPlanId !== 'string' || !val.saasPlanId) {
      issues.push({ name: 'saasPlanId', reason: 'saasPlanId is required' });
    }

    if (issues.length > 0) {
      return { success: false, error: { issues } };
    }

    const billingMethod =
      val.billingMethod === 'payment_link' || val.billingMethod === 'card_on_file' || val.billingMethod === 'bank_transfer'
        ? val.billingMethod
        : undefined;

    return {
      success: true,
      data: {
        saasPlanId: val.saasPlanId as string,
        billingMethod,
      },
    };
  },
};

export const sweepSubscriptionSchema = {
  safeParse(raw: unknown): ParseResult<SweepSubscriptionDto> {
    if (!raw || typeof raw !== 'object') {
      return { success: true, data: {} };
    }
    const val = raw as Record<string, unknown>;
    if (val.asOfDate) {
      if (typeof val.asOfDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val.asOfDate)) {
        return {
          success: false,
          error: { issues: [{ name: 'asOfDate', reason: 'asOfDate must be in YYYY-MM-DD format' }] },
        };
      }
      return { success: true, data: { asOfDate: val.asOfDate } };
    }
    return { success: true, data: {} };
  },
};
